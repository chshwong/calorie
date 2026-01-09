#!/usr/bin/env node
/**
 * Prune unused i18n keys from i18n/en.json by scanning the repo for references.
 *
 * Strategy (conservative but effective):
 * - Flatten en.json into dot-path leaf keys.
 * - Scan tracked source files for:
 *   1) t('some.key') / i18nKey="some.key" literal usages
 *   2) any string literal that *looks like* an i18n key AND exists in en.json
 * - Detect template-string i18n usage and treat its static prefix as a protected prefix.
 * - Remove leaf keys not referenced and not under any protected prefix.
 *
 * Writes:
 * - i18n/en.json (pruned)
 * - scripts/prune-en-unused.report.json (kept + removed stats)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EN_PATH = path.join(ROOT, 'i18n', 'en.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'prune-en-unused.report.json');

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function flattenLeaves(obj, prefix = '') {
  const out = [];
  if (!isObject(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (isObject(v)) out.push(...flattenLeaves(v, next));
    else out.push(next);
  }
  return out;
}

function setAtPath(rootObj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = rootObj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isObject(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function getAtPath(rootObj, dotPath) {
  const parts = dotPath.split('.');
  let cur = rootObj;
  for (const p of parts) {
    if (!isObject(cur) || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function keyLikeStringsFrom(content) {
  // Strings that look like i18n keys: a.b or a.b.c (no spaces)
  const re = /['"]([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)['"]/gi;
  const out = [];
  let m;
  while ((m = re.exec(content))) out.push(m[1]);
  return out;
}

function literalTKeysFrom(content) {
  const out = [];
  const re1 = /\bt\(\s*['"]([^'"]+)['"]\s*[,)]/g;
  const re2 = /\bi18nKey\s*=\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re1.exec(content))) out.push(m[1]);
  while ((m = re2.exec(content))) out.push(m[1]);
  return out;
}

function templatePrefixesFrom(content) {
  // Detect t(`some.prefix.${var}`) and protect "some.prefix."
  const out = [];
  const re = /\bt\(\s*`([^`]*\$\{[^}]+\}[^`]*)`\s*[,)]/g;
  let m;
  while ((m = re.exec(content))) {
    const tmpl = m[1];
    const idx = tmpl.indexOf('${');
    if (idx > 0) out.push(tmpl.slice(0, idx));
  }
  return out;
}

function listTrackedFiles() {
  const raw = execSync('git ls-files', { encoding: 'utf8' });
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function shouldScanFile(file) {
  // Only scan typical sources; skip large assets.
  return (
    file.endsWith('.ts') ||
    file.endsWith('.tsx') ||
    file.endsWith('.js') ||
    file.endsWith('.jsx') ||
    file.endsWith('.mjs') ||
    file.endsWith('.cjs')
  );
}

function main() {
  if (!fs.existsSync(EN_PATH)) {
    console.error(`Missing ${EN_PATH}`);
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  const leafKeys = flattenLeaves(en);
  const leafKeySet = new Set(leafKeys);

  const used = new Set();
  const protectedPrefixes = new Set();

  const files = listTrackedFiles().filter(shouldScanFile);
  for (const f of files) {
    const abs = path.join(ROOT, f);
    let content;
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }

    // 1) direct t('key') usage
    for (const k of literalTKeysFrom(content)) {
      if (leafKeySet.has(k)) used.add(k);
    }

    // 2) any key-like string literal that exists in en.json
    for (const k of keyLikeStringsFrom(content)) {
      if (leafKeySet.has(k)) used.add(k);
    }

    // 3) template-string protected prefixes
    for (const p of templatePrefixesFrom(content)) {
      // Only keep prefixes that plausibly match some en.json key.
      // (We keep the prefix even if it doesn't currently match, to be safe.)
      protectedPrefixes.add(p);
    }
  }

  const keep = new Set();
  const removed = [];

  for (const k of leafKeys) {
    const isUsed = used.has(k);
    const isProtected = [...protectedPrefixes].some((p) => k.startsWith(p));
    if (isUsed || isProtected) keep.add(k);
    else removed.push(k);
  }

  const nextEn = {};
  for (const k of keep) {
    setAtPath(nextEn, k, getAtPath(en, k));
  }

  // Write report first (so if JSON write fails, we still have context).
  const report = {
    summary: {
      totalLeafKeys: leafKeys.length,
      keptLeafKeys: keep.size,
      removedLeafKeys: removed.length,
      protectedPrefixes: [...protectedPrefixes].sort(),
    },
    removedKeys: removed.sort(),
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  fs.writeFileSync(EN_PATH, JSON.stringify(nextEn, null, 2) + '\n', 'utf8');

  console.log(
    `Pruned i18n/en.json: kept ${keep.size}/${leafKeys.length} leaf keys, removed ${removed.length}.`
  );
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
}

main();

