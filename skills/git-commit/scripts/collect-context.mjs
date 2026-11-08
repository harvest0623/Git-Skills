// 采集提交所需的全部上下文，输出一份裁剪过的 JSON，供模型判断使用。
// 设计原则：能被脚本确定的就写成脚本，模型只看结论，不重复读仓库。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// diff 的字符预算：超过就按文件截断，避免大仓库撑爆上下文
const MAX_DIFF_CHARS = 8000;
const RECENT_COMMITS = 10;

function git(args, { allowFail = false } = {}) {
    const res = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    if (res.error) throw new Error(`无法执行 git：${res.error.message}`);
    if (!allowFail && res.status !== 0) {
        throw new Error(`git ${args.join(' ')} 失败：${(res.stderr || '').trim()}`);
    }
    return {
        ok: res.status === 0,
        out: (res.stdout || '').replace(/\s+$/, ''),
        err: (res.stderr || '').trim(),
    };
}

// 解析 git status --porcelain=v1 的输出
function parseStatus(raw) {
    const staged = [];
    const unstaged = [];
    const untracked = [];

    for (const line of raw.split('\n')) {
        if (!line.trim()) continue;

        const x = line[0];
        const y = line[1];
        let file = line.slice(3);
        if (file.includes(' -> ')) file = file.split(' -> ').pop();
        file = file.replace(/^"|"$/g, '');

        if (x === '?' && y === '?') {
            untracked.push(file);
            continue;
        }
        if (x !== ' ' && x !== '?') staged.push({ path: file, status: x });
        if (y !== ' ' && y !== '?') unstaged.push({ path: file, status: y });
    }

    return { staged, unstaged, untracked };
}

// 解析 numstat，把增删行数补回文件条目上
function parseNumstat(raw) {
    const map = new Map();
    for (const line of raw.split('\n')) {
        if (!line) continue;
        const [add, del, ...rest] = line.split('\t');
        map.set(rest.join('\t'), {
            additions: add === '-' ? null : Number(add),
            deletions: del === '-' ? null : Number(del),
            binary: add === '-',
        });
    }
    return map;
}

function attachStats(entries, numstat) {
    return entries.map((entry) => {
        const stat = numstat.get(entry.path);
        return {
            ...entry,
            additions: stat ? stat.additions : null,
            deletions: stat ? stat.deletions : null,
            binary: stat ? stat.binary : false,
        };
    });
}

// 按文件切分 diff，按预算逐块保留，超出的文件只记录名字
function limitDiff(diff) {
    if (!diff) return { text: '', truncated: false, omittedFiles: [] };
    if (diff.length <= MAX_DIFF_CHARS) return { text: diff, truncated: false, omittedFiles: [] };

    const chunks = diff.split(/(?=diff --git )/).filter((chunk) => chunk.trim());
    const kept = [];
    const omitted = [];
    let used = 0;

    for (const chunk of chunks) {
        const name = chunk.match(/^diff --git a\/(.+?) /)?.[1] || 'unknown';
        if (used + chunk.length > MAX_DIFF_CHARS) {
            omitted.push(name);
            continue;
        }
        kept.push(chunk);
        used += chunk.length;
    }

    // 单个文件就超预算时，硬截断保底
    if (kept.length === 0) {
        const head = diff.slice(0, MAX_DIFF_CHARS - 200);
        return {
            text: `${head}\n\n[…diff 过长，已截断]`,
            truncated: true,
            omittedFiles: [],
        };
    }

    const note = `\n\n[…diff 已截断，省略 ${omitted.length} 个文件：${omitted.join(', ')}]`;
    return { text: kept.join('') + note, truncated: true, omittedFiles: omitted };
}

// 判断是否停在 merge / rebase / cherry-pick / revert 中间态
function detectInProgress(gitDirAbs) {
    if (
        fs.existsSync(path.join(gitDirAbs, 'rebase-merge')) ||
        fs.existsSync(path.join(gitDirAbs, 'rebase-apply'))
    ) {
        return 'rebase';
    }
    const markers = [
        ['MERGE_HEAD', 'merge'],
        ['CHERRY_PICK_HEAD', 'cherry-pick'],
        ['REVERT_HEAD', 'revert'],
    ];
    for (const [file, state] of markers) {
        if (fs.existsSync(path.join(gitDirAbs, file))) return state;
    }
    return null;
}

function sumStats(entries) {
    return entries.reduce(
        (acc, entry) => ({
            files: acc.files + 1,
            additions: acc.additions + (entry.additions ?? 0),
            deletions: acc.deletions + (entry.deletions ?? 0),
        }),
        { files: 0, additions: 0, deletions: 0 },
    );
}

function main() {
    const inside = git(['rev-parse', '--is-inside-work-tree'], { allowFail: true });
    if (!inside.ok || inside.out !== 'true') {
        return {
            code: 2,
            payload: { ok: false, error: 'NOT_A_GIT_REPO', message: '当前目录不是 Git 工作区' },
        };
    }

    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
    const head = git(['rev-parse', '--short', 'HEAD'], { allowFail: true });
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFail: true });

    const gitDir = git(['rev-parse', '--git-dir']).out;
    const gitDirAbs = path.resolve(process.cwd(), gitDir);

    const status = parseStatus(git(['status', '--porcelain=v1', '-uall']).out);
    const stagedNumstat = parseNumstat(git(['diff', '--cached', '--numstat']).out);
    const unstagedNumstat = parseNumstat(git(['diff', '--numstat']).out);

    const staged = attachStats(status.staged, stagedNumstat);
    const unstaged = attachStats(status.unstaged, unstagedNumstat);

    const base = {
        ok: true,
        repo: {
            branch: branch.ok ? branch.out : null,
            detached: branch.ok && branch.out === 'HEAD',
            head: head.ok ? head.out : null,
            upstream: upstream.ok ? upstream.out : null,
        },
        inProgress: detectInProgress(gitDirAbs),
    };

    if (staged.length === 0 && unstaged.length === 0 && status.untracked.length === 0) {
        return {
            code: 3,
            payload: { ...base, changes: false, hint: '工作区没有可提交的改动' },
        };
    }

    // 有暂存内容就只看暂存内容，否则看整个工作区
    const diffSource = staged.length > 0 ? 'staged' : 'worktree';
    const rawDiff =
        diffSource === 'staged'
            ? git(['diff', '--cached', '--no-color', '--unified=3']).out
            : git(['diff', '--no-color', '--unified=3']).out;
    const limited = limitDiff(rawDiff);

    const recent = git(['log', `-${RECENT_COMMITS}`, '--pretty=format:%s'], { allowFail: true });

    const selected = diffSource === 'staged' ? staged : unstaged;

    return {
        code: 0,
        payload: {
            ...base,
            changes: true,
            recommendedSource: diffSource,
            staged,
            unstaged,
            untracked: status.untracked,
            stats: sumStats(selected),
            diffSource,
            diff: limited.text,
            diffTruncated: limited.truncated,
            omittedFiles: limited.omittedFiles,
            recentCommits: recent.ok && recent.out ? recent.out.split('\n') : [],
        },
    };
}

function runCli() {
    try {
        const { code, payload } = main();
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        process.exitCode = code;
    } catch (error) {
        process.stderr.write(
            `${JSON.stringify({ ok: false, error: 'UNEXPECTED', message: error.message })}\n`,
        );
        process.exitCode = 1;
    }
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) runCli();
