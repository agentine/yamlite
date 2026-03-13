import { describe, it, expect } from 'vitest';
import { load, loadAll } from '../src/loader.js';
import { YAMLException } from '../src/exception.js';
import { DEFAULT_SCHEMA } from '../src/schemas/default.js';
import { JSON_SCHEMA } from '../src/schemas/json.js';
import { FAILSAFE_SCHEMA } from '../src/schemas/failsafe.js';

// ---------------------------------------------------------------------------
// Basic scalars
// ---------------------------------------------------------------------------

describe('load — scalars', () => {
  it('plain string', () => {
    expect(load('hello')).toBe('hello');
  });

  it('plain integer', () => {
    expect(load('42')).toBe(42);
  });

  it('plain negative integer', () => {
    expect(load('-7')).toBe(-7);
  });

  it('plain float', () => {
    expect(load('3.14')).toBe(3.14);
  });

  it('plain boolean true', () => {
    expect(load('true')).toBe(true);
  });

  it('plain boolean false', () => {
    expect(load('false')).toBe(false);
  });

  it('plain null', () => {
    expect(load('null')).toBeNull();
  });

  it('tilde null', () => {
    expect(load('~')).toBeNull();
  });

  it('empty string yields undefined', () => {
    expect(load('')).toBeUndefined();
  });

  it('single-quoted string stays string', () => {
    expect(load("'true'")).toBe('true');
  });

  it('double-quoted string stays string', () => {
    expect(load('"42"')).toBe('42');
  });

  it('double-quoted with escape', () => {
    expect(load('"hello\\nworld"')).toBe('hello\nworld');
  });

  it('hex integer', () => {
    expect(load('0xFF')).toBe(255);
  });

  it('octal integer', () => {
    expect(load('0o77')).toBe(63);
  });

  it('binary integer', () => {
    expect(load('0b1010')).toBe(10);
  });

  it('old-style octal 010 = 8', () => {
    expect(load('010')).toBe(8);
  });

  it('old-style octal 0777 = 511', () => {
    expect(load('0777')).toBe(511);
  });

  it('decimal does not have leading zeros', () => {
    // 09 is NOT valid octal, and not a valid old-style octal
    // js-yaml parses 09 as string since it's invalid
    expect(load('0')).toBe(0);
    expect(load('10')).toBe(10);
  });

  it('negative zero', () => {
    expect(Object.is(load('-0.0'), -0)).toBe(true);
  });

  it('.inf', () => {
    expect(load('.inf')).toBe(Infinity);
  });

  it('-.inf', () => {
    expect(load('-.inf')).toBe(-Infinity);
  });

  it('.nan', () => {
    expect(load('.nan')).toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// Block sequences
// ---------------------------------------------------------------------------

describe('load — block sequences', () => {
  it('simple list', () => {
    expect(load('- 1\n- 2\n- 3')).toEqual([1, 2, 3]);
  });

  it('string list', () => {
    expect(load('- a\n- b\n- c')).toEqual(['a', 'b', 'c']);
  });

  it('mixed types', () => {
    expect(load('- 1\n- hello\n- true\n- null')).toEqual([1, 'hello', true, null]);
  });

  it('nested sequences', () => {
    const yaml = '- - 1\n  - 2\n- - 3\n  - 4';
    expect(load(yaml)).toEqual([[1, 2], [3, 4]]);
  });

  it('empty entries', () => {
    expect(load('-\n-\n-')).toEqual([null, null, null]);
  });
});

// ---------------------------------------------------------------------------
// Block mappings
// ---------------------------------------------------------------------------

describe('load — block mappings', () => {
  it('simple mapping', () => {
    expect(load('a: 1\nb: 2')).toEqual({ a: 1, b: 2 });
  });

  it('nested mapping', () => {
    const yaml = 'a:\n  b: 1\n  c: 2';
    expect(load(yaml)).toEqual({ a: { b: 1, c: 2 } });
  });

  it('mapping with sequence value', () => {
    const yaml = 'items:\n  - 1\n  - 2';
    expect(load(yaml)).toEqual({ items: [1, 2] });
  });

  it('empty values', () => {
    expect(load('a:\nb:')).toEqual({ a: null, b: null });
  });

  it('integer keys', () => {
    expect(load('1: one\n2: two')).toEqual({ '1': 'one', '2': 'two' });
  });

  it('complex nested structure', () => {
    const yaml = `
server:
  host: localhost
  port: 8080
  features:
    - logging
    - auth
database:
  host: db.local
  port: 5432`.trim();
    const result = load(yaml);
    expect(result).toEqual({
      server: {
        host: 'localhost',
        port: 8080,
        features: ['logging', 'auth'],
      },
      database: {
        host: 'db.local',
        port: 5432,
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Flow sequences
// ---------------------------------------------------------------------------

describe('load — flow sequences', () => {
  it('simple flow sequence', () => {
    expect(load('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('nested flow sequence', () => {
    expect(load('[[1, 2], [3, 4]]')).toEqual([[1, 2], [3, 4]]);
  });

  it('empty flow sequence', () => {
    expect(load('[]')).toEqual([]);
  });

  it('flow sequence with strings', () => {
    expect(load('[a, b, c]')).toEqual(['a', 'b', 'c']);
  });

  it('flow sequence with trailing comma', () => {
    expect(load('[1, 2, 3,]')).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Flow mappings
// ---------------------------------------------------------------------------

describe('load — flow mappings', () => {
  it('simple flow mapping', () => {
    expect(load('{a: 1, b: 2}')).toEqual({ a: 1, b: 2 });
  });

  it('nested flow mapping', () => {
    expect(load('{a: {b: 1}}')).toEqual({ a: { b: 1 } });
  });

  it('empty flow mapping', () => {
    expect(load('{}')).toEqual({});
  });

  it('flow mapping with trailing comma', () => {
    expect(load('{a: 1, b: 2,}')).toEqual({ a: 1, b: 2 });
  });
});

// ---------------------------------------------------------------------------
// Anchors and aliases
// ---------------------------------------------------------------------------

describe('load — anchors and aliases', () => {
  it('anchor and alias', () => {
    const yaml = 'a: &anchor 42\nb: *anchor';
    expect(load(yaml)).toEqual({ a: 42, b: 42 });
  });

  it('anchor on mapping', () => {
    const yaml = 'defaults: &defaults\n  a: 1\n  b: 2\nproduction:\n  <<: *defaults\n  b: 3';
    const result = load(yaml) as Record<string, unknown>;
    expect(result.production).toEqual({ a: 1, b: 3 });
  });

  it('undefined alias throws', () => {
    expect(() => load('a: *unknown')).toThrow(YAMLException);
  });
});

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

describe('load — tags', () => {
  it('explicit !!str tag', () => {
    expect(load('!!str 42')).toBe('42');
  });

  it('explicit !!int tag', () => {
    expect(load('!!int "42"')).toBe(42);
  });

  it('explicit !!float tag', () => {
    expect(load('!!float "3.14"')).toBe(3.14);
  });

  it('explicit !!bool tag', () => {
    expect(load('!!bool "true"')).toBe(true);
  });

  it('explicit !!null tag', () => {
    expect(load('!!null ""')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Multi-document
// ---------------------------------------------------------------------------

describe('loadAll', () => {
  it('single document', () => {
    expect(loadAll('hello')).toEqual(['hello']);
  });

  it('multiple documents', () => {
    expect(loadAll('---\na\n---\nb')).toEqual(['a', 'b']);
  });

  it('documents with end marker', () => {
    expect(loadAll('a\n...\nb')).toEqual(['a', 'b']);
  });

  it('empty input', () => {
    expect(loadAll('')).toEqual([]);
  });

  it('with iterator callback', () => {
    const docs: unknown[] = [];
    const result = loadAll('---\n1\n---\n2', (doc) => docs.push(doc));
    expect(result).toBeUndefined();
    expect(docs).toEqual([1, 2]);
  });

  it('iterator as second arg, options as third', () => {
    const docs: unknown[] = [];
    loadAll('hello', (doc) => docs.push(doc), { schema: DEFAULT_SCHEMA });
    expect(docs).toEqual(['hello']);
  });
});

// ---------------------------------------------------------------------------
// load — multiple documents throws
// ---------------------------------------------------------------------------

describe('load — single document enforcement', () => {
  it('throws on multiple documents', () => {
    expect(() => load('---\na\n---\nb')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Directives
// ---------------------------------------------------------------------------

describe('load — directives', () => {
  it('YAML directive', () => {
    expect(load('%YAML 1.2\n---\nhello')).toBe('hello');
  });

  it('TAG directive', () => {
    const yaml = '%TAG !custom! tag:example.com,2000:\n---\n!!str hello';
    expect(load(yaml)).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// Block scalars
// ---------------------------------------------------------------------------

describe('load — block scalars', () => {
  it('literal block scalar', () => {
    const yaml = 'text: |\n  line1\n  line2';
    expect(load(yaml)).toEqual({ text: 'line1\nline2\n' });
  });

  it('folded block scalar', () => {
    const yaml = 'text: >\n  line1\n  line2';
    expect(load(yaml)).toEqual({ text: 'line1 line2\n' });
  });

  it('literal with strip chomp', () => {
    const yaml = 'text: |-\n  line1\n  line2';
    expect(load(yaml)).toEqual({ text: 'line1\nline2' });
  });

  it('literal with keep chomp', () => {
    const yaml = 'text: |+\n  line1\n  line2\n\n';
    expect(load(yaml)).toEqual({ text: 'line1\nline2\n\n' });
  });
});

// ---------------------------------------------------------------------------
// Schema options
// ---------------------------------------------------------------------------

describe('load — schema options', () => {
  it('FAILSAFE_SCHEMA keeps everything as strings', () => {
    expect(load('42', { schema: FAILSAFE_SCHEMA })).toBe('42');
    expect(load('true', { schema: FAILSAFE_SCHEMA })).toBe('true');
    expect(load('null', { schema: FAILSAFE_SCHEMA })).toBe('null');
  });

  it('JSON_SCHEMA resolves types', () => {
    expect(load('42', { schema: JSON_SCHEMA })).toBe(42);
    expect(load('true', { schema: JSON_SCHEMA })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

describe('load — timestamps', () => {
  it('date', () => {
    const result = load('2023-01-15');
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toContain('2023-01-15');
  });

  it('datetime', () => {
    const result = load('2023-01-15T10:30:00Z');
    expect(result).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('load — edge cases', () => {
  it('empty document with --- only', () => {
    expect(load('---')).toBeNull();
  });

  it('document with just ---\\n...', () => {
    expect(load('---\n...')).toBeNull();
  });

  it('explicit document with content', () => {
    expect(load('---\nhello')).toBe('hello');
  });

  it('comments are ignored', () => {
    expect(load('# comment\nhello # inline')).toBe('hello');
  });

  it('mapping with comment', () => {
    const yaml = '# top comment\na: 1 # inline\nb: 2';
    expect(load(yaml)).toEqual({ a: 1, b: 2 });
  });

  it('listener callback called', () => {
    const events: string[] = [];
    load('hello', {
      listener: (type) => events.push(type),
    });
    expect(events).toContain('open');
    expect(events).toContain('close');
  });

  it('onWarning receives duplicate key warning', () => {
    const warnings: YAMLException[] = [];
    load('a: 1\na: 2', { onWarning: (w) => warnings.push(w) });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('json option suppresses duplicate key warnings', () => {
    const warnings: YAMLException[] = [];
    load('a: 1\na: 2', { json: true, onWarning: (w) => warnings.push(w) });
    expect(warnings).toHaveLength(0);
  });

  it('filename option in error messages', () => {
    try {
      load('*unknown', { filename: 'test.yml' });
    } catch (e) {
      expect((e as YAMLException).message).toContain('test.yml');
    }
  });
});

// ---------------------------------------------------------------------------
// Merge keys
// ---------------------------------------------------------------------------

describe('load — merge keys', () => {
  it('merge with <<', () => {
    const yaml = `
defaults: &defaults
  a: 1
  b: 2
result:
  <<: *defaults
  c: 3`.trim();
    const result = load(yaml) as Record<string, unknown>;
    expect(result.result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('merge does not overwrite existing keys', () => {
    const yaml = `
defaults: &defaults
  a: 1
  b: 2
result:
  <<: *defaults
  b: 99`.trim();
    const result = load(yaml) as Record<string, unknown>;
    expect((result.result as Record<string, unknown>).b).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// Complex real-world examples
// ---------------------------------------------------------------------------

describe('load — real-world YAML', () => {
  it('package.json-like structure', () => {
    const yaml = `
name: my-app
version: 1.0.0
dependencies:
  express: 4.18.0
  lodash: 4.17.21
scripts:
  build: tsc
  test: vitest`.trim();
    const result = load(yaml) as Record<string, unknown>;
    expect(result.name).toBe('my-app');
    expect(result.version).toBe('1.0.0');
    expect((result.dependencies as Record<string, unknown>).express).toBe('4.18.0');
    expect((result.scripts as Record<string, unknown>).test).toBe('vitest');
  });

  it('docker-compose-like', () => {
    const yaml = `
version: "3.8"
services:
  web:
    image: nginx
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production`.trim();
    const result = load(yaml) as Record<string, unknown>;
    expect(result.version).toBe('3.8');
    const services = result.services as Record<string, unknown>;
    const web = services.web as Record<string, unknown>;
    expect(web.image).toBe('nginx');
    expect((web.ports as string[])[0]).toBe('80:80');
  });

  it('GitHub Actions-like', () => {
    const yaml = `
name: CI
on:
  push:
    branches:
      - main
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test`.trim();
    const result = load(yaml) as Record<string, unknown>;
    expect(result.name).toBe('CI');
    const jobs = result.jobs as Record<string, unknown>;
    const test = jobs.test as Record<string, unknown>;
    expect(test['runs-on']).toBe('ubuntu-latest');
    expect((test.steps as unknown[]).length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Bug fix regression tests (Task 290)
// ---------------------------------------------------------------------------

describe('load — security hardening', () => {
  it('prototype pollution: compiledTypeMap does not inherit Object.prototype', () => {
    // Before fix: compiledTypeMap['constructor'] returned Object.prototype.constructor
    // and calling .resolve() on it would crash. Now it throws a proper "unknown tag" error.
    expect(() => load('!<constructor> test')).toThrow(/unknown tag/);
  });

  it('duplicate TAG directive throws', () => {
    const yaml = `%TAG !! tag:yaml.org,2002:\n%TAG !! tag:example.com:\n---\nfoo: bar`;
    expect(() => load(yaml)).toThrow(/duplicate %TAG/);
  });

  it('single TAG directive works', () => {
    const yaml = `%TAG !! tag:yaml.org,2002:\n---\nfoo: bar`;
    expect(load(yaml)).toEqual({ foo: 'bar' });
  });

  it('depth limit throws on deeply nested YAML', () => {
    // Create deeply nested mapping: a:\n  a:\n    a: ...
    let yaml = '';
    for (let i = 0; i < 50; i++) {
      yaml += ' '.repeat(i * 2) + 'a:\n';
    }
    yaml += ' '.repeat(50 * 2) + 'end';
    // Default maxDepth=1000, this should be fine
    expect(() => load(yaml)).not.toThrow();

    // But with a very low maxDepth, it should throw
    expect(() => load(yaml, { maxDepth: 10 })).toThrow(/maximum nesting depth/);
  });

  it('alias expansion limit throws on billion laughs', () => {
    // Create a chain of aliases that expands exponentially
    let yaml = '---\n';
    yaml += 'a: &a [x, x]\n';
    for (let i = 1; i <= 20; i++) {
      yaml += `b${i}: &b${i} [*a, *a]\n`;
    }
    // With maxAliases=5, should throw before expanding too many
    expect(() => load(yaml, { maxAliases: 5 })).toThrow(/maximum number of alias/);
  });

  it('alias expansion within default limit works', () => {
    const yaml = `a: &a 1\nb: *a\nc: *a`;
    expect(load(yaml)).toEqual({ a: 1, b: 1, c: 1 });
  });
});

describe('loadAll — return type', () => {
  it('returns void when called with iterator', () => {
    const docs: unknown[] = [];
    const result = loadAll('---\n1\n---\n2', (doc) => docs.push(doc));
    expect(result).toBeUndefined();
    expect(docs).toEqual([1, 2]);
  });

  it('returns array when called without iterator', () => {
    const result = loadAll('---\n1\n---\n2');
    expect(result).toEqual([1, 2]);
  });
});
