#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'lenny-evidence-'));
const validator = fileURLToPath(new URL('./validate-evidence.mjs', import.meta.url));
const run = (cmd, args) => {
  const out = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  if (out.status !== 0) throw new Error(out.stderr || `${cmd} failed`);
  return out.stdout.trim();
};
run('git', ['init', '-q']);
run('git', ['config', 'user.email', 'lenny@test.local']);
run('git', ['config', 'user.name', 'Lenny Test']);
writeFileSync(join(root, 'code.txt'), 'reviewed\n');
run('git', ['add', 'code.txt']);
run('git', ['commit', '-qm', 'reviewed']);
const reviewedCommit = run('git', ['rev-parse', 'HEAD']);
const reviewedDiff = spawnSync('git', ['diff-tree', '--root', '--binary', '--no-commit-id', '-r', reviewedCommit], { cwd: root });
if (reviewedDiff.status !== 0) throw new Error('cannot hash reviewed diff');
const diffSha256 = createHash('sha256').update(reviewedDiff.stdout).digest('hex');
const dir = join(root, '.lenny/evidence/example-run');
mkdirSync(dir, { recursive: true });
const gate = (id, kind, extra = {}) => {
  const artifact = Buffer.from(`${id}: pass\nreviewedCommit: ${reviewedCommit}\n`);
  const artifactName = `${id}.md`;
  writeFileSync(join(dir, artifactName), artifact);
  return { id, kind, required: true, status: 'pass', artifact: artifactName,
    sha256: createHash('sha256').update(artifact).digest('hex'), reviewedCommit, ...extra };
};
const gates = [
  gate('tests', 'test'),
  gate('build', 'build'),
  gate('leak-scan', 'leak_scan'),
  gate('live-qa', 'live_qa'),
  gate('audit-codex', 'p0_p1_audit', { reviewerId: 'codex-a', vendor: 'openai' }),
  gate('audit-claude', 'p0_p1_audit', { reviewerId: 'claude-b', vendor: 'anthropic' }),
  gate('correctness-council', 'council', { councilId: 'example-council' }),
  gate('terminal-debate', 'terminal_debate'),
];
writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
  runId: 'example-run', reviewedCommit, mergeBase: reviewedCommit,
  diffSha256,
  claim: { status: 'merge-ready', scope: 'ship', drivingVendor: 'openai',
    requiredCouncils: ['example-council'] },
  gates,
  findings: [],
}));
const originalManifest = readFileSync(join(dir, 'manifest.json'), 'utf8');
const wrongDiff = JSON.parse(originalManifest);
wrongDiff.diffSha256 = '0'.repeat(64);
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(wrongDiff));
const badDiff = spawnSync('node', [validator, dir], { cwd: root, encoding: 'utf8' });
if (badDiff.status === 0 || !badDiff.stderr.includes('diff hash mismatch')) {
  throw new Error('validator accepted an unbound diff hash');
}
writeFileSync(join(dir, 'manifest.json'), originalManifest);

const unboundArtifact = Buffer.from('tests: pass without a commit binding\n');
const unboundManifest = JSON.parse(originalManifest);
unboundManifest.gates[0].sha256 = createHash('sha256').update(unboundArtifact).digest('hex');
writeFileSync(join(dir, unboundManifest.gates[0].artifact), unboundArtifact);
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(unboundManifest));
const unbound = spawnSync('node', [validator, dir], { cwd: root, encoding: 'utf8' });
if (unbound.status === 0 || !unbound.stderr.includes('artifact not bound to reviewed commit')) {
  throw new Error('validator accepted an artifact without commit binding');
}
writeFileSync(join(dir, unboundManifest.gates[0].artifact), Buffer.from(`tests: pass\nreviewedCommit: ${reviewedCommit}\n`));
writeFileSync(join(dir, 'manifest.json'), originalManifest);

const outsideArtifact = join(root, 'outside-artifact.md');
const linkedArtifact = join(dir, 'linked-artifact.md');
const outsideBytes = Buffer.from(`outside\nreviewedCommit: ${reviewedCommit}\n`);
writeFileSync(outsideArtifact, outsideBytes);
symlinkSync(outsideArtifact, linkedArtifact);
const linkedManifest = JSON.parse(originalManifest);
linkedManifest.gates[0].artifact = 'linked-artifact.md';
linkedManifest.gates[0].sha256 = createHash('sha256').update(outsideBytes).digest('hex');
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(linkedManifest));
const linked = spawnSync('node', [validator, dir], { cwd: root, encoding: 'utf8' });
if (linked.status === 0 || !linked.stderr.includes('artifact symlink forbidden')) {
  throw new Error('validator accepted a symlinked artifact');
}
unlinkSync(linkedArtifact);
unlinkSync(outsideArtifact);
writeFileSync(join(dir, 'manifest.json'), originalManifest);
run('git', ['add', '.lenny/evidence']);
run('git', ['commit', '-qm', 'attest evidence']);
run('node', [validator, dir]);
const remote = `${root}-remote.git`;
run('git', ['init', '--bare', '-q', remote]);
run('git', ['remote', 'add', 'origin', remote]);
run('git', ['push', '-qu', 'origin', 'HEAD']);
const receipt = run('node', [validator, dir, '--claim-merge-ready']);
if (!receipt.includes('MERGE-READY INTERLOCK: PASS')) throw new Error('missing interlock receipt');
const externalBundle = mkdtempSync(join(tmpdir(), 'lenny-external-evidence-'));
cpSync(dir, externalBundle, { recursive: true });
const external = spawnSync('node', [validator, externalBundle, '--claim-merge-ready'],
  { cwd: root, encoding: 'utf8' });
if (external.status === 0 || !external.stderr.includes('evidence bundle must be under .lenny/evidence')) {
  throw new Error('interlock accepted evidence outside the committed bundle tree');
}

const crossVendorManifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
crossVendorManifest.claim.crossVendorAuditWaiver = true;
crossVendorManifest.gates.find((item) => item.id === 'audit-claude').vendor = 'openai';
crossVendorManifest.gates.push(
  gate('audit-codex-c', 'p0_p1_audit', { reviewerId: 'codex-c', vendor: 'openai' }),
  gate('cross-vendor-unavailable', 'cross_vendor_unavailable', { attempts: 2 }),
);
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(crossVendorManifest));
run('git', ['add', '.lenny/evidence']);
run('git', ['commit', '-qm', 'attest bounded audit fallback']);
run('git', ['push', '-q']);
const waivedReceipt = run('node', [validator, dir, '--claim-merge-ready']);
if (!waivedReceipt.includes('MERGE-READY INTERLOCK: PASS')) throw new Error('bounded audit fallback failed');

const manifestPath = join(dir, 'manifest.json');
const validManifest = readFileSync(manifestPath, 'utf8');
const oneAttempt = JSON.parse(validManifest);
oneAttempt.gates.find((item) => item.kind === 'cross_vendor_unavailable').attempts = 1;
writeFileSync(manifestPath, JSON.stringify(oneAttempt));
const prematureWaiver = spawnSync('node', [validator, dir, '--claim-merge-ready'], { cwd: root, encoding: 'utf8' });
if (prematureWaiver.status === 0 || !prematureWaiver.stderr.includes('two-attempt waiver')) {
  throw new Error('interlock accepted a one-attempt audit waiver');
}
writeFileSync(manifestPath, validManifest);
const missingTerminal = JSON.parse(validManifest);
missingTerminal.gates = missingTerminal.gates.filter((item) => item.kind !== 'terminal_debate');
writeFileSync(manifestPath, JSON.stringify(missingTerminal));
const noTerminal = spawnSync('node', [validator, dir, '--claim-merge-ready'], { cwd: root, encoding: 'utf8' });
if (noTerminal.status === 0 || !noTerminal.stderr.includes('missing passing terminal debate')) {
  throw new Error('interlock accepted missing terminal debate');
}
writeFileSync(manifestPath, validManifest);
const missingLiveQa = JSON.parse(validManifest);
missingLiveQa.gates = missingLiveQa.gates.filter((item) => item.kind !== 'live_qa');
writeFileSync(manifestPath, JSON.stringify(missingLiveQa));
const noLiveQa = spawnSync('node', [validator, dir, '--claim-merge-ready'], { cwd: root, encoding: 'utf8' });
if (noLiveQa.status === 0 || !noLiveQa.stderr.includes('missing passing live_qa gate')) {
  throw new Error('interlock accepted missing live QA');
}
writeFileSync(manifestPath, validManifest);
writeFileSync(join(root, 'code.txt'), 'changed after review\n');
const rejected = spawnSync('node', [validator, dir], { cwd: root });
if (rejected.status === 0) throw new Error('validator accepted stale evidence');

const fleetRoot = mkdtempSync(join(tmpdir(), 'lenny-fleet-evidence-'));
const fleetDir = join(fleetRoot, 'fleet-run');
mkdirSync(fleetDir, { recursive: true });
const laneReviewedCommit = 'c'.repeat(40);
const laneManifest = Buffer.from(JSON.stringify({
  reviewedCommit: laneReviewedCommit,
  claim: { status: 'merge-ready', scope: 'ship' },
}));
const laneManifestSha256 = createHash('sha256').update(laneManifest).digest('hex');
const laneHead = 'a'.repeat(40);
const laneReceipt = Buffer.from(JSON.stringify({
  status: 'merge-ready', validatorExitCode: 0,
  reviewedCommit: laneReviewedCommit,
  head: laneHead, upstream: laneHead,
  evidenceManifestSha256: laneManifestSha256,
}));
const graphHash = createHash('sha256').update(`lane-a:${laneHead}:${laneManifestSha256}\n`).digest('hex');
const terminal = Buffer.from(`fleet terminal debate: pass\nreviewedCommit: ${graphHash}\n`);
writeFileSync(join(fleetDir, 'lane-a.json'), laneReceipt);
writeFileSync(join(fleetDir, 'lane-a-manifest.json'), laneManifest);
writeFileSync(join(fleetDir, 'terminal.md'), terminal);
writeFileSync(join(fleetDir, 'manifest.json'), JSON.stringify({
  runId: 'fleet-run', reviewedCommit: graphHash, mergeBase: graphHash,
  diffSha256: graphHash,
  claim: { status: 'merge-ready', scope: 'fleet', requiredDependencies: ['lane-a'] },
  gates: [
    { id: 'lane-a', kind: 'lane_receipt', dependencyId: 'lane-a', required: true,
      status: 'pass', artifact: 'lane-a.json', sha256: createHash('sha256').update(laneReceipt).digest('hex'),
      dependencyManifest: 'lane-a-manifest.json', dependencyManifestSha256: laneManifestSha256,
      reviewedCommit: graphHash },
    { id: 'fleet-terminal', kind: 'terminal_debate', required: true, status: 'pass',
      artifact: 'terminal.md', sha256: createHash('sha256').update(terminal).digest('hex'),
      reviewedCommit: graphHash },
  ], findings: [],
}));
const fleetReceipt = spawnSync('node', [validator, fleetDir, '--claim-merge-ready'],
  { cwd: fleetRoot, encoding: 'utf8' });
if (fleetReceipt.status !== 0 || !fleetReceipt.stdout.includes('MERGE-READY INTERLOCK: PASS')) {
  throw new Error(fleetReceipt.stderr || 'fleet interlock failed');
}
console.log('validate-evidence self-test passed');
