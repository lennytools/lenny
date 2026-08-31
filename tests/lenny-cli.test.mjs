import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  classifyRisk,
  doctorProject,
  installProject,
  MANAGED_END,
  MANAGED_START,
  mergeManagedBlock,
  removeManagedBlock,
  setupProject,
  uninstallProject,
} from '../scripts/lib/lenny-core.mjs';

const source = dirname(dirname(fileURLToPath(import.meta.url)));
const created = [];

test.after(() => {
  for (const path of created) rmSync(path, { recursive: true, force: true });
});

test('installs into a non-empty project without changing user-authored content', async () => {
  const target = fixture();
  const original = '# Existing project rules\n\nKeep this sentence byte-for-byte.\n';
  writeFileSync(join(target, 'AGENTS.md'), original);
  mkdirSync(join(target, 'skills', 'custom'), { recursive: true });
  writeFileSync(join(target, 'skills', 'custom', 'SKILL.md'), 'personal\n');

  const first = await installProject({ source, target });
  assert.equal(first.ok, true);
  const agents = text(target, 'AGENTS.md');
  assert(agents.startsWith(original));
  assert.equal(instances(agents, MANAGED_START), 1);
  assert.equal(instances(agents, MANAGED_END), 1);
  assert.equal(text(target, 'skills/custom/SKILL.md'), 'personal\n');
  assert.equal(text(target, '.lenny/core/VERSION').trim(), '0.1.0');

  const installedHash = treeHash(join(target, '.lenny', 'core'));
  const agentsHash = sha256(readFileSync(join(target, 'AGENTS.md')));
  const second = await installProject({ source, target });
  assert.equal(second.changed, false);
  assert.equal(treeHash(join(target, '.lenny', 'core')), installedHash);
  assert.equal(sha256(readFileSync(join(target, 'AGENTS.md'))), agentsHash);
});

test('doctor detects managed-core tampering and reinstall repairs it', async () => {
  const target = fixture({ nodeProject: true });
  await installProject({ source, target });
  await setupProject({ target });
  resolveLiveQa(target);
  const skill = join(target, '.lenny/core/skills/setup-lenny/SKILL.md');
  writeFileSync(skill, `${readFileSync(skill, 'utf8')}\ntampered\n`);
  const unhealthy = await doctorProject({ target, deep: false });
  assert.equal(unhealthy.ok, false);
  assert(unhealthy.checks.some((item) => item.name === 'managed core local consistency' && item.status === 'fail'));
  const repair = await installProject({ source, target });
  assert.equal(repair.changed, true);
  assert.equal((await doctorProject({ target, deep: false })).ok, true);
});

test('reinstall compares managed bytes with the trusted source, not a forged local manifest', async () => {
  const target = fixture({ nodeProject: true });
  await installProject({ source, target });
  await setupProject({ target });
  resolveLiveQa(target);
  const core = join(target, '.lenny/core');
  const skill = join(core, 'skills/setup-lenny/SKILL.md');
  writeFileSync(skill, `${readFileSync(skill, 'utf8')}\nmalicious local instruction\n`);
  const manifestPath = join(core, 'install.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.files = Object.fromEntries(walk(core)
    .filter((file) => file !== manifestPath)
    .map((file) => [relative(core, file), sha256(readFileSync(file))]));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  // Doctor's colocated manifest detects accidental drift, not a hostile local
  // rewrite of both code and manifest. A fresh trusted installer must repair it.
  assert.equal((await doctorProject({ target, deep: false })).ok, true);
  const repair = await installProject({ source, target });
  assert.equal(repair.changed, true);
  assert(!readFileSync(skill, 'utf8').includes('malicious local instruction'));
});

test('rolls an interrupted update back to the previous bytes', async () => {
  const target = fixture();
  writeFileSync(join(target, 'AGENTS.md'), '# Existing\n');
  await installProject({ source, target });
  const currentSkill = join(target, '.lenny/core/skills/setup-lenny/SKILL.md');
  writeFileSync(currentSkill, `${readFileSync(currentSkill, 'utf8')}\nlocal pre-update bytes\n`);
  const coreHash = treeHash(join(target, '.lenny', 'core'));
  const agentsHash = sha256(readFileSync(join(target, 'AGENTS.md')));
  process.env.LENNY_TEST_FAIL_AT = 'after-core';
  try {
    await assert.rejects(() => installProject({ source, target }), /injected install failure/);
  } finally {
    delete process.env.LENNY_TEST_FAIL_AT;
  }
  assert.equal(treeHash(join(target, '.lenny', 'core')), coreHash);
  assert.equal(sha256(readFileSync(join(target, 'AGENTS.md'))), agentsHash);
});

