# yamlite — Drop-in Replacement for js-yaml

## Overview

**Target:** [js-yaml](https://github.com/nodeca/js-yaml) — the dominant YAML parser/dumper for JavaScript
**Package:** `yamlite` on npm
**License:** MIT
**Node:** 16+
**Dependencies:** Zero

## Why Replace js-yaml

- 161 million weekly npm downloads — one of the most-downloaded packages in the ecosystem
- Single maintainer (Vitaly Puzrin) — bus factor of 1
- 3.5-year gap between v4.1.0 (Jan 2022) and v4.1.1 (Sep 2025)
- 55 open issues, 15 open PRs with no triage
- Written in ES5-era JavaScript — no TypeScript, no ESM native
- No streaming/incremental parsing API
- Known issues with large file handling, memory efficiency
- DefinitelyTyped types maintained separately (can drift from implementation)

## Architecture

yamlite is a TypeScript-first YAML 1.2 parser and serializer with a modular design:

```
Input String
    ↓
Loader (parser + resolver)
    ↓ produces
JavaScript values (objects, arrays, primitives)
    ↓
Dumper (serializer)
    ↓ produces
YAML String Output
```

The schema system controls type resolution — mapping YAML tags to JavaScript constructors and vice versa. Custom types extend schemas for domain-specific YAML handling.

## Public API Surface (100% js-yaml v4 compatible)

### Module Exports

```typescript
// Core functions
export function load(input: string, options?: LoadOptions): unknown;
export function loadAll(input: string, iterator?: (doc: unknown) => void, options?: LoadOptions): unknown[];
export function dump(input: unknown, options?: DumpOptions): string;

// Schema system
export class Type { ... }
export class Schema { ... }

// Built-in schemas
export const FAILSAFE_SCHEMA: Schema;
export const JSON_SCHEMA: Schema;
export const CORE_SCHEMA: Schema;
export const DEFAULT_SCHEMA: Schema;

// Exception
export class YAMLException extends Error { ... }

// Built-in types (for custom schema composition)
export const types: {
  binary: Type;
  float: Type;
  map: Type;
  null: Type;
  pairs: Type;
  set: Type;
  timestamp: Type;
  bool: Type;
  int: Type;
  merge: Type;
  omap: Type;
  seq: Type;
  str: Type;
};

// Deprecated (throw helpful migration errors)
export function safeLoad(): never;
export function safeLoadAll(): never;
export function safeDump(): never;
```

### LoadOptions

```typescript
interface LoadOptions {
  /** String to be used as a file path in error/warning messages. */
  filename?: string;

  /** Specifies a schema to use. Default: DEFAULT_SCHEMA */
  schema?: Schema;

  /** Function to call on warning messages (YAMLException). */
  onWarning?: (warning: YAMLException) => void;

  /** Compatibility with JSON (allows duplicate keys, special string values). */
  json?: boolean;

  /** Function called on each parsed node. */
  listener?: (eventType: 'open' | 'close', state: object) => void;
}
```

### DumpOptions

```typescript
interface DumpOptions {
  /** Indentation width (1+). Default: 2 */
  indent?: number;

  /** Do not indent array elements relative to parent. Default: false */
  noArrayIndent?: boolean;

  /** Do not throw on invalid types, skip them. Default: false */
  skipInvalid?: boolean;

  /** Use flow style for nested levels (-1 = block everywhere). Default: -1 */
  flowLevel?: number;

  /** Per-type style overrides (e.g., { '!!null': 'canonical' }). */
  styles?: Record<string, string>;

  /** Specifies a schema to use. Default: DEFAULT_SCHEMA */
  schema?: Schema;

  /** Sort keys (true for alphabetical, or custom function). Default: false */
  sortKeys?: boolean | ((a: string, b: string) => number);

  /** Set max line width (-1 for unlimited). Default: 80 */
  lineWidth?: number;

  /** Disable anchor/alias generation for duplicate objects. Default: false */
  noRefs?: boolean;

  /** Don't convert YAML 1.1 booleans (yes/no/on/off). Default: false */
  noCompatMode?: boolean;

  /** Minimize spaces in flow mode. Default: false */
  condenseFlow?: boolean;

  /** Quote character for strings: "'" or '"'. Default: "'" */
  quotingType?: "'" | '"';

  /** Force quoting for all strings. Default: false */
  forceQuotes?: boolean;

  /** Replacer function (like JSON.stringify replacer). Default: null */
  replacer?: (key: string, value: unknown) => unknown;
}
```

### Schema System

```typescript
class Schema {
  /**
   * Create a new schema by extending this one.
   * @param definition - Type, Type[], or { implicit?: Type[], explicit?: Type[] }
   */
  extend(definition: Type | Type[] | { implicit?: Type[]; explicit?: Type[] }): Schema;
}
```

### Type System

```typescript
class Type {
  constructor(tag: string, options?: TypeOptions);

  tag: string;
  kind: 'scalar' | 'sequence' | 'mapping';
  resolve: (data: unknown) => boolean;
  construct: (data: unknown) => unknown;
  instanceOf?: Function;
  predicate?: (data: unknown) => boolean;
  represent?: ((data: unknown) => string) | Record<string, (data: unknown) => string>;
  representName?: (data: unknown) => string;
  defaultStyle?: string;
  multi?: boolean;
  styleAliases?: Record<string, string[]>;
}

interface TypeOptions {
  kind: 'scalar' | 'sequence' | 'mapping';
  multi?: boolean;
  resolve?: (data: unknown) => boolean;
  construct?: (data: unknown) => unknown;
  instanceOf?: Function;
  predicate?: (data: unknown) => boolean;
  represent?: ((data: unknown, style?: string) => string) | Record<string, (data: unknown) => string>;
  representName?: (data: unknown) => string;
  defaultStyle?: string;
  styleAliases?: Record<string, string[]>;
}
```

### Built-in Schemas

| Schema | Tags Included |
|--------|--------------|
| **FAILSAFE_SCHEMA** | `!!str`, `!!seq`, `!!map` |
| **JSON_SCHEMA** | + `!!null`, `!!bool`, `!!int`, `!!float` |
| **CORE_SCHEMA** | + implicit tag resolution (aliases for true/false/null, hex/octal ints) |
| **DEFAULT_SCHEMA** | + `!!binary`, `!!omap`, `!!pairs`, `!!set`, `!!timestamp`, `!!merge` |

### Built-in Types (13 total)

| Type | Tag | Kind | Description |
|------|-----|------|-------------|
| `str` | `tag:yaml.org,2002:str` | scalar | String values |
| `seq` | `tag:yaml.org,2002:seq` | sequence | Array values |
| `map` | `tag:yaml.org,2002:map` | mapping | Object values |
| `null` | `tag:yaml.org,2002:null` | scalar | null, ~, empty |
| `bool` | `tag:yaml.org,2002:bool` | scalar | true/false |
| `int` | `tag:yaml.org,2002:int` | scalar | Integer (decimal, hex, octal) |
| `float` | `tag:yaml.org,2002:float` | scalar | Float, .inf, .nan |
| `binary` | `tag:yaml.org,2002:binary` | scalar | Base64 → Buffer |
| `timestamp` | `tag:yaml.org,2002:timestamp` | scalar | Date strings → Date |
| `merge` | `tag:yaml.org,2002:merge` | scalar | `<<` merge key |
| `omap` | `tag:yaml.org,2002:omap` | sequence | Ordered map |
| `pairs` | `tag:yaml.org,2002:pairs` | sequence | Key-value pairs |
| `set` | `tag:yaml.org,2002:set` | mapping | Set of unique values |

### YAMLException

```typescript
class YAMLException extends Error {
  name: 'YAMLException';
  reason: string;
  mark: {
    name: string | null;
    buffer: string;
    position: number;
    line: number;
    column: number;
    snippet: string;
  } | null;
  message: string;

  toString(compact?: boolean): string;
}
```

### YAML Scalar Styles (Dumper)

The dumper chooses scalar style automatically:
1. **Plain** — unquoted, for simple values
2. **Single-quoted** — for strings needing protection from type coercion
3. **Double-quoted** — for strings with non-printable chars
4. **Literal block** (`|`) — for multiline, preserving newlines
5. **Folded block** (`>`) — for multiline, with line folding

### CLI Tool

```
yamlite <filename> [-h] [-t]
  -h, --help    Show help
  -t, --trace   Show stack trace on error
```

(js-yaml ships `js-yaml` CLI binary — yamlite provides compatible `yamlite` binary)

## Key Improvements Over js-yaml

1. **TypeScript-first** — written in TypeScript with accurate bundled types (no DefinitelyTyped dependency)
2. **Native ESM + CJS** — dual package with proper `exports` field
3. **Better error messages** — include source context, caret position, and suggestion text
4. **Performance** — optimized hot paths, typed arrays for escape tables, zero-copy where possible
5. **Security hardening** — configurable max document size, max alias count, max nesting depth to prevent DoS
6. **Streaming API (extension)** — `loadStream(input)` returning an async iterable of documents
7. **Modern JS** — uses `class`, `const`/`let`, template literals, proper Error subclass

## Implementation Phases

### Phase 1: Loader (Parser + Resolver)
- YAML 1.2 tokenizer/parser (all block/flow contexts, directives, anchors/aliases)
- String input with BOM stripping, null byte detection
- All load options (filename, schema, onWarning, json, listener)
- `load()` and `loadAll()` functions
- Error handling with line/column/snippet marks
- Implicit type resolution

### Phase 2: Type System & Schemas
- Type class with all options (kind, multi, resolve, construct, represent, etc.)
- Schema class with `extend()` composition
- All 4 built-in schemas (FAILSAFE, JSON, CORE, DEFAULT)
- All 13 built-in types with resolve/construct/represent functions
- Multi-type support for schema extensibility

### Phase 3: Dumper (Serializer)
- All dump options (indent, flowLevel, sortKeys, lineWidth, quotingType, etc.)
- Smart scalar style selection (plain/single/double/literal/folded)
- Block and flow sequences/mappings
- Anchor/alias generation for duplicate references
- Replacer function support
- Compatibility mode for YAML 1.1 booleans

### Phase 4: Polish & Ship
- js-yaml test suite ported + additional edge case tests
- Performance benchmarks vs js-yaml
- CLI tool (`yamlite` binary)
- TypeScript declarations bundled
- Dual ESM/CJS package configuration
- npm publish, CI/CD, documentation
- Migration guide (import yamlite as yaml / aliased imports)
