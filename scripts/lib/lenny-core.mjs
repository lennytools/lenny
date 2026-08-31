import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateRisk } from '../../skills/ship-conductor/scripts/risk-policy.mjs';

export const MANAGED_START = '<!-- lenny:start -->';
export const MANAGED_END = '<!-- lenny:end -->';
export const MANAGED_PREFIX = '<!-- lenny:managed-block -->';
const REQUIRED_SKILLS = [
  'setup-lenny',
  'ship-conductor',
  'council',
  'outcome-lock',
  'first-principles',
  'elon-first-principles',
  'karpathy',
  'release-manager',
];

export async function installProject({ source, target, dryRun = false }) {
  const sourceRoot = resolve(source);
  const targetRoot = resolve(target);
  assertDirectory(sourceRoot, 'Lenny source');
  assertDirectory(targetRoot, 'target project');
  refuseSymlink(join(targetRoot, '.lenny'));
  refuseSymlink(join(targetRoot, 'AGENTS.md'));
  const version = readText(join(sourceRoot, 'VERSION')).trim();
  const sourceSkills = sourcePath(sourceRoot, 'skills');
  const sourceScripts = sourcePath(sourceRoot, 'scripts', 'bin');
  const expectedFiles = expectedInstallFiles(sourceRoot, sourceSkills, sourceScripts, version);
  for (const skill of REQUIRED_SKILLS) {
    if (!existsSync(join(sourceSkills, skill, 'SKILL.md'))) {
      throw new Error(`source is missing required skill: ${skill}`);
    }
  }

  const agentsPath = join(targetRoot, 'AGENTS.md');
  const oldAgents = existsSync(agentsPath) ? readFileSync(agentsPath) : null;
  const nextAgents = mergeManagedBlock(oldAgents?.toString('utf8') || '', managedAgentsBlock());
  const corePath = join(targetRoot, '.lenny', 'core');
  refuseSymlink(corePath);
  const current = sameInstall(corePath, version, expectedFiles) && nextAgents === (oldAgents?.toString('utf8') || '');

  if (dryRun) {
    return {
      ok: true,
      changed: !current,
      lines: [
        `Lenny ${version} install preview`,
        `  target: ${targetRoot}`,
        `  preserves: existing files outside .lenny/core and the marked AGENTS.md block`,
        `  next: rerun without --dry-run`,
      ],
    };
  }
  if (current) {
    return {
      ok: true,
      changed: false,
      version,
      lines: [
        `Lenny ${version} is already current.`,
        '✓ Managed core integrity verified.',
        '✓ AGENTS.md routing is current.',
      ],
    };
  }

  const stage = mkdtempSync(join(targetRoot, '.lenny-install-'));
  const stageCore = join(stage, 'core');
  const backupCore = join(stage, 'previous-core');
  let coreBackedUp = false;
  let coreInstalled = false;
  try {
    mkdirSync(stageCore, { recursive: true });
    cpSync(sourceSkills, join(stageCore, 'skills'), { recursive: true, dereference: false });
    cpSync(sourceScripts, join(stageCore, 'bin'), { recursive: true, dereference: false });
    writeFileSync(join(stageCore, 'VERSION'), `${version}\n`);
    if (existsSync(join(sourceRoot, 'LICENSE'))) cpSync(join(sourceRoot, 'LICENSE'), join(stageCore, 'LICENSE'));
    writeFileSync(join(stageCore, 'install.json'), `${JSON.stringify({
      schemaVersion: 1,
      version,
      repository: 'https://github.com/lennytools/lenny',
      managedRoot: '.lenny/core',
      files: fileHashes(stageCore, ['install.json']),
    }, null, 2)}\n`);
    injectFailure('after-stage');

    mkdirSync(join(targetRoot, '.lenny'), { recursive: true });
    if (existsSync(corePath)) {
      renameSync(corePath, backupCore);
      coreBackedUp = true;
    }
    renameSync(stageCore, corePath);
    coreInstalled = true;
    injectFailure('after-core');
    atomicWrite(agentsPath, nextAgents);
    injectFailure('after-agents');
    rmSync(stage, { recursive: true, force: true });
  } catch (error) {
    if (coreInstalled && existsSync(corePath)) rmSync(corePath, { recursive: true, force: true });
    if (coreBackedUp && existsSync(backupCore)) renameSync(backupCore, corePath);
    restoreFile(agentsPath, oldAgents);
    rmSync(stage, { recursive: true, force: true });
    removeIfEmpty(join(targetRoot, '.lenny'));
    throw error;
  }

  return {
    ok: true,
    changed: true,
    version,
    lines: [
      `Lenny ${version} installed.`,
      oldAgents ? '✓ Preserved AGENTS.md outside Lenny’s managed block.' : '✓ Created AGENTS.md with Lenny routing.',
      '✓ Installed the versioned core under .lenny/core.',
      'Next: open Codex and say “Set up Lenny.”',
      'Check: node .lenny/core/bin/lenny.mjs doctor',
    ],
  };
}