test('refuses ambiguous managed markers rather than guessing', async () => {
  const target = fixture();
  writeFileSync(join(target, 'AGENTS.md'), `${MANAGED_START}\nmissing end\n`);
  await assert.rejects(() => installProject({ source, target }), /malformed or duplicate/);
  assert.equal(text(target, 'AGENTS.md'), `${MANAGED_START}\nmissing end\n`);
});

test('refuses reversed managed markers rather than corrupting instructions', async () => {
  const target = fixture();
  const reversed = `${MANAGED_END}\nuser content\n${MANAGED_START}\n`;
  writeFileSync(join(target, 'AGENTS.md'), reversed);
  await assert.rejects(() => installProject({ source, target }), /malformed or reversed/);
  assert.equal(text(target, 'AGENTS.md'), reversed);
});

test('managed AGENTS block round-trips user bytes exactly', () => {
  const block = `${MANAGED_START}\nmanaged\n${MANAGED_END}`;
  for (const original of ['', '# User', '# User\n', '# User\n\n', '# User\n\n\n', '\n# User\n\n']) {
    assert.equal(removeManagedBlock(mergeManagedBlock(original, block)), original);
  }
});

test('refuses symlinked managed targets', async () => {
  const target = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'lenny-outside-'));
  created.push(outside);
  symlinkSync(outside, join(target, '.lenny'));
  await assert.rejects(() => installProject({ source, target }), /refusing to modify symlink/);
  assert.equal(readdirSync(outside).length, 0);
});

test('uninstall refuses a symlinked .lenny ancestor', async () => {
  const target = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'lenny-outside-uninstall-'));
  created.push(outside);
  mkdirSync(join(outside, 'core'), { recursive: true });
  writeFileSync(join(outside, 'core', 'victim.txt'), 'preserve\n');
  symlinkSync(outside, join(target, '.lenny'));
  await assert.rejects(() => uninstallProject({ target }), /refusing to modify symlink/);
  assert.equal(text(outside, 'core/victim.txt'), 'preserve\n');
});

test('setup detects verified Node commands and preserves a reviewed profile', async () => {
  const target = fixture({ nodeProject: true });
  await installProject({ source, target });
  const setup = await setupProject({ target });
  assert.equal(setup.observed.stack, 'Node.js');
  const profile = text(target, '.lenny/profile.md');
  assert(profile.includes('`npm run test`'));
  assert(profile.includes('`npm run build`'));
  assert(profile.includes('software-implementation'));
  writeFileSync(join(target, '.lenny', 'profile.md'), `${profile}\nFounder verified note.\n`);
  const second = await setupProject({ target });
  assert.equal(second.changed, false);
  assert(text(target, '.lenny/profile.md').endsWith('Founder verified note.\n'));
});

test('doctor is actionable before setup and healthy after setup', async () => {
  const target = fixture({ nodeProject: true });
  await installProject({ source, target });
  const before = await doctorProject({ target, deep: false });
  assert.equal(before.ok, false);
  assert(before.checks.some((item) => item.name === 'project profile' && item.status === 'fail'));
  await setupProject({ target });
  resolveLiveQa(target);
  const after = await doctorProject({ target, deep: true });
  assert.equal(after.ok, true, JSON.stringify(after.checks, null, 2));
});

