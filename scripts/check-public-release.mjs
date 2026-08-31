#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const mergeBase = process.argv[2] || 'origin/main';

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
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['assigned credential', /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i],
  ];
  return patterns.filter(([, pattern]) => pattern.test(added)).map(([name]) => name);
}

export function privateReleaseFindings(files) {
  const findings = [];
  const privateTerms = ['Bradley' + ' Miles', 'Avalon' + ' Labs', 'A' + 'IX'];
  for (const [path, contents] of files) {
    if (/\/(?:Users|home)\/[^/\s]+\//.test(contents)) findings.push(`${path}: absolute home path`);
    for (const term of privateTerms) {
      if (contents.includes(term)) findings.push(`${path}: private doctrine`);
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
  const diff = git(['diff', '--unified=0', '--no-ext-diff', `${mergeBase}..HEAD`]);
  const secrets = secretFindings(diff);
  if (boundaryFindings.length || secrets.length) {
    for (const finding of [...boundaryFindings, ...secrets.map((name) => `reviewed diff: ${name}`)]) {
      console.error(finding);
    }
    process.exit(1);
  }
  console.log(`public release scan passed: ${tracked.length} tracked files; diff ${mergeBase}..HEAD`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
