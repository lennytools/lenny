#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
function git(args, encoding = 'utf8') {
  const result = spawnSync('git', args, { cwd: root, encoding });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout;
}

export function secretFindings(diff) {
  const added = diff.split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
  const patterns = [
    ['AWS access key', /AKIA[0-9A-Z]{16}/],
    ['AWS secret key', /AWS_SECRET_ACCESS_KEY\s*=\s*[^\s]{8,}/i],
    ['GitHub classic token', /ghp_[A-Za-z0-9]{36}/],
    ['GitHub fine-grained token', /github_pat_[A-Za-z0-9_]{20,}/],
    ['model API key', /\bsk-(?:proj|ant)-[A-Za-z0-9_-]{8,}\b/],
    ['Stripe secret key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/],
    ['authorization bearer token', /authorization\s*:\s*bearer\s+[A-Za-z0-9._-]{12,}/i],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['assigned credential', /\b(?:api[_-]?key|secret|token|password)\b\s*['"]?\s*[:=]\s*(?:['"][^'"\r\n]{8,}['"]|[^\s#]{8,})/i],
    ['assigned environment credential', /\b[A-Z][A-Z0-9_]*(?:_SECRET|_TOKEN|_PASSWORD|_KEY)\b\s*[:=]\s*(?:['"][^'"\r\n]{8,}['"]|[^\s#]{8,})/],
  ];
  return patterns.filter(([, pattern]) => pattern.test(added)).map(([name]) => name);
}

export function privateReleaseFindings(files) {
  const findings = [];
  const privateTerms = ['Bradley' + ' Miles', 'Avalon' + ' Labs', 'A' + 'IX'];
  for (const [path, contents] of files) {
    if (/(?:^|[\s"'(])\/(?:Users|home)\/[^/\s"'()]+(?:\/|(?=$|[\s"'(),.;:]))/m.test(contents)) {
      findings.push(`${path}: absolute home path`);
    }
    const normalized = contents.toLowerCase();
    for (const term of privateTerms) {
      if (normalized.includes(term.toLowerCase())) findings.push(`${path}: private doctrine`);
    }
  }
  return findings;
}

function main() {
  const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
  const textFiles = [];
  for (const path of tracked) {
    const bytes = readFileSync(path);
    if (!bytes.includes(0)) textFiles.push([path, bytes.toString('utf8')]);
  }
  const boundaryFindings = privateReleaseFindings(textFiles);
  const trackedText = textFiles.flatMap(([, contents]) => contents.split('\n').map((line) => `+${line}`)).join('\n');
  const secrets = secretFindings(trackedText);
  if (boundaryFindings.length || secrets.length) {
    for (const finding of [...boundaryFindings, ...secrets.map((name) => `reviewed diff: ${name}`)]) {
      console.error(finding);
    }
    process.exit(1);
  }
  console.log(`public release scan passed: ${tracked.length} tracked files`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
