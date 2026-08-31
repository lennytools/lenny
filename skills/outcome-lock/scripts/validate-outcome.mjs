#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const digest = contract => `sha256:${createHash('sha256').update(JSON.stringify({
  originalOutcome: contract.originalOutcome,
  criteria: contract.criteria?.map(({ id, text, required = true }) => ({ id, text, required })),
})).digest('hex')}`;

function errors(contract, claimComplete = false) {
  const found = [];
  if (contract.version !== 1) found.push('version must be 1');
  if (!contract.originalOutcome?.trim()) found.push('originalOutcome is required');
  if (!Array.isArray(contract.criteria) || !contract.criteria.length) found.push('criteria must be non-empty');
  if (!['in_progress', 'blocked', 'complete'].includes(contract.status)) found.push('invalid status');
  if (!contract.lockHash) found.push('lockHash is missing; run --stamp once');
  else if (contract.lockHash !== digest(contract)) found.push('locked outcome or criteria changed');

  const ids = new Set();
  for (const criterion of contract.criteria ?? []) {
    if (!criterion.id || ids.has(criterion.id)) found.push(`criterion id missing or duplicated: ${criterion.id ?? ''}`);
    ids.add(criterion.id);
    if (!criterion.text?.trim()) found.push(`criterion ${criterion.id ?? '?'} text is required`);
    if (!['pending', 'pass', 'fail', 'blocked', 'unproven'].includes(criterion.status)) found.push(`criterion ${criterion.id ?? '?'} has invalid status`);
  }

  for (const change of contract.scopeChanges ?? []) {
    if (change.status !== 'principal-approved' || !change.before || !change.after || !change.principalApprovalQuote) {
      found.push('scope change lacks explicit principal approval and before/after wording');
    }
  }

  if (claimComplete) {
    if (contract.status !== 'complete') found.push('status is not complete');
    if ((contract.blockers ?? []).length) found.push('active blockers remain');
    for (const criterion of (contract.criteria ?? []).filter(item => item.required !== false)) {
      if (criterion.status !== 'pass') found.push(`required criterion ${criterion.id} is not pass`);
      if (!Array.isArray(criterion.evidence) || !criterion.evidence.length) found.push(`required criterion ${criterion.id} lacks evidence`);
    }
  }
  return found;
}

function selfTest() {
  const contract = { version: 1, originalOutcome: 'A user can do X', status: 'complete', criteria: [{ id: 'C1', text: 'X works', required: true, status: 'pass', evidence: ['receipt'] }], blockers: [], scopeChanges: [] };
  contract.lockHash = digest(contract);
  assert.deepEqual(errors(contract, true), []);
  contract.originalOutcome = 'Only document X';
  assert(errors(contract).includes('locked outcome or criteria changed'));
  process.stdout.write('self-test passed\n');
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) selfTest();
else {
  const path = args.find(arg => !arg.startsWith('--'));
  if (!path) throw new Error('usage: validate-outcome.mjs CONTRACT [--stamp] [--claim-complete]');
  const contract = JSON.parse(readFileSync(path, 'utf8'));
  if (args.includes('--stamp')) {
    if (contract.lockHash) throw new Error('contract is already stamped');
    contract.lockHash = digest(contract);
    writeFileSync(path, `${JSON.stringify(contract, null, 2)}\n`);
  }
  const found = errors(contract, args.includes('--claim-complete'));
  if (found.length) {
    process.stderr.write(`${found.join('\n')}\n`);
    process.exitCode = 1;
  } else process.stdout.write('outcome contract valid\n');
}
