#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const brandingPath = resolve(process.cwd(), 'config/release-branding.json');
const branding = JSON.parse(await readFile(brandingPath, 'utf8'));

const issueUrl = `https://github.com/${branding.githubOwner}/${branding.githubRepo}/issues`;
const githubRepository = `${branding.githubOwner}/${branding.githubRepo}`;

const outputs = {
  product_name: branding.productName,
  executable_name: branding.executableName,
  github_owner: branding.githubOwner,
  github_repo: branding.githubRepo,
  github_repository: githubRepository,
  issue_url: issueUrl,
  documentation_label: branding.documentationLabel,
  documentation_url: branding.documentationUrl,
  release_summary: branding.releaseSummary,
};

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(outputs, null, 2)}\n`);
  process.exit(0);
}

Object.entries(outputs).forEach(([key, value]) => {
  process.stdout.write(`${key}=${String(value)}\n`);
});