export async function setupProject({ target, force = false }) {
  const targetRoot = resolve(target);
  assertDirectory(targetRoot, 'target project');
  refuseSymlink(join(targetRoot, '.lenny'));
  const version = readText(join(targetRoot, '.lenny', 'core', 'VERSION')).trim();
  const profilePath = join(targetRoot, '.lenny', 'profile.md');
  refuseSymlink(profilePath);
  if (existsSync(profilePath) && !force) {
    return {
      ok: true,
      changed: false,
      version,
      lines: [
        'Lenny is already set up; .lenny/profile.md was preserved.',
        'Run doctor to verify it: node .lenny/core/bin/lenny.mjs doctor',
      ],
    };
  }
  const observed = detectProject(targetRoot);
  mkdirSync(dirname(profilePath), { recursive: true });
  atomicWrite(profilePath, renderProfile({ version, observed }));
  return {
    ok: true,
    changed: true,
    version,
    observed,
    lines: [
      `Lenny ${version} set up for ${basename(targetRoot)}.`,
      `✓ Stack: ${observed.stack}`,
      `Detected test command: ${observed.commands.test || 'none; resolve in the profile before Doctor can pass'}`,
      `Detected build command: ${observed.commands.build || 'none; resolve in the profile before Doctor can pass'}`,
      '✓ Default council: contract/correctness · failure/security · simplicity/maintainability',
      'Next: review .lenny/profile.md, then run Lenny Doctor.',
    ],
  };
}

