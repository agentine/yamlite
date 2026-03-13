import { describe, it, expect } from 'vitest';
import { Mark } from '../src/mark.js';
import { YAMLException } from '../src/exception.js';
import { Type } from '../src/type.js';
import { Schema } from '../src/schema.js';
import {
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  types,
  safeLoad,
  safeLoadAll,
  safeDump,
} from '../src/index.js';
import {
  CHAR_TAB,
  CHAR_LINE_FEED,
  CHAR_SPACE,
  isEOL,
  isWhiteSpace,
  isWhiteSpaceOrEOL,
  isFlowIndicator,
  isDecCode,
  isHexCode,
  fromHexCode,
  SIMPLE_ESCAPE_SEQUENCES,
} from '../src/common.js';

// ---------------------------------------------------------------------------
// Mark
// ---------------------------------------------------------------------------

describe('Mark', () => {
  it('should store position info', () => {
    const mark = new Mark('test.yml', 'hello: world', 7, 0, 7);
    expect(mark.name).toBe('test.yml');
    expect(mark.position).toBe(7);
    expect(mark.line).toBe(0);
    expect(mark.column).toBe(7);
  });

  it('should generate snippet with caret', () => {
    const mark = new Mark('test.yml', 'hello: world', 7, 0, 7);
    const snippet = mark.getSnippet();
    expect(snippet).toBeDefined();
    expect(snippet).toContain('hello: world');
    expect(snippet).toContain('^');
  });

  it('should return null snippet for empty buffer', () => {
    const mark = new Mark(null, '', 0, 0, 0);
    expect(mark.getSnippet()).toBeNull();
  });

  it('should toString with name', () => {
    const mark = new Mark('file.yml', 'key: val', 0, 0, 0);
    const str = mark.toString();
    expect(str).toContain('file.yml');
    expect(str).toContain('line 1');
    expect(str).toContain('column 1');
  });

  it('should toString without name', () => {
    const mark = new Mark(null, 'key: val', 5, 0, 5);
    const str = mark.toString();
    expect(str).not.toContain('"null"');
    expect(str).toContain('line 1');
    expect(str).toContain('column 6');
  });

  it('should toString compact mode', () => {
    const mark = new Mark('x.yml', 'key: val', 0, 0, 0);
    const compact = mark.toString(true);
    const full = mark.toString(false);
    // Compact should not include the snippet
    expect(compact.length).toBeLessThanOrEqual(full.length);
  });

  it('should handle long lines with truncation', () => {
    const long = 'a'.repeat(200);
    const mark = new Mark(null, long, 100, 0, 100);
    const snippet = mark.getSnippet();
    expect(snippet).toBeDefined();
    expect(snippet!).toContain('...');
  });
});

// ---------------------------------------------------------------------------
// YAMLException
// ---------------------------------------------------------------------------

describe('YAMLException', () => {
  it('should extend Error', () => {
    const err = new YAMLException('bad input');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('YAMLException');
  });

  it('should store reason', () => {
    const err = new YAMLException('unexpected token');
    expect(err.reason).toBe('unexpected token');
  });

  it('should store mark', () => {
    const mark = new Mark('test.yml', 'hello', 0, 0, 0);
    const err = new YAMLException('oops', mark);
    expect(err.mark).toBe(mark);
  });

  it('should have null mark by default', () => {
    const err = new YAMLException('oops');
    expect(err.mark).toBeNull();
  });

  it('should build message with reason and mark', () => {
    const mark = new Mark('file.yml', 'key: val', 5, 0, 5);
    const err = new YAMLException('unexpected colon', mark);
    expect(err.message).toContain('unexpected colon');
    expect(err.message).toContain('file.yml');
  });

  it('should have toString with compact mode', () => {
    const mark = new Mark('x.yml', 'abc', 0, 0, 0);
    const err = new YAMLException('bad', mark);
    const compact = err.toString(true);
    const full = err.toString(false);
    expect(compact.length).toBeLessThanOrEqual(full.length);
  });
});

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

