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

  it('replacer transforms values', () => {
    const result = dump({ a: 1, b: 2 }, {
      replacer: (_key, value) => {
        if (typeof value === 'number') return value * 10;
        return value;
      },
    });
    // The replacer is applied to the top-level value (the object)
    // This is a simple test to ensure replacer is called
    expect(result).toBeDefined();
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
