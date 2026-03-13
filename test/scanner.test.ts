import { describe, it, expect } from 'vitest';
import { Scanner } from '../src/scanner.js';

function tokenTypes(input: string): string[] {
  const scanner = new Scanner(input);
  const types: string[] = [];
  for (;;) {
    const tok = scanner.getToken();
    if (!tok) break;
    types.push(tok.type);
    if (tok.type === 'STREAM-END') break;
  }
  return types;
}

function tokens(input: string): Array<{ type: string; value?: string }> {
  const scanner = new Scanner(input);
  const result: Array<{ type: string; value?: string }> = [];
  for (;;) {
    const tok = scanner.getToken();
    if (!tok) break;
    result.push({ type: tok.type, value: tok.value });
    if (tok.type === 'STREAM-END') break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stream start/end
// ---------------------------------------------------------------------------

describe('Scanner — stream', () => {
  it('should emit STREAM-START and STREAM-END for empty input', () => {
    expect(tokenTypes('')).toEqual(['STREAM-START', 'STREAM-END']);
  });

  it('should strip BOM', () => {
    const toks = tokenTypes('\uFEFFkey: val');
    expect(toks).toContain('STREAM-START');
    expect(toks).toContain('STREAM-END');
  });
});

// ---------------------------------------------------------------------------
// Directives
// ---------------------------------------------------------------------------

describe('Scanner — directives', () => {
  it('should parse %YAML directive', () => {
    const toks = tokens('%YAML 1.2\n---\nfoo');
    const dir = toks.find((t) => t.type === 'DIRECTIVE');
    expect(dir).toBeDefined();
    expect(dir!.value).toBe('YAML');
  });

  it('should parse %TAG directive', () => {
    const toks = tokens('%TAG !e! tag:example.com,2000:\n---\nfoo');
    const dir = toks.find((t) => t.type === 'DIRECTIVE');
    expect(dir).toBeDefined();
    expect(dir!.value).toBe('TAG');
  });
});

// ---------------------------------------------------------------------------
// Document markers
// ---------------------------------------------------------------------------

describe('Scanner — document markers', () => {
  it('should parse ---', () => {
    const types = tokenTypes('---\nfoo');
    expect(types).toContain('DOCUMENT-START');
  });

  it('should parse ...', () => {
    const types = tokenTypes("---\nfoo\n...");
    expect(types).toContain('DOCUMENT-END');
  });

  it('multiple documents', () => {
    const types = tokenTypes("---\nfoo\n...\n---\nbar");
    expect(types.filter((t) => t === 'DOCUMENT-START').length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Block sequences
// ---------------------------------------------------------------------------

describe('Scanner — block sequences', () => {
  it('should tokenize simple sequence', () => {
    const types = tokenTypes('- a\n- b\n- c');
    expect(types).toContain('BLOCK-SEQUENCE-START');
    expect(types).toContain('BLOCK-ENTRY');
    expect(types.filter((t) => t === 'BLOCK-ENTRY').length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Block mappings
// ---------------------------------------------------------------------------

describe('Scanner — block mappings', () => {
  it('should tokenize simple mapping', () => {
    const toks = tokens('key: value');
    const types = toks.map((t) => t.type);
    expect(types).toContain('BLOCK-MAPPING-START');
    expect(types).toContain('KEY');
    expect(types).toContain('VALUE');
  });

  it('should handle multiple keys', () => {
    const toks = tokens('a: 1\nb: 2');
    const keys = toks.filter((t) => t.type === 'KEY');
    expect(keys.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Flow collections
// ---------------------------------------------------------------------------

describe('Scanner — flow collections', () => {
  it('should parse flow sequence', () => {
    const types = tokenTypes('[a, b, c]');
    expect(types).toContain('FLOW-SEQUENCE-START');
    expect(types).toContain('FLOW-SEQUENCE-END');
    expect(types.filter((t) => t === 'FLOW-ENTRY').length).toBe(2);
  });

  it('should parse flow mapping', () => {
    const types = tokenTypes('{a: 1, b: 2}');
    expect(types).toContain('FLOW-MAPPING-START');
    expect(types).toContain('FLOW-MAPPING-END');
  });

  it('should parse nested flow', () => {
    const types = tokenTypes('[{a: 1}, [2, 3]]');
    expect(types).toContain('FLOW-SEQUENCE-START');
    expect(types).toContain('FLOW-MAPPING-START');
  });
});

// ---------------------------------------------------------------------------
// Scalars — plain
// ---------------------------------------------------------------------------

describe('Scanner — plain scalars', () => {
  it('should scan plain scalar', () => {
    const toks = tokens('hello');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar).toBeDefined();
    expect(scalar!.value).toBe('hello');
  });

  it('should stop at colon+space', () => {
    const toks = tokens('key: value');
    const scalars = toks.filter((t) => t.type === 'SCALAR');
    expect(scalars).toHaveLength(2);
    expect(scalars[0].value).toBe('key');
    expect(scalars[1].value).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// Scalars — single-quoted
// ---------------------------------------------------------------------------

describe('Scanner — single-quoted scalars', () => {
  it('should scan single-quoted scalar', () => {
    const toks = tokens("'hello world'");
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe('hello world');
  });

  it('should handle escaped single quote', () => {
    const toks = tokens("'it''s'");
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe("it's");
  });
});

// ---------------------------------------------------------------------------
// Scalars — double-quoted
// ---------------------------------------------------------------------------

describe('Scanner — double-quoted scalars', () => {
  it('should scan double-quoted scalar', () => {
    const toks = tokens('"hello world"');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe('hello world');
  });

  it('should handle escape sequences', () => {
    const toks = tokens('"hello\\nworld"');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe('hello\nworld');
  });

  it('should handle \\t', () => {
    const toks = tokens('"a\\tb"');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe('a\tb');
  });

  it('should handle \\uXXXX', () => {
    const toks = tokens('"\\u0041"');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe('A');
  });

  it('should handle \\xNN', () => {
    const toks = tokens('"\\x41"');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe('A');
  });

  it('should handle \\UXXXXXXXX', () => {
    const toks = tokens('"\\U00000041"');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe('A');
  });

  it('should handle \\\\ and \\"', () => {
    const toks = tokens('"a\\\\b\\"c"');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toBe('a\\b"c');
  });
});

// ---------------------------------------------------------------------------
// Scalars — literal block |
// ---------------------------------------------------------------------------

describe('Scanner — literal block scalars', () => {
  it('should scan literal block scalar', () => {
    const toks = tokens('|\n  hello\n  world\n');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar).toBeDefined();
    expect(scalar!.value).toContain('hello');
    expect(scalar!.value).toContain('world');
  });

  it('should strip trailing newlines with strip indicator', () => {
    const toks = tokens('|-\n  hello\n');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).not.toMatch(/\n$/);
  });

  it('should keep trailing newlines with keep indicator', () => {
    const toks = tokens('|+\n  hello\n\n\n');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar!.value).toMatch(/\n\n$/);
  });
});

// ---------------------------------------------------------------------------
// Scalars — folded block >
// ---------------------------------------------------------------------------

describe('Scanner — folded block scalars', () => {
  it('should scan folded block scalar', () => {
    const toks = tokens('>\n  hello\n  world\n');
    const scalar = toks.find((t) => t.type === 'SCALAR');
    expect(scalar).toBeDefined();
    // Folded: single newlines become spaces
    expect(scalar!.value).toContain('hello');
  });
});

// ---------------------------------------------------------------------------
// Anchors & Aliases
// ---------------------------------------------------------------------------

describe('Scanner — anchors and aliases', () => {
  it('should parse anchor', () => {
    const toks = tokens('&anchor value');
    const anchor = toks.find((t) => t.type === 'ANCHOR');
    expect(anchor).toBeDefined();
    expect(anchor!.value).toBe('anchor');
  });

  it('should parse alias', () => {
    const toks = tokens('*ref');
    const alias = toks.find((t) => t.type === 'ALIAS');
    expect(alias).toBeDefined();
    expect(alias!.value).toBe('ref');
  });
});

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

describe('Scanner — tags', () => {
  it('should parse explicit tag !!str', () => {
    const toks = tokens('!!str hello');
    const tag = toks.find((t) => t.type === 'TAG');
    expect(tag).toBeDefined();
    expect(tag!.value).toBe('str');
  });

  it('should parse verbatim tag', () => {
    const toks = tokens('!<tag:yaml.org,2002:str> hello');
    const tag = toks.find((t) => t.type === 'TAG');
    expect(tag).toBeDefined();
    expect(tag!.value).toBe('tag:yaml.org,2002:str');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('Scanner — errors', () => {
  it('should throw on unexpected character', () => {
    expect(() => tokenTypes('@invalid')).toThrow();
  });

  it('should track line/column in errors', () => {
    try {
      tokenTypes('key: value\n@bad');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toContain('unexpected character');
    }
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe('Scanner — comments', () => {
  it('should skip comments', () => {
    const toks = tokens('# this is a comment\nkey: value');
    const scalars = toks.filter((t) => t.type === 'SCALAR');
    expect(scalars).toHaveLength(2);
    expect(scalars[0].value).toBe('key');
  });

  it('should handle inline comments', () => {
    const toks = tokens('key: value # comment');
    const scalars = toks.filter((t) => t.type === 'SCALAR');
    expect(scalars[1].value).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// Complex documents
// ---------------------------------------------------------------------------

describe('Scanner — complex documents', () => {
  it('should tokenize nested mapping with sequence', () => {
    const input = 'root:\n  items:\n    - a\n    - b';
    const types = tokenTypes(input);
    expect(types).toContain('BLOCK-MAPPING-START');
    expect(types).toContain('BLOCK-SEQUENCE-START');
  });

  it('should handle mixed flow and block', () => {
    const input = 'key: [1, 2, 3]';
    const types = tokenTypes(input);
    expect(types).toContain('BLOCK-MAPPING-START');
    expect(types).toContain('FLOW-SEQUENCE-START');
  });
});