export async function doctorProject({ target, deep = false }) {
  const targetRoot = resolve(target);
  const checks = [];
  check(checks, Number(process.versions.node.split('.')[0]) >= 20, 'Node.js 20+', process.version);
  check(checks, isGitRepository(targetRoot), 'Git repository', 'run git init if this should be versioned');
  const core = join(targetRoot, '.lenny', 'core');
  check(checks, existsSync(join(core, 'VERSION')), 'Lenny core', 'rerun the pinned installer');
  check(checks, existsSync(join(core, 'install.json')) && verifyInstallIntegrity(core),
    'managed core local consistency', 'rerun the pinned installer; managed files changed');
  for (const skill of REQUIRED_SKILLS) {
    check(checks, existsSync(join(core, 'skills', skill, 'SKILL.md')), `skill:${skill}`, 'rerun the pinned installer');
  }
  const agents = existsSync(join(targetRoot, 'AGENTS.md')) ? readText(join(targetRoot, 'AGENTS.md')) : '';
  check(checks, count(agents, MANAGED_START) === 1 && count(agents, MANAGED_END) === 1,
    'Codex AGENTS.md routing', 'rerun the installer to repair the managed block');
  check(checks, agents.includes(managedAgentsBlock()),
    'Codex routing integrity', 'rerun the pinned installer; the managed routing block changed');
  const profilePath = join(targetRoot, '.lenny', 'profile.md');
  check(checks, existsSync(profilePath), 'project profile', 'say “Set up Lenny” in Codex or run the setup command');
  if (existsSync(profilePath)) {
    const profile = readText(profilePath);
    check(checks, profile.includes('## Verification commands'), 'profile verification commands', 'rerun setup or repair the profile');
    check(checks, profile.includes('software-implementation'), 'default implementation council', 'restore the council entry');
    check(checks, profile.includes('## Risk policy'), 'risk policy', 'restore the risk policy section');
    for (const label of ['Test', 'Build']) {
      verifyProfileCommand(checks, targetRoot, profile, label, deep);
    }
    for (const label of ['Lint', 'Typecheck']) {
      verifyOptionalProfileCommand(checks, targetRoot, profile, label, deep);
    }
    const liveQa = profileField(profile, 'Live QA');
    check(checks, Boolean(liveQa) && !isUnresolved(liveQa), 'profile live QA',
      'define the real live-QA workflow or explicitly mark it Not applicable with a reason');
  }
  const codex = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 5000 });
  checks.push({
    status: codex.status === 0 ? 'pass' : 'warn',
    name: 'Codex CLI',
    detail: codex.status === 0 ? codex.stdout.trim() : 'CLI not detected; Codex app use may still be valid',
  });
  if (codex.status === 0) {
    const auth = spawnSync('codex', ['login', 'status'], { encoding: 'utf8', timeout: 5000 });
    checks.push({
      status: auth.status === 0 ? 'pass' : 'warn',
      name: 'Codex authentication',
      detail: auth.status === 0
        ? (auth.stdout || auth.stderr).trim()
        : 'not verified; authenticate in the Codex host before an unattended run',
    });
  }
  if (deep && existsSync(join(core, 'skills', 'ship-conductor', 'scripts', 'validate-evidence.test.mjs'))) {
    const evidence = spawnSync(process.execPath,
      [join(core, 'skills', 'ship-conductor', 'scripts', 'validate-evidence.test.mjs')],
      { cwd: targetRoot, encoding: 'utf8', timeout: 30000 });
    check(checks, evidence.status === 0, 'evidence validator self-test', summarizeFailure(evidence));
  }
  if (deep && existsSync(join(core, 'skills', 'outcome-lock', 'scripts', 'validate-outcome.mjs'))) {
    const outcome = spawnSync(process.execPath,
      [join(core, 'skills', 'outcome-lock', 'scripts', 'validate-outcome.mjs'), '--self-test'],
      { cwd: targetRoot, encoding: 'utf8', timeout: 10000 });
    check(checks, outcome.status === 0, 'outcome validator self-test', summarizeFailure(outcome));
  }
  const failures = checks.filter((item) => item.status === 'fail');
  const warnings = checks.filter((item) => item.status === 'warn');
  return {
    ok: failures.length === 0,
    mode: deep ? 'deep' : 'configuration',
    checks,
    failures: failures.length,
    warnings: warnings.length,
    lines: [
      failures.length
        ? 'Lenny Doctor found blocking setup problems.'
        : deep ? 'Lenny Doctor: healthy.' : 'Lenny Doctor: configuration healthy; project commands were not executed.',
      ...checks.map((item) => `${item.status === 'pass' ? '✓' : item.status === 'warn' ? '!' : '✗'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`),
      failures.length
        ? 'Fix the failed checks above, then rerun doctor.'
        : deep ? 'You can now say “Conduct this plan.”' : 'Review .lenny/profile.md, then run doctor --deep true before conducting.',
    ],
  };
}

export async function classifyRisk({
  target,
  files = [],
  description = '',
  forceHigh = false,
  reviewedCommit = '',
  mergeBase = '',
}) {
  const targetRoot = resolve(target);
  if (Boolean(reviewedCommit) !== Boolean(mergeBase)) {
    throw new Error('--reviewed-commit and --merge-base must be supplied together');
  }
  const committedFiles = reviewedCommit
    ? gitDiffFiles(targetRoot, mergeBase, reviewedCommit)
    : [];
  if (reviewedCommit && files.length && !sameStringSet(files, committedFiles)) {
    throw new Error('explicit risk files do not match the reviewed commit diff');
  }
  const changedFiles = reviewedCommit ? committedFiles : (files.length ? files : gitChangedFiles(targetRoot));
  const { riskClass, triggers } = evaluateRisk({ files: changedFiles, description, forceHigh });
  return {
    ok: true,
    schemaVersion: 1,
    reviewedCommit: reviewedCommit || gitHead(targetRoot),
    ...(mergeBase ? { mergeBase } : {}),
    description,
    forceHigh,
    riskClass,
    files: changedFiles,
    triggers,
    rule: riskClass === 'high-stakes'
      ? 'Use the full debate, two-audit and cross-vendor evidence gates.'
      : 'Use one three-seat implementation council and one independent audit; retain tests, build, live QA and done review.',
    lines: [
      `Lenny risk class: ${riskClass}`,
      ...(triggers.length ? triggers.map((item) => `! ${item}`) : ['✓ No high-stakes trigger detected.']),
    ],
  };
}

