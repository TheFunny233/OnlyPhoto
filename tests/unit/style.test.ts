import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Scans the actual source (components/styles) for forbidden Apple-style classes.
// It deliberately does NOT scan docs/STYLE_REFERENCE.md or the GOAL, which contain
// the forbidden strings only as rules or counter-examples.

const SRC = path.join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: 'UI gradient background', pattern: /bg-gradient/ },
  { name: 'heavy shadow', pattern: /shadow-(?:2xl|inner)\b/ },
  { name: 'thick border', pattern: /\bborder-(?:2|4|8)\b/ },
  { name: 'gradient text', pattern: /background-clip:\s*text/i },
  { name: 'banned font', pattern: /\b(?:Inter|Roboto|Geist)\b/ },
  { name: 'bounce/elastic easing', pattern: /ease-\[?cubic-bezier\([^)]*0\.5[^)]*1\.5/ },
];

describe('Apple-style guard', () => {
  const files = walk(SRC);

  it('scans a non-trivial number of files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const rule of FORBIDDEN) {
    it(`no ${rule.name}`, () => {
      const offenders: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        content.split(/\r?\n/).forEach((line, i) => {
          if (rule.pattern.test(line)) {
            offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
          }
        });
      }
      expect(offenders).toEqual([]);
    });
  }

  it('does not use emoji as core icons', () => {
    const offenders: string[] = [];
    for (const file of files.filter((f) => f.endsWith('.tsx'))) {
      const content = fs.readFileSync(file, 'utf8');
      if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(content)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});