test('doctor fails unresolved setup and failing verification commands', async () => {
  const target = fixture({ nodeProject: true });
  const pkg = JSON.parse(text(target, 'package.json'));
  pkg.scripts.test = "node -e \"process.exit(7)\"";
  writeFileSync(join(target, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  await installProject({ source, target });
  await setupProject({ target });
  const unresolved = await doctorProject({ target, deep: true });
  assert.equal(unresolved.ok, false);
  assert(unresolved.checks.some((item) => item.name === 'profile live QA' && item.status === 'fail'));
  resolveLiveQa(target);
  const failed = await doctorProject({ target, deep: true });
  assert.equal(failed.ok, false);
  assert(failed.checks.some((item) => item.name === 'test command' && item.status === 'fail'));
});

test('ordinary doctor never executes commands preserved in a project profile', async () => {
  const target = fixture({ nodeProject: true });
  await installProject({ source, target });
  await setupProject({ target });
  resolveLiveQa(target);
  const marker = join(target, 'doctor-must-not-run.txt');
  const profilePath = join(target, '.lenny', 'profile.md');
  const profile = readFileSync(profilePath, 'utf8').replace(
    /- Test: .*/,
    `- Test: \`node -e "require('node:fs').writeFileSync('${marker}', 'executed')"\``,
  );
  writeFileSync(profilePath, profile);

  const result = await doctorProject({ target });
  assert.equal(result.ok, true, JSON.stringify(result.checks, null, 2));
  assert.equal(result.mode, 'configuration');
  assert(result.lines[0].includes('commands were not executed'));
  assert.throws(() => statSync(marker));
  assert(result.checks.some((item) => item.name === 'test command configured' && item.status === 'pass'
    && item.detail.includes('configured; not executed')));
});

test('risk selection is deterministic and fails upward', async () => {
  const target = fixture();
  const standard = await classifyRisk({ target, files: ['src/format-date.js'] });
  assert.equal(standard.riskClass, 'standard');
  const migration = await classifyRisk({ target, files: ['db/migrations/002-drop-table.sql'] });
  assert.equal(migration.riskClass, 'high-stakes');
  assert(migration.triggers.includes('data migration or destructive persistence'));
  const installer = await classifyRisk({ target, files: ['scripts/install.sh', '.github/workflows/release.yml'] });
  assert.equal(installer.riskClass, 'high-stakes');
  assert(installer.triggers.includes('installer or package supply chain'));
  const override = await classifyRisk({ target, files: ['README.md'], forceHigh: true });
  assert.equal(override.riskClass, 'high-stakes');
});

test('reviewed risk derives the exact committed diff and rejects partial inventories', async () => {
  const target = fixture();
  const mergeBase = run('git', ['rev-parse', 'HEAD'], {}, target, true).stdout.trim();
  mkdirSync(join(target, 'scripts'), { recursive: true });
  writeFileSync(join(target, 'scripts/install.sh'), '#!/bin/sh\n');
  run('git', ['add', 'scripts/install.sh'], {}, target, true);
  run('git', ['commit', '-qm', 'add installer'], {}, target, true);
  const reviewedCommit = run('git', ['rev-parse', 'HEAD'], {}, target, true).stdout.trim();
  const risk = await classifyRisk({ target, reviewedCommit, mergeBase });
  assert.equal(risk.riskClass, 'high-stakes');
  assert.deepEqual(risk.files, ['scripts/install.sh']);
  assert.equal(risk.mergeBase, mergeBase);
  await assert.rejects(() => classifyRisk({
    target, reviewedCommit, mergeBase, files: ['README.md'],
  }), /do not match/);
});

test('deterministic gate runner records real success and failure exits', () => {
  const target = fixture();
  const reviewedCommit = run('git', ['rev-parse', 'HEAD'], {}, target, true).stdout.trim();
  const runner = join(source, 'skills', 'ship-conductor', 'scripts', 'run-gate.mjs');
  const passedPath = join(target, '.lenny', 'passed.json');
  const passed = run(process.execPath, [runner,
    '--gate-id', 'tests', '--kind', 'test', '--reviewed-commit', reviewedCommit,
    '--output', passedPath, '--', process.execPath, '-e', "console.log('ok')"], {}, target);
  assert.equal(passed.status, 0, passed.stderr);
  const passedReceipt = JSON.parse(readFileSync(passedPath, 'utf8'));
  assert.equal(passedReceipt.verdict, 'PASS');
  assert.equal(passedReceipt.exitCode, 0);
  assert.deepEqual(passedReceipt.command.slice(0, 2), [process.execPath, '-e']);
  assert.match(passedReceipt.outputSha256, /^[0-9a-f]{64}$/);

  const failedPath = join(target, '.lenny', 'failed.json');
  const failed = run(process.execPath, [runner,
    '--gate-id', 'build', '--kind', 'build', '--reviewed-commit', reviewedCommit,
    '--output', failedPath, '--', process.execPath, '-e', 'process.exit(9)'], {}, target);
  assert.equal(failed.status, 9);
  const failedReceipt = JSON.parse(readFileSync(failedPath, 'utf8'));
  assert.equal(failedReceipt.verdict, 'FAIL');
  assert.equal(failedReceipt.exitCode, 9);
});

test('uninstall removes only managed core and routing', async () => {
  const target = fixture({ nodeProject: true });
  const original = '# User rules\n';
  writeFileSync(join(target, 'AGENTS.md'), original);
  await installProject({ source, target });
  await setupProject({ target });
  mkdirSync(join(target, '.lenny', 'evidence'), { recursive: true });
  writeFileSync(join(target, '.lenny', 'evidence', 'keep.txt'), 'keep\n');
  await uninstallProject({ target });
  assert.equal(text(target, 'AGENTS.md'), original);
  assert.equal(text(target, '.lenny/profile.md').includes('# Lenny Project Profile'), true);
  assert.equal(text(target, '.lenny/evidence/keep.txt'), 'keep\n');
  assert.throws(() => statSync(join(target, '.lenny', 'core')));
});

test('the public shell installer completes the Codex setup contract', () => {
  const target = fixture({ nodeProject: true });
  writeFileSync(join(target, 'AGENTS.md'), '# Existing instructions\n');
  const install = run('sh', [join(source, 'scripts', 'install.sh'), '--target', target], {
    LENNY_SOURCE_DIR: source,
  });
  assert.equal(install.status, 0, install.stderr);
  assert(install.stdout.includes('Next: open Codex and say “Set up Lenny.”'));
  assert.equal(run(process.execPath, [join(target, '.lenny/core/bin/lenny.mjs'), 'setup', '--target', target]).status, 0);
  resolveLiveQa(target);
  const doctor = run(process.execPath,
    [join(target, '.lenny/core/bin/lenny.mjs'), 'doctor', '--target', target, '--json']);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.equal(JSON.parse(doctor.stdout).ok, true);
  assert.equal(run('npm', ['run', 'test'], {}, target).status, 0);
  assert.equal(run('npm', ['run', 'build'], {}, target).status, 0);
});

test('public commands reject typos and unsupported mutating options', async () => {
  const target = fixture({ nodeProject: true });
  await installProject({ source, target });
  const cli = join(target, '.lenny/core/bin/lenny.mjs');
  const typo = run(process.execPath, [cli, 'uninstall', '--targte', target], {}, target);
  assert.notEqual(typo.status, 0);
  assert(typo.stderr.includes('unsupported option'));
  assert.equal(statSync(join(target, '.lenny/core')).isDirectory(), true);
  const unsupported = run(process.execPath, [cli, 'setup', '--dry-run'], {}, target);
  assert.notEqual(unsupported.status, 0);
  assert(unsupported.stderr.includes('unsupported option'));
  assert.throws(() => statSync(join(target, '.lenny/profile.md')));
});

test('every public command has non-destructive help', () => {
  const cli = join(source, 'scripts', 'lenny.mjs');
  for (const command of ['install', 'setup', 'doctor', 'risk', 'uninstall', 'version']) {
    const result = run(process.execPath, [cli, command, '--help']);
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
    assert(result.stdout.includes(`Lenny ${command}`));
    assert(result.stdout.includes('Usage:'));
  }
});

test('the public conductor stays compact and installs phase-specific references', async () => {
  const conductor = readFileSync(join(source, 'skills/ship-conductor/SKILL.md'), 'utf8');
  assert(conductor.split('\n').length <= 250, 'public conductor exceeded the 250-line startup budget');
  assert(conductor.includes('Do not add `.lenny/runs/` to the evidence commit.'));
  const target = fixture();
  await installProject({ source, target });
  const evidenceContract = text(target,
    '.lenny/core/skills/ship-conductor/references/evidence-contract.md');
  assert.equal(evidenceContract.includes('# Evidence Contract'), true);
  assert.equal(evidenceContract.includes('The final closeout commit contains'), true);
  assert.equal(text(target, '.lenny/core/skills/ship-conductor/references/high-stakes-audit.md')
    .includes('# High-Stakes Audit'), true);
});

function fixture({ nodeProject = false } = {}) {
  const target = mkdtempSync(join(tmpdir(), 'lenny-project-'));
  created.push(target);
  run('git', ['init', '-q'], {}, target, true);
  run('git', ['config', 'user.email', 'lenny@test.local'], {}, target, true);
  run('git', ['config', 'user.name', 'Lenny Test'], {}, target, true);
  writeFileSync(join(target, 'README.md'), '# Fixture\n');
  if (nodeProject) {
    writeFileSync(join(target, 'package.json'), `${JSON.stringify({
      name: 'fixture', private: true,
      scripts: {
        test: "node -e \"console.log('tests pass')\"",
        build: "node -e \"console.log('build passes')\"",
      },
    }, null, 2)}\n`);
    writeFileSync(join(target, 'package-lock.json'), '{}\n');
  }
  run('git', ['add', '.'], {}, target, true);
  run('git', ['commit', '-qm', 'fixture'], {}, target, true);
  return target;
}

function run(command, args, env = {}, cwd = source, throwOnError = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 60000,
  });
  if (throwOnError && result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result;
}

function text(root, path) {
  return readFileSync(join(root, path), 'utf8');
}

function resolveLiveQa(target) {
  const path = join(target, '.lenny/profile.md');
  const profile = readFileSync(path, 'utf8').replace(
    '- Live QA: **Not detected — define the actual user-visible workflow before conducting.**',
    '- Live QA: **Not applicable — fixture has no user-facing runtime; exported behavior is covered by tests.**',
  );
  writeFileSync(path, profile);
}

function instances(value, needle) {
  return value.split(needle).length - 1;
}

function treeHash(root) {
  const hash = createHash('sha256');
  for (const file of walk(root).sort()) {
    hash.update(relative(root, file));
    hash.update(readFileSync(file));
  }
  return hash.digest('hex');
}

function walk(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
