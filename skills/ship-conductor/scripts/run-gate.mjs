#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const separator = argv.indexOf('--');
if (separator < 0 || separator === argv.length - 1) {
  fail('usage: run-gate.mjs --gate-id ID --kind KIND --reviewed-commit SHA --output FILE -- COMMAND [ARG...]');
}
const options = parseOptions(argv.slice(0, separator));
const command = argv.slice(separator + 1);
for (const name of ['gate-id', 'kind', 'reviewed-commit', 'output']) {
  if (!options[name]) fail(`missing --${name}`);
}
if (!['test', 'build', 'leak_scan', 'live_qa'].includes(options.kind)) {
  fail(`unsupported deterministic gate kind: ${options.kind}`);
}
if (!/^[0-9a-f]{40}$/.test(options['reviewed-commit'])) fail('reviewed commit must be a full SHA-1');

const head = git(['rev-parse', 'HEAD']);
if (head !== options['reviewed-commit']) fail('HEAD does not match the reviewed commit');

const startedAt = new Date();
const result = spawnSync(command[0], command.slice(1), {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 30 * 60 * 1000,
  maxBuffer: 32 * 1024 * 1024,
});
const finishedAt = new Date();
const stdout = result.stdout || '';
const stderr = result.stderr || '';
const exitCode = Number.isInteger(result.status) ? result.status : 1;
const receipt = {
  schemaVersion: 1,
  recorder: 'lenny-gate-runner@0.1.0',
  gateId: options['gate-id'],
  kind: options.kind,
  reviewedCommit: options['reviewed-commit'],
  verdict: exitCode === 0 ? 'PASS' : 'FAIL',
  exitCode,
  command,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs: finishedAt.getTime() - startedAt.getTime(),
  outputSha256: createHash('sha256').update(stdout).update('\0').update(stderr).digest('hex'),
  stdoutBytes: Buffer.byteLength(stdout),
  stderrBytes: Buffer.byteLength(stderr),
  ...(result.error ? { error: result.error.message } : {}),
};
atomicJson(resolve(options.output), receipt);
process.stdout.write(stdout);
process.stderr.write(stderr);
process.exitCode = exitCode;

function parseOptions(args) {
  const parsed = {};
  while (args.length) {
    const key = args.shift();
    if (!key?.startsWith('--') || !args.length) fail(`invalid option: ${key || '<empty>'}`);
    const name = key.slice(2);
    if (!['gate-id', 'kind', 'reviewed-commit', 'output'].includes(name) || name in parsed) {
      fail(`unsupported or duplicate option: ${key}`);
    }
    parsed[name] = args.shift();
  }
  return parsed;
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function fail(message) {
  console.error(`Lenny gate runner: ${message}`);
  process.exit(2);
}
