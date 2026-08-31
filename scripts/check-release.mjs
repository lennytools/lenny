#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

if (!semver.test(version)) throw new Error(`VERSION is not semantic versioning: ${version}`);
if (pkg.version !== version) throw new Error(`package.json ${pkg.version} does not match VERSION ${version}`);
if (!changelog.includes(`## [${version}]`)) throw new Error(`CHANGELOG.md has no ${version} entry`);

const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : process.argv[2];
if (tag && tag !== `v${version}`) throw new Error(`tag ${tag} does not match v${version}`);
console.log(`release metadata valid: v${version}`);