export async function uninstallProject({ target, dryRun = false }) {
  const targetRoot = resolve(target);
  assertDirectory(targetRoot, 'target project');
  refuseSymlink(join(targetRoot, '.lenny'));
  const agentsPath = join(targetRoot, 'AGENTS.md');
  const corePath = join(targetRoot, '.lenny', 'core');
  const agents = existsSync(agentsPath) ? readText(agentsPath) : '';
  const nextAgents = removeManagedBlock(agents);
  if (dryRun) {
    return { ok: true, changed: existsSync(corePath) || agents !== nextAgents, lines: [
      'Lenny uninstall preview',
      '  removes: .lenny/core and the marked AGENTS.md block',
      '  preserves: .lenny/profile.md, evidence, runs and every unrelated file',
    ] };
  }
  refuseSymlink(corePath);
  refuseSymlink(agentsPath);
  if (existsSync(corePath)) rmSync(corePath, { recursive: true, force: true });
  if (agents !== nextAgents) atomicWrite(agentsPath, nextAgents);
  removeIfEmpty(join(targetRoot, '.lenny'));
  return { ok: true, changed: true, lines: [
    'Lenny core uninstalled.',
    '✓ Preserved .lenny/profile.md, evidence, runs and unrelated project files.',
  ] };
}

export function mergeManagedBlock(existing, block) {
  const range = managedMarkerRange(existing);
  if (range) {
    const { start, end } = range;
    return `${existing.slice(0, start)}${block}${existing.slice(end)}`;
  }
  const separator = existing.length && !existing.endsWith('\n\n') ? (existing.endsWith('\n') ? '\n' : '\n\n') : '';
  return `${existing}${MANAGED_PREFIX}${separator}${block}\n`;
}

export function removeManagedBlock(existing) {
  const range = managedMarkerRange(existing);
  if (!range) return existing;
  const { start, end } = range;
  const prefix = existing.lastIndexOf(MANAGED_PREFIX, start);
  const removeStart = prefix >= 0 ? prefix : start;
  const removeEnd = existing[end] === '\n' ? end + 1 : end;
  return `${existing.slice(0, removeStart)}${existing.slice(removeEnd)}`;
}

function managedMarkerRange(existing) {
  const starts = count(existing, MANAGED_START);
  const ends = count(existing, MANAGED_END);
  const prefixes = count(existing, MANAGED_PREFIX);
  if (starts !== ends || starts > 1) throw new Error('AGENTS.md has malformed or duplicate Lenny managed markers');
  if (!starts && prefixes) throw new Error('AGENTS.md has an orphaned Lenny managed-block prefix');
  if (!starts) return null;
  if (prefixes > 1) throw new Error('AGENTS.md has duplicate Lenny managed-block prefixes');
  const start = existing.indexOf(MANAGED_START);
  const endStart = existing.indexOf(MANAGED_END, start + MANAGED_START.length);
  if (endStart < 0 || existing.indexOf(MANAGED_END) < start) {
    throw new Error('AGENTS.md has malformed or reversed Lenny managed markers');
  }
  return { start, end: endStart + MANAGED_END.length };
}

function managedAgentsBlock() {
  return `${MANAGED_START}\n## Lenny orchestration\n\nLenny is installed under \`.lenny/core\`. Keep project-specific facts in\n\`.lenny/profile.md\`, custom skills in \`.lenny/skills/\` and custom councils in\n\`.lenny/councils/\`; never edit the versioned core in place.\n\n- When the user says **“set up Lenny”** or **“set up my skills”**, read\n  \`.lenny/core/skills/setup-lenny/SKILL.md\` in full and follow it.\n- When the user says **“conduct this plan”** or explicitly invokes Lenny, read\n  \`.lenny/core/skills/ship-conductor/SKILL.md\` in full and follow it.\n- Before either workflow, read \`.lenny/profile.md\` and relevant project-owned\n  skills or councils when they exist.\n- Lenny stops at a pushed merge-ready branch. It never opens or merges a PR.\n${MANAGED_END}`;
}

function sourcePath(root, sourceName, installedName = sourceName) {
  const direct = join(root, sourceName);
  if (existsSync(direct)) return direct;
  const installed = join(root, installedName);
  if (existsSync(installed)) return installed;
  throw new Error(`source is missing ${sourceName}`);
}

function sameInstall(corePath, version, expectedFiles) {
  return existsSync(join(corePath, 'VERSION'))
    && readText(join(corePath, 'VERSION')).trim() === version
    && sameHashMap(fileHashes(corePath, ['install.json']), expectedFiles);
}

