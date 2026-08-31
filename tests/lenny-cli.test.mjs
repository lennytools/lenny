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
  const skill = join(target, '.lenny/core/skills/setup-lenny/SKILL.md');
  writeFileSync(skill, `${readFileSync(skill, 'utf8')}\ntampered\n`);
  const unhealthy = await doctorProject({ target, deep: false });
  assert.equal(unhealthy.ok, false);
  assert(unhealthy.checks.some((item) => item.name === 'managed core integrity' && item.status === 'fail'));
  const repair = await installProject({ source, target });
  assert.equal(repair.changed, true);
  assert.equal((await doctorProject({ target, deep: false })).ok, true);
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

test('refuses symlinked managed targets', async () => {
  const target = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'lenny-outside-'));
  created.push(outside);
  symlinkSync(outside, join(target, '.lenny'));
  await assert.rejects(() => installProject({ source, target }), /refusing to modify symlink/);
  assert.equal(readdirSync(outside).length, 0);
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
  const after = await doctorProject({ target, deep: true });
  assert.equal(after.ok, true, JSON.stringify(after.checks, null, 2));
});

test('risk selection is deterministic and fails upward', async () => {
  const target = fixture();
  const standard = await classifyRisk({ target, files: ['src/format-date.js'] });
  assert.equal(standard.riskClass, 'standard');
  const migration = await classifyRisk({ target, files: ['db/migrations/002-drop-table.sql'] });
  assert.equal(migration.riskClass, 'high-stakes');
  assert(migration.triggers.includes('data migration or destructive persistence'));
  const override = await classifyRisk({ target, files: ['README.md'], forceHigh: true });
  assert.equal(override.riskClass, 'high-stakes');
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
  const doctor = run(process.execPath,
    [join(target, '.lenny/core/bin/lenny.mjs'), 'doctor', '--target', target, '--json']);
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.equal(JSON.parse(doctor.stdout).ok, true);
  assert.equal(run('npm', ['run', 'test'], {}, target).status, 0);
  assert.equal(run('npm', ['run', 'build'], {}, target).status, 0);
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
  const target = fixture();
  await installProject({ source, target });
  assert.equal(text(target, '.lenny/core/skills/ship-conductor/references/evidence-contract.md')
    .includes('# Evidence Contract'), true);
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
