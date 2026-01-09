import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function flattenLeaves(obj: unknown, prefix = ''): string[] {
  if (!isObject(obj)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (isObject(v)) out.push(...flattenLeaves(v, next));
    else out.push(next);
  }
  return out;
}

function listTrackedFiles(): string[] {
  const raw = execSync('git ls-files', { encoding: 'utf8' });
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function shouldScanFile(file: string): boolean {
  const allowedRoots = [
    'app/',
    'components/',
    'contexts/',
    'features/',
    'hooks/',
    'lib/',
    'services/',
    'src/',
    'theme/',
    'utils/',
  ];
  if (!allowedRoots.some((r) => file.startsWith(r))) return false;
  return (
    file.endsWith('.ts') ||
    file.endsWith('.tsx') ||
    file.endsWith('.js') ||
    file.endsWith('.jsx') ||
    file.endsWith('.mjs') ||
    file.endsWith('.cjs')
  );
}

function literalTKeysFrom(content: string): string[] {
  const out: string[] = [];
  // t('some.key') / t("some.key")
  const re1 = /\bt\(\s*['"]([^'"]+)['"]\s*[,)]/g;
  // i18nKey="some.key"
  const re2 = /\bi18nKey\s*=\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(content))) out.push(m[1]);
  while ((m = re2.exec(content))) out.push(m[1]);
  return out;
}

describe('i18n/en.json', () => {
  it('contains every literal translation key referenced in code (t("...") / i18nKey="...")', () => {
    const root = process.cwd();
    const enPath = path.join(root, 'i18n', 'en.json');
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const leafKeySet = new Set(flattenLeaves(en));

    const missing: Array<{ file: string; key: string }> = [];
    const files = listTrackedFiles().filter(shouldScanFile);

    for (const f of files) {
      const abs = path.join(root, f);
      let content = '';
      try {
        content = fs.readFileSync(abs, 'utf8');
      } catch {
        continue;
      }

      // Skip template-string calls: t(`prefix.${var}`) are intentionally dynamic.
      if (content.includes('t(`')) {
        // We still want to catch literal keys elsewhere in the file.
      }

      for (const key of literalTKeysFrom(content)) {
        // Ignore dynamic key variables: t(labelKey), etc. (these won't match our regex anyway)
        if (!leafKeySet.has(key)) missing.push({ file: f, key });
      }
    }

    expect(missing).toEqual([]);
  });
});

