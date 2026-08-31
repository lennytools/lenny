#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateRisk, requiredCouncilsForRisk } from './risk-policy.mjs';

const outcomeValidator = fileURLToPath(new URL('../../outcome-lock/scripts/validate-outcome.mjs', import.meta.url));

const dir = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: validate-evidence.mjs <evidence-dir>');
const claimMergeReady = process.argv.includes('--claim-merge-ready');
const manifestBytes = readFileSync(resolve(dir, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const claimScope = manifest.claim?.scope;
const deterministicKinds = new Set(['test', 'build', 'leak_scan', 'live_qa']);
const realDir = realpathSync(dir);
let repoRoot = null;
for (const key of ['runId', 'reviewedCommit', 'mergeBase', 'diffSha256']) {
  if (typeof manifest[key] !== 'string' || !manifest[key]) throw new Error(`missing ${key}`);
}
if (claimScope !== 'fleet') {
  repoRoot = realpathSync(gitText(['-C', dir, 'rev-parse', '--show-toplevel']));
  const actualMergeBase = gitText(['-C', repoRoot, 'merge-base', manifest.mergeBase, manifest.reviewedCommit]);
  if (actualMergeBase !== manifest.mergeBase) throw new Error('merge-base mismatch');
  const diffArgs = manifest.mergeBase === manifest.reviewedCommit
    ? ['diff-tree', '--root', '--binary', '--no-commit-id', '-r', manifest.reviewedCommit]
    : ['diff', '--binary', `${manifest.mergeBase}..${manifest.reviewedCommit}`];
  const actualDiffSha256 = createHash('sha256').update(gitBytes(['-C', repoRoot, ...diffArgs])).digest('hex');
  if (actualDiffSha256 !== manifest.diffSha256) throw new Error('diff hash mismatch');
} else if (manifest.mergeBase !== manifest.reviewedCommit || manifest.diffSha256 !== manifest.reviewedCommit) {
  throw new Error('fleet graph hash mismatch');
}
if (!Array.isArray(manifest.gates) || !manifest.gates.length) throw new Error('missing gates');
if (!Array.isArray(manifest.findings)) throw new Error('missing findings inventory');
const gateContract = claimScope === 'ship' ? loadGateContract() : null;
if (gateContract) validateGateContract(gateContract, manifest.gates);
for (const gate of manifest.gates) {
  if (!gate.id || !gate.artifact || !gate.sha256 || !gate.reviewedCommit) throw new Error('malformed gate');
  if (gate.required !== false && gate.status !== 'pass') throw new Error(`required gate not passed: ${gate.id}`);
  if (gate.reviewedCommit !== manifest.reviewedCommit) throw new Error(`stale gate: ${gate.id}`);
  const artifactBytes = artifact(gate.artifact, gate.id);
  const digest = createHash('sha256').update(artifactBytes).digest('hex');
  if (digest !== gate.sha256) throw new Error(`hash mismatch: ${gate.id}`);
  validateGateReceipt(gate, artifactBytes, manifest.reviewedCommit, gateContract);
}
if (claimScope === 'ship') validateOutcomeGate();
for (const finding of manifest.findings || []) {
  if (['P0', 'P1'].includes(finding.severity) && finding.validation === 'validated' && finding.status !== 'closed') {
    throw new Error(`open validated ${finding.severity}: ${finding.id}`);
  }
}
let status = null;
if (claimScope !== 'fleet') {
  const git = spawnSync('git', ['-C', repoRoot, 'diff', '--quiet', `${manifest.reviewedCommit}..HEAD`, '--', '.', ':(exclude).lenny/evidence/**']);
  if (git.status !== 0) throw new Error('code changed after reviewedCommit');
  status = spawnSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' });
  if (status.status !== 0) throw new Error('cannot inspect worktree');
  const dirtyCode = status.stdout.split('\n').filter(Boolean).some((line) => !line.slice(3).startsWith('.lenny/evidence/'));
  if (dirtyCode) throw new Error('uncommitted non-evidence changes');
}

if (claimMergeReady) {
  const claim = manifest.claim;
  if (!claim || claim.status !== 'merge-ready' || !['ship', 'meta', 'fleet'].includes(claim.scope)) {
    throw new Error('missing merge-ready claim scope');
  }
  if (claim.scope !== 'fleet') {
    const evidenceRoot = realpathSync(resolve(repoRoot, '.lenny/evidence'));
    const evidenceRel = relative(evidenceRoot, realDir);
    if (!evidenceRel || evidenceRel.startsWith(`..${sep}`) || evidenceRel === '..') {
      throw new Error('evidence bundle must be under .lenny/evidence');
    }
    const tracked = ['manifest.json', ...manifest.gates.flatMap((gate) =>
      [gate.artifact, gate.dependencyManifest].filter(Boolean))];
    for (const name of tracked) {
      const repoRel = relative(repoRoot, realpathSync(resolve(dir, name)));
      const result = spawnSync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', '--', repoRel]);
      if (result.status !== 0) throw new Error(`untracked evidence artifact: ${name}`);
    }
  }
  const passed = (kind) => manifest.gates.filter((gate) => gate.required !== false && gate.status === 'pass' && gate.kind === kind);

  if (claim.scope === 'ship') {
    const riskClass = claim.riskClass || 'high-stakes';
    let riskTriggers = [];
    if (!['standard', 'high-stakes'].includes(riskClass)) throw new Error('invalid risk class');
    if (claim.riskClass) {
      const riskGates = passed('risk_classification');
      if (riskGates.length !== 1) throw new Error('exactly one passing risk classification required');
      const risk = JSON.parse(artifact(riskGates[0].artifact, riskGates[0].id).toString('utf8'));
      riskTriggers = risk.triggers || [];
      if (risk.riskClass !== riskClass || risk.reviewedCommit !== manifest.reviewedCommit) {
        throw new Error('risk classification mismatch');
      }
      if (risk.mergeBase !== manifest.mergeBase) throw new Error('risk classification merge-base mismatch');
      const expectedRiskFiles = manifest.mergeBase === manifest.reviewedCommit
        ? []
        : gitText(['-C', repoRoot, 'diff', '--name-only', `${manifest.mergeBase}..${manifest.reviewedCommit}`])
          .split('\n').filter(Boolean).sort();
      if (JSON.stringify([...(risk.files || [])].sort()) !== JSON.stringify(expectedRiskFiles)) {
        throw new Error('risk classification file inventory mismatch');
      }
      const expectedRisk = evaluateRisk({
        files: expectedRiskFiles,
        description: risk.description || '',
        forceHigh: risk.forceHigh === true,
      });
      if (risk.riskClass !== expectedRisk.riskClass
          || JSON.stringify([...(risk.triggers || [])].sort()) !== JSON.stringify(expectedRisk.triggers.sort())) {
        throw new Error('risk classification was downgraded or its triggers do not match the reviewed diff');
      }
    }
    if (!passed('done_council').length) throw new Error('missing passing done council');
    for (const kind of deterministicKinds) {
      if (!passed(kind).length) throw new Error(`missing passing ${kind} gate`);
    }
    const audits = passed('p0_p1_audit');
    const reviewerCount = new Set(audits.map((gate) => gate.reviewerId)).size;
    if (riskClass === 'standard') {
      if (audits.length < 1 || reviewerCount < 1) throw new Error('one independent P0/P1 audit required for standard risk');
    } else {
      if (!passed('terminal_debate').length) throw new Error('missing passing terminal debate');
      if (audits.length < 2 || reviewerCount < 2) {
        throw new Error('two independent P0/P1 audits required for high-stakes risk');
      }
      const crossVendorPassed = claim.drivingVendor && audits.some((gate) => gate.vendor && gate.vendor !== claim.drivingVendor);
      if (!crossVendorPassed) {
        const waiver = passed('cross_vendor_unavailable').find((gate) => gate.attempts === 2);
        if (!claim.drivingVendor || claim.crossVendorAuditWaiver !== true || !waiver || audits.length < 3 || reviewerCount < 3) {
          throw new Error('cross-vendor P0/P1 audit or two-attempt waiver plus third independent audit required');
        }
      }
    }
    if (!Array.isArray(claim.requiredCouncils) || !claim.requiredCouncils.length) {
      throw new Error('required council inventory missing');
    }
    const policyCouncils = requiredCouncilsForRisk({ riskClass, triggers: riskTriggers });
    if (JSON.stringify([...claim.requiredCouncils].sort()) !== JSON.stringify([...policyCouncils].sort())) {
      throw new Error('required council inventory does not match risk policy');
    }
    const councils = new Set(passed('council').map((gate) => gate.councilId));
    for (const council of claim.requiredCouncils) {
      if (!councils.has(council)) throw new Error(`missing passing council: ${council}`);
    }
  } else {
    if (!passed('terminal_debate').length) throw new Error('missing passing terminal debate');
    const dependencyKind = claim.scope === 'meta' ? 'child_receipt' : 'lane_receipt';
    if (!Array.isArray(claim.requiredDependencies) || !claim.requiredDependencies.length) {
      throw new Error('required dependency inventory missing');
    }
    const receipts = passed(dependencyKind);
    const byDependency = new Map(receipts.map((gate) => [gate.dependencyId, gate]));
    const graphEntries = [];
    for (const dependencyId of claim.requiredDependencies) {
      const gate = byDependency.get(dependencyId);
      if (!gate) throw new Error(`missing passing ${dependencyKind}: ${dependencyId}`);
      const receipt = JSON.parse(artifact(gate.artifact, gate.id).toString('utf8'));
      if (receipt.status !== 'merge-ready' || receipt.validatorExitCode !== 0
          || !/^[0-9a-f]{40}$/.test(receipt.head) || receipt.head !== receipt.upstream
          || !/^[0-9a-f]{40}$/.test(receipt.reviewedCommit)
          || !/^[0-9a-f]{64}$/.test(receipt.evidenceManifestSha256)) {
        throw new Error(`invalid merge-ready receipt: ${dependencyId}`);
      }
      if (!gate.dependencyManifest || !gate.dependencyManifestSha256) {
        throw new Error(`missing dependency manifest: ${dependencyId}`);
      }
      const dependencyManifestBytes = artifact(gate.dependencyManifest, `${gate.id}-manifest`);
      const dependencyManifestSha256 = createHash('sha256').update(dependencyManifestBytes).digest('hex');
      if (dependencyManifestSha256 !== gate.dependencyManifestSha256
          || dependencyManifestSha256 !== receipt.evidenceManifestSha256) {
        throw new Error(`dependency manifest hash mismatch: ${dependencyId}`);
      }
      const dependencyManifest = JSON.parse(dependencyManifestBytes.toString('utf8'));
      if (dependencyManifest.claim?.status !== 'merge-ready'
          || dependencyManifest.reviewedCommit !== receipt.reviewedCommit) {
        throw new Error(`dependency manifest claim mismatch: ${dependencyId}`);
      }
      graphEntries.push(`${dependencyId}:${receipt.head}:${receipt.evidenceManifestSha256}`);
    }
    if (claim.scope === 'fleet') {
      const graphSha256 = createHash('sha256').update(`${graphEntries.sort().join('\n')}\n`).digest('hex');
      if (graphSha256 !== manifest.reviewedCommit) throw new Error('fleet graph hash mismatch');
    }
  }

  let head;
  let upstream;
  if (claim.scope !== 'fleet') {
    const declared = [...new Set(['manifest.json', ...manifest.gates.flatMap((gate) =>
      [gate.artifact, gate.dependencyManifest].filter(Boolean))])].sort();
    const present = listEvidenceFiles(realDir).sort();
    if (JSON.stringify(present) !== JSON.stringify(declared)) {
      throw new Error('evidence bundle contains undeclared or missing files');
    }
    if (status.stdout.trim()) throw new Error('worktree must be clean for merge-ready claim');
    ({ head, upstream } = verifyAdvertisedRemoteTip());
  }
  const receipt = {
    status: 'merge-ready',
    scope: claim.scope,
    runId: manifest.runId,
    reviewedCommit: manifest.reviewedCommit,
    ...(head ? { head, upstream } : {}),
    evidenceManifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    validatorExitCode: 0,
  };
  console.log('MERGE-READY INTERLOCK: PASS');
  console.log(JSON.stringify(receipt));
}
console.log(`evidence valid: ${manifest.runId}`);

function gitText(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function gitBytes(args) {
  const result = spawnSync('git', args);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed`);
  return result.stdout;
}

function artifact(name, id) {
  const file = resolve(dir, name);
  const rel = relative(dir, file);
  if (rel.startsWith(`..${sep}`) || rel === '..') throw new Error(`artifact escapes bundle: ${id}`);
  if (lstatSync(file).isSymbolicLink()) throw new Error(`artifact symlink forbidden: ${id}`);
  const realFile = realpathSync(file);
  const realRel = relative(realDir, realFile);
  if (realRel.startsWith(`..${sep}`) || realRel === '..') throw new Error(`artifact escapes bundle: ${id}`);
  return readFileSync(realFile);
}

function validateGateReceipt(gate, bytes, reviewedCommit, gateContract) {
  if (['child_receipt', 'lane_receipt', 'risk_classification', 'outcome_contract'].includes(gate.kind)) return;
  let receipt;
  try {
    receipt = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`gate receipt is not valid JSON: ${gate.id}`);
  }
  if (receipt.schemaVersion !== 1 || receipt.gateId !== gate.id || receipt.kind !== gate.kind) {
    throw new Error(`gate receipt identity mismatch: ${gate.id}`);
  }
  if (receipt.reviewedCommit !== reviewedCommit || receipt.exitCode !== 0) {
    throw new Error(`gate receipt did not pass at reviewed commit: ${gate.id}`);
  }
  const expectedVerdict = ['council', 'terminal_debate', 'done_council'].includes(gate.kind) ? 'GO' : 'PASS';
  if (receipt.verdict !== expectedVerdict) throw new Error(`gate receipt verdict is not ${expectedVerdict}: ${gate.id}`);
  if (deterministicKinds.has(gate.kind)) {
    if (receipt.recorder !== 'lenny-gate-runner@0.1.0'
        || !Array.isArray(receipt.command) || !receipt.command.length
        || receipt.command.some((item) => typeof item !== 'string' || !item)
        || !/^[0-9a-f]{64}$/.test(receipt.outputSha256 || '')
        || !Number.isInteger(receipt.durationMs) || receipt.durationMs < 0
        || !Number.isInteger(receipt.stdoutBytes) || receipt.stdoutBytes < 0
        || !Number.isInteger(receipt.stderrBytes) || receipt.stderrBytes < 0
        || typeof receipt.cwd !== 'string' || !receipt.cwd
        || !Number.isFinite(Date.parse(receipt.startedAt))
        || !Number.isFinite(Date.parse(receipt.finishedAt))
        || Date.parse(receipt.finishedAt) < Date.parse(receipt.startedAt)) {
      throw new Error(`deterministic gate lacks a valid runner receipt: ${gate.id}`);
    }
    const contract = gateContract?.gates.find((item) => item.id === gate.id);
    if (!contract || contract.kind !== gate.kind
        || JSON.stringify(contract.command) !== JSON.stringify(receipt.command)
        || contract.cwd !== receipt.cwd) {
      throw new Error(`deterministic gate command contract mismatch: ${gate.id}`);
    }
  }
  if (gate.kind === 'p0_p1_audit') {
    if (receipt.openP0 !== 0 || receipt.openP1 !== 0
        || receipt.reviewerId !== gate.reviewerId || receipt.vendor !== gate.vendor) {
      throw new Error(`audit receipt mismatch or open blocker: ${gate.id}`);
    }
  }
  if (gate.kind === 'council' && receipt.councilId !== gate.councilId) {
    throw new Error(`council receipt mismatch: ${gate.id}`);
  }
  if (gate.kind === 'cross_vendor_unavailable' && receipt.attempts !== gate.attempts) {
    throw new Error(`cross-vendor receipt mismatch: ${gate.id}`);
  }
}

function loadGateContract() {
  const path = `.lenny/runs/${manifest.runId}/GATE-CONTRACT.json`;
  try {
    return JSON.parse(gitBytes(['-C', repoRoot, 'show', `${manifest.reviewedCommit}:${path}`]).toString('utf8'));
  } catch {
    throw new Error(`frozen deterministic gate contract missing from reviewedCommit: ${path}`);
  }
}

function validateGateContract(contract, gates) {
  if (contract.schemaVersion !== 1 || !Array.isArray(contract.gates)) {
    throw new Error('invalid deterministic gate contract');
  }
  const ids = new Set();
  for (const item of contract.gates) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)
        || !deterministicKinds.has(item.kind)
        || typeof item.cwd !== 'string' || !item.cwd
        || !Array.isArray(item.command) || !item.command.length
        || item.command.some((value) => typeof value !== 'string' || !value)) {
      throw new Error('invalid or duplicate deterministic gate contract entry');
    }
    ids.add(item.id);
  }
  const required = gates.filter((gate) => gate.required !== false && deterministicKinds.has(gate.kind));
  const requiredIds = new Set(required.map((gate) => gate.id));
  if (requiredIds.size !== required.length
      || required.length !== contract.gates.length
      || contract.gates.some((item) => !requiredIds.has(item.id))) {
    throw new Error('deterministic gate contract does not match required manifest gates');
  }
}

function verifyAdvertisedRemoteTip() {
  const branch = gitText(['-C', repoRoot, 'symbolic-ref', '--quiet', '--short', 'HEAD']);
  const remote = gitText(['-C', repoRoot, 'config', '--get', `branch.${branch}.remote`]);
  const remoteRef = gitText(['-C', repoRoot, 'config', '--get', `branch.${branch}.merge`]);
  if (!remote || remote === '.') throw new Error('merge-ready proof requires a real configured remote');
  const remoteUrlResult = spawnSync('git', ['-C', repoRoot, 'remote', 'get-url', remote], {
    encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (remoteUrlResult.status !== 0) throw new Error('configured remote has no resolvable URL');
  const remoteUrl = remoteUrlResult.stdout.trim();
  const localTarget = localRemoteTarget(remoteUrl);
  if (localTarget) {
    const forbidden = new Set([
      realpathSync(repoRoot),
      realpathSync(gitText(['-C', repoRoot, 'rev-parse', '--absolute-git-dir'])),
      realpathSync(gitText(['-C', repoRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir'])),
    ]);
    if (forbidden.has(localTarget)) {
      throw new Error('merge-ready proof requires a distinct remote repository');
    }
  }
  if (!remoteRef.startsWith('refs/heads/')) throw new Error('upstream is not a remote branch');
  const result = spawnSync('git', ['-C', repoRoot, 'ls-remote', '--exit-code', '--heads', remote, remoteRef], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.status !== 0) throw new Error('configured remote branch is unavailable');
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  if (lines.length !== 1) throw new Error('configured remote branch did not resolve uniquely');
  const [remoteSha, advertisedRef] = lines[0].split(/\s+/);
  const head = gitText(['-C', repoRoot, 'rev-parse', 'HEAD']);
  if (advertisedRef !== remoteRef || remoteSha !== head) {
    throw new Error('local HEAD does not equal the branch advertised by its remote');
  }
  return { head, upstream: remoteSha };
}

function localRemoteTarget(url) {
  let path = null;
  if (url.startsWith('file://')) {
    try { path = fileURLToPath(url); } catch { return null; }
  } else if (!/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(url)
      && !/^(?:[^/@:]+@)?[^/:]+:.+/.test(url)) {
    path = resolve(repoRoot, url);
  }
  if (!path) return null;
  try { return realpathSync(path); } catch { return null; }
}

function listEvidenceFiles(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...listEvidenceFiles(root, path));
    else files.push(relative(root, path));
  }
  return files;
}

function immutableOutcome(contract) {
  return JSON.stringify({
    version: contract.version,
    originalOutcome: contract.originalOutcome,
    lockHash: contract.lockHash,
    criteria: (contract.criteria || []).map(({ id, text, required = true }) => ({ id, text, required })),
  });
}

function validateOutcomeGate() {
  const outcomes = manifest.gates.filter((gate) => gate.required !== false
    && gate.status === 'pass' && gate.kind === 'outcome_contract');
  if (outcomes.length !== 1) throw new Error('exactly one passing final outcome contract required');
  const finalOutcomePath = resolve(dir, outcomes[0].artifact);
  const outcomeCheck = spawnSync(process.execPath,
    [outcomeValidator, finalOutcomePath, '--claim-complete'], { encoding: 'utf8' });
  if (outcomeCheck.status !== 0) throw new Error(`final outcome contract invalid: ${outcomeCheck.stderr.trim()}`);
  const finalOutcome = JSON.parse(readFileSync(finalOutcomePath, 'utf8'));
  const frozenPath = `.lenny/runs/${manifest.runId}/OUTCOME-CONTRACT.json`;
  let frozenOutcome;
  try {
    frozenOutcome = JSON.parse(gitBytes(
      ['-C', repoRoot, 'show', `${manifest.reviewedCommit}:${frozenPath}`]).toString('utf8'));
  } catch {
    throw new Error(`frozen outcome contract missing from reviewedCommit: ${frozenPath}`);
  }
  if (immutableOutcome(finalOutcome) !== immutableOutcome(frozenOutcome)) {
    throw new Error('final outcome contract changed the frozen outcome or criteria');
  }
}