function expectedInstallFiles(sourceRoot, sourceSkills, sourceScripts, version) {
  const result = {};
  for (const file of walkFiles(sourceSkills)) {
    result[join('skills', relative(sourceSkills, file))] = sha256(readFileSync(file));
  }
  for (const file of walkFiles(sourceScripts)) {
    result[join('bin', relative(sourceScripts, file))] = sha256(readFileSync(file));
  }
  result.VERSION = sha256(Buffer.from(`${version}\n`));
  if (existsSync(join(sourceRoot, 'LICENSE'))) result.LICENSE = sha256(readFileSync(join(sourceRoot, 'LICENSE')));
  return result;
}

function sameHashMap(left, right) {
  const leftNames = Object.keys(left).sort();
  const rightNames = Object.keys(right).sort();
  return JSON.stringify(leftNames) === JSON.stringify(rightNames)
    && leftNames.every((name) => left[name] === right[name]);
}

function verifyInstallIntegrity(corePath) {
  try {
    const manifest = JSON.parse(readText(join(corePath, 'install.json')));
    if (manifest.schemaVersion !== 1 || !manifest.files || Array.isArray(manifest.files)) return false;
    const actual = fileHashes(corePath, ['install.json']);
    const expectedNames = Object.keys(manifest.files).sort();
    const actualNames = Object.keys(actual).sort();
    if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) return false;
    return expectedNames.every((name) => manifest.files[name] === actual[name]);
  } catch {
    return false;
  }
}

function fileHashes(root, excluded = []) {
  const excludedSet = new Set(excluded);
  const result = {};
  for (const file of walkFiles(root)) {
    const name = file.slice(root.length + 1);
    if (!excludedSet.has(name)) result[name] = sha256(readFileSync(file));
  }
  return result;
}

function walkFiles(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(path));
    else if (entry.isFile()) result.push(path);
    else throw new Error(`managed core contains unsupported filesystem entry: ${path}`);
  }
  return result;
}

function detectProject(root) {
  const packagePath = join(root, 'package.json');
  const result = { stack: 'unknown', packageManager: null, commands: {} };
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readText(packagePath));
    const manager = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm'
      : existsSync(join(root, 'yarn.lock')) ? 'yarn'
      : existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb')) ? 'bun'
      : 'npm';
    result.stack = 'Node.js';
    result.packageManager = manager;
    for (const name of ['test', 'build', 'lint', 'typecheck']) {
      if (pkg.scripts?.[name]) result.commands[name] = manager === 'npm' ? `npm run ${name}` : `${manager} ${name}`;
    }
  } else if (existsSync(join(root, 'Cargo.toml'))) {
    result.stack = 'Rust';
    result.commands = { test: 'cargo test', build: 'cargo build', lint: 'cargo clippy --all-targets --all-features' };
  } else if (existsSync(join(root, 'go.mod'))) {
    result.stack = 'Go';
    result.commands = { test: 'go test ./...', build: 'go build ./...', lint: 'go vet ./...' };
  } else if (existsSync(join(root, 'pyproject.toml'))) {
    result.stack = 'Python';
  }
  return result;
}

function profileField(profile, label) {
  const match = profile.match(new RegExp(`^- ${label}: (.*)$`, 'm'));
  return match?.[1]?.trim() || '';
}

