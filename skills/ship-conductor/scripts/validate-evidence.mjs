#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: validate-evidence.mjs <evidence-dir>');
const claimMergeReady = process.argv.includes('--claim-merge-ready');
const manifestBytes = readFileSync(resolve(dir, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const claimScope = manifest.claim?.scope;
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
for (const gate of manifest.gates) {
  if (!gate.id || !gate.artifact || !gate.sha256 || !gate.reviewedCommit) throw new Error('malformed gate');
  if (gate.required !== false && gate.status !== 'pass') throw new Error(`required gate not passed: ${gate.id}`);
  if (gate.reviewedCommit !== manifest.reviewedCommit) throw new Error(`stale gate: ${gate.id}`);
  const artifactBytes = artifact(gate.artifact, gate.id);
  const digest = createHash('sha256').update(artifactBytes).digest('hex');
  if (digest !== gate.sha256) throw new Error(`hash mismatch: ${gate.id}`);
  if (!['child_receipt', 'lane_receipt'].includes(gate.kind)
      && !artifactBytes.toString('utf8').includes(manifest.reviewedCommit)) {
    throw new Error(`artifact not bound to reviewed commit: ${gate.id}`);
  }
}
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
  if (!passed('terminal_debate').length) throw new Error('missing passing terminal debate');

  if (claim.scope === 'ship') {
    if (!passed('done_council').length) throw new Error('missing passing done council');
    for (const kind of ['test', 'build', 'leak_scan', 'live_qa']) {
      if (!passed(kind).length) throw new Error(`missing passing ${kind} gate`);
    }
    const audits = passed('p0_p1_audit');
    if (audits.length < 2 || new Set(audits.map((gate) => gate.reviewerId)).size < 2) {
      throw new Error('two independent P0/P1 audits required');
    }
    const crossVendorPassed = claim.drivingVendor && audits.some((gate) => gate.vendor && gate.vendor !== claim.drivingVendor);
    if (!crossVendorPassed) {
      const waiver = passed('cross_vendor_unavailable').find((gate) => gate.attempts === 2);
      const reviewerCount = new Set(audits.map((gate) => gate.reviewerId)).size;
      if (!claim.drivingVendor || claim.crossVendorAuditWaiver !== true || !waiver || audits.length < 3 || reviewerCount < 3) {
        throw new Error('cross-vendor P0/P1 audit or two-attempt waiver plus third independent audit required');
      }
    }
    if (!Array.isArray(claim.requiredCouncils) || !claim.requiredCouncils.length) {
      throw new Error('required council inventory missing');
    }
    const councils = new Set(passed('council').map((gate) => gate.councilId));
    for (const council of claim.requiredCouncils) {
      if (!councils.has(council)) throw new Error(`missing passing council: ${council}`);
    }
  } else {
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
    if (status.stdout.trim()) throw new Error('worktree must be clean for merge-ready claim');
    head = gitText(['-C', repoRoot, 'rev-parse', 'HEAD']);
    upstream = gitText(['-C', repoRoot, 'rev-parse', '@{upstream}']);
    if (head !== upstream) throw new Error('local HEAD does not equal upstream HEAD');
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
