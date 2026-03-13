import { describe, it, expect } from 'vitest';
import { dump } from '../src/dumper.js';
import { load } from '../src/loader.js';
import { YAMLException } from '../src/exception.js';


// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

describe('dump — scalars', () => {
  it('string', () => {
    expect(dump('hello')).toBe('hello\n');
  });

  it('integer', () => {
    expect(dump(42)).toBe('42\n');
  });

  it('negative integer', () => {
    expect(dump(-7)).toBe('-7\n');
  });

  it('float', () => {
    expect(dump(3.14)).toBe('3.14\n');
  });

  it('boolean true', () => {
    expect(dump(true)).toBe('true\n');
  });

  it('boolean false', () => {
    expect(dump(false)).toBe('false\n');
  });

  it('null', () => {
    expect(dump(null)).toBe('null\n');
  });

  it('NaN', () => {
    expect(dump(NaN)).toBe('.nan\n');
  });

  it('Infinity', () => {
    expect(dump(Infinity)).toBe('.inf\n');
  });

  it('-Infinity', () => {
    expect(dump(-Infinity)).toBe('-.inf\n');
  });

  it('negative zero', () => {
    expect(dump(-0)).toBe('-0.0\n');
  });

  it('negative zero round-trip', () => {
    const result = load(dump(-0));
    expect(Object.is(result, -0)).toBe(true);
  });

  it('empty string gets quoted', () => {
    const result = dump('');
    expect(result === "''\n" || result === '""\n').toBe(true);
  });

  it('string that looks like boolean gets quoted', () => {
    const result = dump('true');
    expect(result).toContain("'true'");
  });

  it('string that looks like null gets quoted', () => {
    const result = dump('null');
    expect(result).toContain("'null'");
  });

  it('string that looks like number gets quoted', () => {
    const result = dump('42');
    expect(result).toContain("'42'");
  });

  it('string with colon-space gets quoted', () => {
    const result = dump('key: value');
    expect(result.startsWith("'") || result.startsWith('"')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

describe('dump — arrays', () => {
  it('simple array', () => {
    const result = dump([1, 2, 3]);
    expect(result).toContain('- 1');
    expect(result).toContain('- 2');
    expect(result).toContain('- 3');
  });

  it('empty array', () => {
    expect(dump([])).toBe('[]\n');
  });

  it('nested array', () => {
    const result = dump([[1, 2], [3, 4]]);
    expect(result).toContain('- 1');
    expect(result).toContain('- 3');
  });

  it('array with mixed types', () => {
    const result = dump([1, 'hello', true, null]);
    expect(result).toContain('- 1');
    expect(result).toContain('- hello');
    expect(result).toContain('- true');
    expect(result).toContain('- null');
  });
});

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

describe('dump — objects', () => {
  it('simple object', () => {
    const result = dump({ a: 1, b: 2 });
    expect(result).toContain('a: 1');
    expect(result).toContain('b: 2');
  });

  it('empty object', () => {
    expect(dump({})).toBe('{}\n');
  });

  it('nested object', () => {
    const result = dump({ a: { b: 1 } });
    expect(result).toContain('a:');
    expect(result).toContain('b: 1');
  });

  it('object with array value', () => {
    const result = dump({ items: [1, 2, 3] });
    expect(result).toContain('items:');
    expect(result).toContain('- 1');
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe('dump — options', () => {
  it('flowLevel forces flow style', () => {
    const result = dump({ a: [1, 2] }, { flowLevel: 0 });
    expect(result).toContain('{');
    expect(result).toContain('[');
  });

  it('sortKeys sorts alphabetically', () => {
    const result = dump({ c: 3, a: 1, b: 2 }, { sortKeys: true });
    const aIdx = result.indexOf('a:');
    const bIdx = result.indexOf('b:');
    const cIdx = result.indexOf('c:');
    expect(aIdx).toBeLessThan(bIdx);
    expect(bIdx).toBeLessThan(cIdx);
  });

  it('sortKeys with custom comparator', () => {
    const result = dump({ a: 1, c: 3, b: 2 }, {
      sortKeys: (x, y) => y.localeCompare(x), // reverse
    });
    const aIdx = result.indexOf('a:');
    const cIdx = result.indexOf('c:');
    expect(cIdx).toBeLessThan(aIdx);
  });

  it('condenseFlow removes spaces', () => {
    const result = dump({ a: 1, b: 2 }, { flowLevel: 0, condenseFlow: true });
    expect(result).toContain('a:1');
  });

  it('forceQuotes quotes all strings', () => {
    const result = dump({ name: 'hello' }, { forceQuotes: true });
    expect(result).toContain("'hello'");
  });

  it('quotingType double uses double quotes', () => {
    const result = dump({ name: 'hello' }, { forceQuotes: true, quotingType: '"' });
    expect(result).toContain('"hello"');
  });

  it('skipInvalid skips undefined values', () => {
    const result = dump({ a: 1, b: undefined, c: 3 }, { skipInvalid: true });
    expect(result).toContain('a: 1');
    expect(result).not.toContain('b:');
    expect(result).toContain('c: 3');
  });

  it('noRefs disables anchors', () => {
    const shared = { x: 1 };
    const result = dump({ a: shared, b: shared }, { noRefs: true });
    expect(result).not.toContain('&');
    expect(result).not.toContain('*');
  });

  it('indent option', () => {
    const result = dump({ a: { b: 1 } }, { indent: 4 });
    expect(result).toContain('    b: 1');
  });

  it('replacer transforms values exactly once', () => {
    const result = dump({ a: 1, b: 2 }, {
      replacer: (_key, value) => {
        if (typeof value === 'number') return value * 10;
        return value;
      },
    });
    // Replacer should multiply by 10, not 100 (double-apply bug)
    expect(result).toContain('a: 10');
    expect(result).toContain('b: 20');
  });

  it('replacer called with index for arrays', () => {
    const keys: string[] = [];
    dump([10, 20], {
      replacer: (key, value) => {
        keys.push(key);
        return value;
      },
    });
    // Root gets key '', array items get '0', '1'
    expect(keys).toContain('');
    expect(keys).toContain('0');
    expect(keys).toContain('1');
  });
});

// ---------------------------------------------------------------------------
// Anchors and aliases
// ---------------------------------------------------------------------------

describe('dump — anchors and aliases', () => {
  it('generates anchors for duplicate objects', () => {
    const shared = { x: 1 };
    const result = dump({ a: shared, b: shared });
    expect(result).toContain('&');
    expect(result).toContain('*');
  });

  it('throws on circular reference', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => dump(obj)).toThrow(YAMLException);
  });
});

// ---------------------------------------------------------------------------
// Round-trip (dump then load)
// ---------------------------------------------------------------------------

describe('dump/load round-trip', () => {
  it('simple string', () => {
    expect(load(dump('hello'))).toBe('hello');
  });

  it('integer', () => {
    expect(load(dump(42))).toBe(42);
  });

  it('boolean', () => {
    expect(load(dump(true))).toBe(true);
    expect(load(dump(false))).toBe(false);
  });

  it('null', () => {
    expect(load(dump(null))).toBeNull();
  });

  it('simple array', () => {
    expect(load(dump([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it('simple object', () => {
    expect(load(dump({ a: 1, b: 2 }))).toEqual({ a: 1, b: 2 });
  });

  it('nested structure', () => {
    const data = {
      name: 'test',
      items: [1, 2, 3],
      nested: { x: true, y: false },
    };
    expect(load(dump(data))).toEqual(data);
  });

  it('special values', () => {
    expect(load(dump(Infinity))).toBe(Infinity);
    expect(load(dump(-Infinity))).toBe(-Infinity);
    expect(load(dump(NaN))).toBeNaN();
  });

  it('flow style round-trip', () => {
    const data = { a: [1, 2], b: { x: 3 } };
    expect(load(dump(data, { flowLevel: 0 }))).toEqual(data);
  });

  it('quoted strings survive round-trip', () => {
    expect(load(dump('true'))).toBe('true');
    expect(load(dump('null'))).toBe('null');
    expect(load(dump('42'))).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('dump — errors', () => {
  it('throws on undefined without skipInvalid', () => {
    expect(() => dump(undefined)).toThrow();
  });

  it('throws on function without skipInvalid', () => {
    expect(() => dump(() => {})).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('dump — edge cases', () => {
  it('Date serialization', () => {
    const d = new Date('2023-01-15T00:00:00.000Z');
    const result = dump(d);
    expect(result).toContain('2023-01-15');
  });

  it('string with single quotes', () => {
    const result = dump("it's a test");
    expect(result).toBeDefined();
    // Should be loadable
    expect(load(result)).toBe("it's a test");
  });

  it('string starting with special char', () => {
    const result = dump('- item');
    expect(result.startsWith("'") || result.startsWith('"')).toBe(true);
  });

  it('deeply nested', () => {
    const data = { a: { b: { c: { d: 1 } } } };
    const result = dump(data);
    expect(load(result)).toEqual(data);
  });

  it('array of objects', () => {
    const data = [{ a: 1 }, { b: 2 }];
    const result = dump(data);
    expect(load(result)).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// Bug fix regression tests (Task 289)
// ---------------------------------------------------------------------------

describe('dump — noCompatMode', () => {
  it('quotes yes/no/on/off by default (compat mode)', () => {
    for (const word of ['yes', 'no', 'on', 'off', 'y', 'n', 'YES', 'NO', 'On', 'Off']) {
      const result = dump(word);
      expect(result.trim().startsWith("'") || result.trim().startsWith('"')).toBe(true);
      expect(load(result)).toBe(word);
    }
  });

  it('does not quote yes/no/on/off with noCompatMode: true', () => {
    const result = dump('yes', { noCompatMode: true });
    expect(result).toBe('yes\n');
  });
});

describe('dump — styles option', () => {
  it('styles !!int hex produces hex output', () => {
    const result = dump(255, { styles: { '!!int': 'hex' } });
    expect(result.trim()).toBe('0xFF');
  });

  it('styles !!int binary', () => {
    const result = dump(10, { styles: { '!!int': 'binary' } });
    expect(result.trim()).toBe('0b1010');
  });

  it('styles !!int octal', () => {
    const result = dump(8, { styles: { '!!int': 'octal' } });
    expect(result.trim()).toBe('0o10');
  });

  it('styles with alias (16 -> hexadecimal)', () => {
    const result = dump(255, { styles: { '!!int': '16' } });
    expect(result.trim()).toBe('0xFF');
  });
});

describe('dump — lineWidth folding', () => {
  it('folds long plain strings', () => {
    const longStr = 'the quick brown fox jumps over the lazy dog and keeps running across the meadow';
    const result = dump(longStr, { lineWidth: 40 });
    expect(result).toContain('>-');
    expect(load(result)).toBe(longStr);
  });

  it('does not fold short strings', () => {
    const result = dump('hello world', { lineWidth: 80 });
    expect(result).toBe('hello world\n');
  });

  it('does not fold with lineWidth 0 (disabled)', () => {
    const longStr = 'a '.repeat(100).trim();
    const result = dump(longStr, { lineWidth: 0 });
    expect(result).not.toContain('>-');
  });
});

describe('dump — block scalar empty lines', () => {
  it('does not indent empty lines in literal block', () => {
    const value = 'line1\n\nline3\n';
    const result = dump({ key: value });
    // Empty line between line1 and line3 should be truly empty
    const lines = result.split('\n');
    const emptyLine = lines.find(l => l.match(/^\s+$/) && l.trim() === '');
    expect(emptyLine).toBeUndefined();
    expect(load(result)).toEqual({ key: value });
  });

  it('round-trips keep chomp with trailing empty lines', () => {
    const value = 'a\nb\n\n\n';
    const result = dump({ key: value });
    expect(load(result)).toEqual({ key: value });
  });
});

describe('dump — noArrayIndent', () => {
  it('top-level array dashes align with key (column 0)', () => {
    const result = dump({ items: [1, 2, 3] }, { noArrayIndent: true });
    // noArrayIndent means dashes align with parent key level
    // For top-level key, that's column 0
    expect(result).toContain('items:\n- 1');
    expect(load(result)).toEqual({ items: [1, 2, 3] });
  });

  it('nested array dashes align with parent key level', () => {
    const result = dump({ outer: { items: [1, 2, 3] } }, { noArrayIndent: true });
    // items is at level 1 (indent 2), so dashes should align at level 1
    const lines = result.split('\n').filter(l => l.includes('- '));
    for (const line of lines) {
      expect(line.startsWith('  - ')).toBe(true);
    }
    expect(load(result)).toEqual({ outer: { items: [1, 2, 3] } });
  });
});

describe('dump — multiline quoting', () => {
  it('multiline string in flow mode uses double quotes with escapes', () => {
    const result = dump({ key: 'line1\nline2' }, { flowLevel: 0 });
    expect(result).toContain('\\n');
    expect(load(result)).toEqual({ key: 'line1\nline2' });
  });

  it('multiline key uses double quotes with escapes', () => {
    const result = dump({ 'key\nwith\nnewlines': 'value' });
    expect(result).toContain('\\n');
    expect(load(result)).toEqual({ 'key\nwith\nnewlines': 'value' });
  });
});

describe('dump — flow-mode null for skipped items', () => {
  it('emits null for skipped items in flow arrays', () => {
    const result = dump([1, undefined, 3], { flowLevel: 0, skipInvalid: true });
    expect(result).toContain('null');
    expect(load(result)).toEqual([1, null, 3]);
  });
});