function profileCommand(profile, label) {
  const value = profileField(profile, label);
  const match = value.match(/`([^`]+)`/);
  return match?.[1]?.trim() || '';
}

function isUnresolved(value) {
  return !value || /not detected|verify before conducting/i.test(value);
}

function isNotApplicable(value) {
  return /^\*\*Not applicable\b|^Not applicable\b/i.test(value);
}

function verifyProfileCommand(checks, root, profile, label, deep) {
  const value = profileField(profile, label);
  const command = profileCommand(profile, label);
  if (isNotApplicable(value)) {
    check(checks, true, `${label.toLowerCase()} verification`, 'explicitly not applicable');
    return;
  }
  if (isUnresolved(value) || !command) {
    check(checks, false, `${label.toLowerCase()} verification`,
      `set a reviewed command in backticks or explicitly mark ${label} Not applicable with a reason`);
    return;
  }
  if (!deep) {
    checks.push({
      status: 'pass',
      name: `${label.toLowerCase()} command configured`,
      detail: 'configured; not executed by ordinary Doctor',
    });
    return;
  }
  const result = spawnSync(command, { cwd: root, encoding: 'utf8', shell: true, timeout: 120000 });
  check(checks, result.status === 0, `${label.toLowerCase()} command`, summarizeFailure(result));
}

function verifyOptionalProfileCommand(checks, root, profile, label, deep) {
  const value = profileField(profile, label);
  const command = profileCommand(profile, label);
  if (!command) return;
  if (!deep) {
    checks.push({
      status: 'pass',
      name: `${label.toLowerCase()} command configured`,
      detail: 'configured; not executed by ordinary Doctor',
    });
    return;
  }
  const result = spawnSync(command, { cwd: root, encoding: 'utf8', shell: true, timeout: 120000 });
  check(checks, result.status === 0, `${label.toLowerCase()} command`, summarizeFailure(result));
}

function renderProfile({ version, observed }) {
  const command = (name) => observed.commands[name] ? `\`${observed.commands[name]}\`` : '**Not detected — verify before conducting.**';
  return `# Lenny Project Profile\n\nThis is the project-specific source of truth read by Lenny. It is preserved\nacross core updates. Edit observed facts only after verifying them in this\nrepository.\n\n## Installation\n\n- Profile schema: 1\n- Host: Codex\n- Stack: ${observed.stack}\n- Package manager: ${observed.packageManager || 'not detected'}\n\n## Verification commands\n\n- Test: ${command('test')}\n- Build: ${command('build')}\n- Lint: ${command('lint')}\n- Typecheck: ${command('typecheck')}\n- Live QA: **Not detected — define the actual user-visible workflow before conducting.**\n\nNever claim a command passed without running that exact command successfully in\nthe current repository.\n\n## Council\n\nDefault: \`software-implementation\`\n\n- Contract / correctness: does the implementation satisfy the frozen outcome?\n- Failure / security: how can it fail, lose data or violate authority?\n- Simplicity / maintainability: is it the smallest coherent change with honest boundaries?\n\nThe council definition lives at\n\`.lenny/core/skills/council/references/software-implementation-council.md\`.\n\n## Risk policy\n\n- Default: automatic\n- Standard: one three-seat implementation council and one independent audit,\n  while retaining tests, build, leak scan, live QA and done review.\n- High-stakes: full debate, two independent audits and cross-vendor review when\n  authorized and available.\n- High-stakes triggers include authentication, authorization, secrets, money,\n  custody, destructive persistence, migrations, production infrastructure and\n  security-sensitive behavior. Uncertainty escalates to high-stakes.\n\n## Merge policy\n\nLenny may create and push a branch. It must stop at merge-ready. The human opens\nthe pull request and merges.\n\n## Project-specific rails\n\n- Preserve existing user files and instructions outside Lenny-managed paths.\n- Add repository-specific security, data and operational rails here.\n`;
}

function gitChangedFiles(root) {
  if (!isGitRepository(root)) return [];
  const result = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').filter(Boolean).map((line) => line.slice(3)).filter(Boolean);
}

function gitDiffFiles(root, mergeBase, reviewedCommit) {
  if (!isGitRepository(root)) throw new Error('reviewed risk classification requires a Git repository');
  const ancestor = spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', mergeBase, reviewedCommit]);
  if (ancestor.status !== 0) throw new Error('merge base is not an ancestor of the reviewed commit');
  const result = spawnSync('git', ['-C', root, 'diff', '--name-only', `${mergeBase}..${reviewedCommit}`], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('cannot derive files from the reviewed commit diff');
  return result.stdout.split('\n').map((item) => item.trim()).filter(Boolean).sort();
}

function sameStringSet(left, right) {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
}

function isGitRepository(root) {
  const result = spawnSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === 'true';
}

function gitHead(root) {
  if (!isGitRepository(root)) return 'not-a-git-repository';
  const result = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function atomicWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${basename(path)}.lenny-${process.pid}-${Date.now()}`);
  writeFileSync(temp, contents);
  renameSync(temp, path);
}

function restoreFile(path, bytes) {
  if (bytes === null) {
    if (existsSync(path)) rmSync(path, { force: true });
  } else {
    atomicWrite(path, bytes);
  }
}

function removeIfEmpty(path) {
  if (existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length === 0) rmSync(path, { recursive: true });
}

function assertDirectory(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error(`${label} is not a directory: ${path}`);
}

function refuseSymlink(path) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`refusing to modify symlink: ${path}`);
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function check(checks, passed, name, detail = '') {
  checks.push({ status: passed ? 'pass' : 'fail', name, detail: passed ? '' : detail });
}

function summarizeFailure(result) {
  return (result.stderr || result.stdout || `exit ${result.status}`).trim().split('\n').slice(-2).join(' ');
}

function injectFailure(point) {
  if (process.env.LENNY_TEST_FAIL_AT === point) throw new Error(`injected install failure at ${point}`);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