describe('Type', () => {
  it('should create with tag and kind', () => {
    const t = new Type('tag:yaml.org,2002:str', { kind: 'scalar' });
    expect(t.tag).toBe('tag:yaml.org,2002:str');
    expect(t.kind).toBe('scalar');
  });

  it('should throw on invalid kind', () => {
    expect(() => new Type('test', { kind: 'invalid' as 'scalar' })).toThrow();
  });

  it('should default resolve to true', () => {
    const t = new Type('test', { kind: 'scalar' });
    expect(t.resolve('anything')).toBe(true);
  });

  it('should accept custom resolve/construct', () => {
    const t = new Type('test', {
      kind: 'scalar',
      resolve: (d) => d === 'yes',
      construct: () => true,
    });
    expect(t.resolve('yes')).toBe(true);
    expect(t.resolve('no')).toBe(false);
    expect(t.construct('yes')).toBe(true);
  });

  it('should flatten style aliases', () => {
    const t = new Type('test', {
      kind: 'scalar',
      styleAliases: { decimal: ['10', 'dec'] },
    });
    expect(t.styleAliases['10']).toBe('decimal');
    expect(t.styleAliases['dec']).toBe('decimal');
  });
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

describe('Schema', () => {
  it('should create empty schema', () => {
    const s = new Schema();
    expect(s.compiledImplicit).toHaveLength(0);
    expect(s.compiledExplicit).toHaveLength(0);
  });

  it('should extend with a Type', () => {
    const base = new Schema();
    const t = new Type('tag:custom', { kind: 'scalar' });
    const extended = base.extend(t);
    expect(extended.compiledExplicit).toContain(t);
  });

  it('should extend with Type array', () => {
    const base = new Schema();
    const t1 = new Type('tag:a', { kind: 'scalar' });
    const t2 = new Type('tag:b', { kind: 'sequence' });
    const extended = base.extend([t1, t2]);
    expect(extended.compiledExplicit).toContain(t1);
    expect(extended.compiledExplicit).toContain(t2);
  });

  it('should extend with implicit/explicit object', () => {
    const base = new Schema();
    const t1 = new Type('tag:impl', { kind: 'scalar' });
    const t2 = new Type('tag:expl', { kind: 'mapping' });
    const extended = base.extend({ implicit: [t1], explicit: [t2] });
    expect(extended.compiledImplicit).toContain(t1);
    expect(extended.compiledExplicit).toContain(t2);
  });

  it('should build compiledTypeMap', () => {
    const t = new Type('tag:yaml.org,2002:str', { kind: 'scalar' });
    const s = new Schema({ explicit: [t] });
    expect(s.compiledTypeMap['tag:yaml.org,2002:str']).toBe(t);
  });
});

// ---------------------------------------------------------------------------
// Built-in Schemas
// ---------------------------------------------------------------------------

describe('Built-in Schemas', () => {
  it('FAILSAFE_SCHEMA has str, seq, map', () => {
    expect(FAILSAFE_SCHEMA.compiledTypeMap['tag:yaml.org,2002:str']).toBeDefined();
    expect(FAILSAFE_SCHEMA.compiledTypeMap['tag:yaml.org,2002:seq']).toBeDefined();
    expect(FAILSAFE_SCHEMA.compiledTypeMap['tag:yaml.org,2002:map']).toBeDefined();
  });

  it('JSON_SCHEMA has null, bool, int, float', () => {
    expect(JSON_SCHEMA.compiledTypeMap['tag:yaml.org,2002:null']).toBeDefined();
    expect(JSON_SCHEMA.compiledTypeMap['tag:yaml.org,2002:bool']).toBeDefined();
    expect(JSON_SCHEMA.compiledTypeMap['tag:yaml.org,2002:int']).toBeDefined();
    expect(JSON_SCHEMA.compiledTypeMap['tag:yaml.org,2002:float']).toBeDefined();
  });

  it('CORE_SCHEMA includes JSON_SCHEMA types', () => {
    expect(CORE_SCHEMA.compiledTypeMap['tag:yaml.org,2002:null']).toBeDefined();
    expect(CORE_SCHEMA.compiledTypeMap['tag:yaml.org,2002:int']).toBeDefined();
  });

  it('DEFAULT_SCHEMA has binary, timestamp, merge, omap, pairs, set', () => {
    expect(DEFAULT_SCHEMA.compiledTypeMap['tag:yaml.org,2002:binary']).toBeDefined();
    expect(DEFAULT_SCHEMA.compiledTypeMap['tag:yaml.org,2002:timestamp']).toBeDefined();
    expect(DEFAULT_SCHEMA.compiledTypeMap['tag:yaml.org,2002:merge']).toBeDefined();
    expect(DEFAULT_SCHEMA.compiledTypeMap['tag:yaml.org,2002:omap']).toBeDefined();
    expect(DEFAULT_SCHEMA.compiledTypeMap['tag:yaml.org,2002:pairs']).toBeDefined();
    expect(DEFAULT_SCHEMA.compiledTypeMap['tag:yaml.org,2002:set']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// types map
// ---------------------------------------------------------------------------

describe('types map', () => {
  it('should have all 13 built-in types', () => {
    const expected = [
      'binary', 'bool', 'float', 'int', 'map', 'merge',
      'null', 'omap', 'pairs', 'seq', 'set', 'str', 'timestamp',
    ];
    for (const name of expected) {
      expect(types[name]).toBeDefined();
      expect(types[name]).toBeInstanceOf(Type);
    }
  });
});

// ---------------------------------------------------------------------------
// common.ts utilities
// ---------------------------------------------------------------------------

describe('common', () => {
  it('isEOL', () => {
    expect(isEOL(CHAR_LINE_FEED)).toBe(true);
    expect(isEOL(0x0d)).toBe(true);
    expect(isEOL(CHAR_SPACE)).toBe(false);
  });

  it('isWhiteSpace', () => {
    expect(isWhiteSpace(CHAR_SPACE)).toBe(true);
    expect(isWhiteSpace(CHAR_TAB)).toBe(true);
    expect(isWhiteSpace(CHAR_LINE_FEED)).toBe(false);
  });

  it('isWhiteSpaceOrEOL', () => {
    expect(isWhiteSpaceOrEOL(CHAR_SPACE)).toBe(true);
    expect(isWhiteSpaceOrEOL(CHAR_LINE_FEED)).toBe(true);
    expect(isWhiteSpaceOrEOL(0x41)).toBe(false);
  });

  it('isFlowIndicator', () => {
    expect(isFlowIndicator(0x5b)).toBe(true); // [
    expect(isFlowIndicator(0x5d)).toBe(true); // ]
    expect(isFlowIndicator(0x7b)).toBe(true); // {
    expect(isFlowIndicator(0x7d)).toBe(true); // }
    expect(isFlowIndicator(0x2c)).toBe(true); // ,
    expect(isFlowIndicator(0x41)).toBe(false); // A
  });

  it('isDecCode', () => {
    expect(isDecCode(0x30)).toBe(true);
    expect(isDecCode(0x39)).toBe(true);
    expect(isDecCode(0x41)).toBe(false);
  });

  it('isHexCode', () => {
    expect(isHexCode(0x30)).toBe(true);
    expect(isHexCode(0x41)).toBe(true);
    expect(isHexCode(0x61)).toBe(true);
    expect(isHexCode(0x47)).toBe(false);
  });

  it('fromHexCode', () => {
    expect(fromHexCode(0x30)).toBe(0);
    expect(fromHexCode(0x39)).toBe(9);
    expect(fromHexCode(0x41)).toBe(10);
    expect(fromHexCode(0x61)).toBe(10);
    expect(fromHexCode(0x20)).toBe(-1);
  });

  it('SIMPLE_ESCAPE_SEQUENCES', () => {
    expect(SIMPLE_ESCAPE_SEQUENCES[0x6e]).toBe('\n');
    expect(SIMPLE_ESCAPE_SEQUENCES[0x74]).toBe('\t');
    expect(SIMPLE_ESCAPE_SEQUENCES[0x5c]).toBe('\\');
    expect(SIMPLE_ESCAPE_SEQUENCES[0x22]).toBe('"');
  });
});

// ---------------------------------------------------------------------------
// Deprecated functions
// ---------------------------------------------------------------------------

describe('Deprecated functions', () => {
  it('safeLoad throws migration error', () => {
    expect(() => safeLoad()).toThrow('safeLoad');
  });

  it('safeLoadAll throws migration error', () => {
    expect(() => safeLoadAll()).toThrow('safeLoadAll');
  });

  it('safeDump throws migration error', () => {
    expect(() => safeDump()).toThrow('safeDump');
  });
});
