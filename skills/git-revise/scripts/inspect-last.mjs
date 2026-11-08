// 检查上一次提交的状态：是谁、改了什么、有没有推送出去、工作区是否干净。
// 只读脚本；alreadyPushed 决定后续能不能安全地 amend。
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

// @{u}...HEAD 的第一列是落后数，第二列是领先数
function readAheadBehind() {
    const result = git(['rev-list', '--left-right', '--count', '@{u}...HEAD'], { allowFail: true });
    if (!result.ok || !result.out) return null;
    const [behind, ahead] = result.out.split(/\s+/).map(Number);
    return { ahead, behind };
}

function main() {
    const inside = git(['rev-parse', '--is-inside-work-tree'], { allowFail: true });
    if (!inside.ok || inside.out !== 'true') {
        return {
            code: 2,
            payload: { ok: false, error: 'NOT_A_GIT_REPO', message: '当前目录不是 Git 工作区' },
        };
    }

    const headCheck = git(['rev-parse', '--verify', 'HEAD'], { allowFail: true });
    if (!headCheck.ok) {
        return {
            code: 1,
            payload: {
                ok: false,
                errors: [{ code: 'NO_COMMIT', message: '当前仓库还没有任何提交，无法执行 amend' }],
            },
        };
    }

    const sha = headCheck.out.trim();
    const shortSha = git(['rev-parse', '--short', sha], { allowFail: true }).out;
    const subject = git(['log', '-1', '--pretty=format:%s', sha], { allowFail: true }).out;
    const author = git(['log', '-1', '--pretty=format:%an <%ae>', sha], { allowFail: true }).out;
    const date = git(['log', '-1', '--pretty=format:%ci', sha], { allowFail: true }).out;

    const parentCheck = git(['rev-parse', '--verify', `${sha}^`], { allowFail: true });
    const isInitial = !parentCheck.ok;

    const contains = git(['branch', '-r', '--contains', sha], { allowFail: true });
    const pushedTo = parseRemoteBranches(contains.out);

    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFail: true });

    const status = git(['status', '--porcelain=v1'], { allowFail: true });

    const gitDir = git(['rev-parse', '--git-dir']).out;
    const gitDirAbs = path.resolve(process.cwd(), gitDir);

    return {
        code: 0,
        payload: {
            ok: true,
            head: { sha, shortSha, subject, author, date },
            parent: isInitial ? null : parentCheck.out.trim(),
            isInitial,
            alreadyPushed: pushedTo.length > 0,
            pushedTo,
            aheadBehind: readAheadBehind(),
            repo: {
                branch: branch.ok ? branch.out : null,
                upstream: upstream.ok ? upstream.out : null,
            },
            worktreeClean: status.out.length === 0,
            inProgress: detectInProgress(gitDirAbs),
            advice: pushedTo.length > 0
                ? `该提交已推送到 ${pushedTo.join(', ')}，amend 会产生分叉；建议改用新提交修正，或经用户确认后再改写`
                : '该提交只在本地，可以安全 amend',
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
