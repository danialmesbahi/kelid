// راه‌اندازی یک‌بارهٔ پروژه روی سیستم تازه: `npm run setup`
// نصب وابستگی‌ها، git hookها، graphify (گراف پروژه برای ایجنت‌ها) و یک بررسی کامل.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const step = (m) => console.log(`\n▸ ${m}`);
const has = (cmd) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' }).status === 0;
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

step('Node');
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(`  ✗ Node ${process.versions.node}; Node 22 or newer is required (https://nodejs.org).`);
  process.exit(1);
}
ok(`Node ${process.versions.node}`);

step('Dependencies (npm ci)');
run('npm ci');
ok('installed — a warning that better-sqlite3-multiple-ciphers "node-gyp rebuild" was blocked is expected; do not approve it');

step('Git hooks');
const hooks = join(root, '.git', 'hooks');
if (existsSync(hooks)) {
  // GitHub رایگان برای مخزن خصوصی قفل شاخه ندارد؛ این hook جلوی push مستقیم به main را می‌گیرد.
  const prePush = join(hooks, 'pre-push');
  const marker = '# kelid: protect main';
  const guard = `${marker}
while read local_ref local_sha remote_ref remote_sha; do
  if [ "$remote_ref" = "refs/heads/main" ] && [ "$KELID_ALLOW_MAIN" != "1" ]; then
    echo "kelid: do not push to main directly. Push your branch and open a PR (gh pr create)."
    echo "       Owner-only exception: KELID_ALLOW_MAIN=1 git push"
    exit 1
  fi
done
`;
  const current = existsSync(prePush) ? readFileSync(prePush, 'utf8') : '';
  if (!current.includes(marker)) {
    writeFileSync(prePush, current ? `${current.trimEnd()}\n\n${guard}` : `#!/bin/sh\n${guard}`);
    chmodSync(prePush, 0o755);
  }
  ok('pre-push guard for main');
} else warn('not a git clone; skipped hooks');

step('graphify (project knowledge graph for AI agents)');
if (!has('graphify') && has('uv')) {
  try {
    run('uv tool install graphifyy');
  } catch {
    warn('uv tool install graphifyy failed');
  }
}
if (has('graphify')) {
  try {
    run('graphify hook install');
    run('graphify install --platform claude');
    ok('graph auto-updates after each commit; /graphify skill installed for Claude Code');
  } catch {
    warn('graphify is installed but hook/skill setup failed; run "graphify hook install" manually');
  }
} else {
  warn('graphify not found. Install uv (https://docs.astral.sh/uv/) then: uv tool install graphifyy && npm run setup');
  warn('The committed graph in graphify-out/ still works for reading without it.');
}

step('Checks (lint + typecheck + tests)');
run('npm run lint');
run('npm run typecheck');
run('npm test');

console.log(`
✓ Ready.
  npm run dev           web app on http://localhost:5173
  npm run dev:desktop   Windows app
  Next task:            gh issue list --milestone "Phase 1 — Offline single device"
  In Claude Code:       /kelid-task   ·   /kelid-sync   ·   /kelid-ship
`);
