// 评估一次撤销操作的风险：目标提交是否已推送、是否还能找回。
// 只读脚本，不修改任何东西；它输出的事实决定后续用 reset 还是 revert。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

// 从 `git branch -r --contains` 的输出里提取远程分支名
function parseRemoteBranches(raw) {
    return raw
        .split('\n')
        .map((line) => line.replace(/^\*?\s*/, '').trim())
        .filter((line) => line && !line.includes('->'));
}

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

function main() {
    const inside = git(['rev-parse', '--is-inside-work-tree'], { allowFail: true });
    if (!inside.ok || inside.out !== 'true') {
        return {
            code: 2,
            payload: { ok: false, error: 'NOT_A_GIT_REPO', message: '当前目录不是 Git 工作区' },
        };
    }

    const args = process.argv.slice(2);
    const targetIndex = args.indexOf('--target');
    const target = targetIndex === -1 ? 'HEAD' : args[targetIndex + 1];

    const resolved = git(['rev-parse', '--verify', `${target}^{commit}`], { allowFail: true });
    if (!resolved.ok) {
        return {
            code: 1,
            payload: {
                ok: false,
                errors: [{ code: 'INVALID_TARGET', message: `无法解析目标提交：${target}` }],
            },
        };
    }

    const sha = resolved.out.trim();
    const shortSha = git(['rev-parse', '--short', sha], { allowFail: true }).out;
    const subject = git(['log', '-1', '--pretty=format:%s', sha], { allowFail: true }).out;

    const contains = git(['branch', '-r', '--contains', sha], { allowFail: true });
    const pushedTo = parseRemoteBranches(contains.out);
    const alreadyPushed = pushedTo.length > 0;

    const commitsAfterRaw = git(['rev-list', '--count', `${sha}..HEAD`], { allowFail: true }).out;
    const commitsAfter = Number(commitsAfterRaw || 0);

    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFail: true });

    // reflog 未过期时提交对象仍然存在，因此还能找回
    const recoverable = git(['cat-file', '-e', sha], { allowFail: true }).ok;

    const status = git(['status', '--porcelain=v1'], { allowFail: true });
    const worktreeDirty = status.out.length > 0;

    const gitDir = git(['rev-parse', '--git-dir']).out;
    const gitDirAbs = path.resolve(process.cwd(), gitDir);

    const advice = alreadyPushed
        ? '目标提交已在远程分支上，应使用 revert 生成反向提交；不要 reset 后 force push'
        : '目标提交只在本地，可用 reset 回退；--soft/--mixed 保留改动，--hard 会丢弃';

    return {
        code: 0,
        payload: {
            ok: true,
            target: { sha, shortSha, subject },
            alreadyPushed,
            pushedTo,
            commitsAfter,
            repo: {
                branch: branch.ok ? branch.out : null,
                upstream: upstream.ok ? upstream.out : null,
            },
            recoverable,
            worktreeDirty,
            inProgress: detectInProgress(gitDirAbs),
            advice,
        },
    };
}

function runCli() {
    try {
        const { code, payload } = main();
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        process.exitCode = code;
    } catch (error) {
        process.stderr.write(`${JSON.stringify({ ok: false, error: 'UNEXPECTED', message: error.message })}\n`);
        process.exitCode = 1;
    }
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invoked) runCli();
