# @agentine/yamlite

Drop-in replacement for js-yaml — TypeScript-first YAML 1.2 parser and serializer with zero dependencies.

## Why yamlite?

[js-yaml](https://github.com/nodeca/js-yaml) is one of the most downloaded packages in the npm ecosystem (161 million weekly downloads), but it has accumulated significant maintenance debt:

- **Bus factor of 1** — single maintainer with a 3.5-year gap between releases (v4.1.0 in Jan 2022, v4.1.1 in Sep 2025)
- **55 open issues, 15 open PRs** with no active triage
- **Written in ES5-era JavaScript** — no native TypeScript, no ESM
- **Types maintained separately** on DefinitelyTyped, meaning they can drift from the implementation
- **No native ESM** — requires workarounds for modern Node.js projects

yamlite fixes all of this:

- Written in TypeScript with bundled declarations — no separate `@types/` package needed
- Native ESM with a proper dual CJS/ESM package (`exports` field)
- **Zero runtime dependencies** — nothing to audit, nothing to break
- Node.js 16+ required
- 100% compatible with the js-yaml v4 public API

## Installation

```sh
npm install @agentine/yamlite
```

## Importing

**ESM:**

```js
import yaml from '@agentine/yamlite';
// or named:
import { load, dump, loadAll } from '@agentine/yamlite';
```

**CJS:**

```js
const yaml = require('@agentine/yamlite');
// or named:
const { load, dump, loadAll } = require('@agentine/yamlite');
```

## Quick Start

```js
import { load, dump } from '@agentine/yamlite';

// Parse YAML → JavaScript
const config = load(`
name: Acme
version: 3
features:
  - auth
  - logging
`);
// { name: 'Acme', version: 3, features: ['auth', 'logging'] }

// Serialize JavaScript → YAML
const yaml = dump({ name: 'Acme', version: 3, features: ['auth', 'logging'] });
// name: Acme
// version: 3
// features:
//   - auth
//   - logging
```

## Core API

### `load(input, options?)`

Parse a single YAML document from a string. Throws `YAMLException` if the input contains more than one document.

```ts
function load(input: string, options?: LoadOptions): unknown
```

```js
const doc = load('answer: 42'); // { answer: 42 }
```

Returns `undefined` for empty input.

### `loadAll(input, iterator?, options?)`

Parse a multi-document YAML stream. When an iterator function is provided it is called for each document and the function returns `void`. Without an iterator the function returns `unknown[]`.

```ts
function loadAll(
  input: string,
  iterator?: (doc: unknown) => void,
  options?: LoadOptions,
): unknown[] | void
```

```js
// Collect all documents
const docs = loadAll('---\na: 1\n---\nb: 2');
// [{ a: 1 }, { b: 2 }]

// Stream documents via iterator
loadAll('---\na: 1\n---\nb: 2', (doc) => {
  console.log(doc);
});

// Options without an iterator
const docs2 = loadAll('---\na: 1', { schema: CORE_SCHEMA });
```

### `dump(input, options?)`

Serialize a JavaScript value to a YAML string. Always appends a trailing newline.

```ts
function dump(input: unknown, options?: DumpOptions): string
```

```js
dump({ a: 1, b: [2, 3] });
// a: 1
// b:
//   - 2
//   - 3
```

## LoadOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filename` | `string` | — | Used in error and warning messages to identify the source |
| `schema` | `Schema` | `DEFAULT_SCHEMA` | Schema that controls type resolution |
| `onWarning` | `(w: YAMLException) => void` | — | Called for non-fatal warnings (e.g., duplicate keys) |
| `json` | `boolean` | `false` | JSON compatibility mode — silences duplicate-key warnings and accepts JSON-specific values |
| `listener` | `(event: 'open' \| 'close', state: object) => void` | — | Called on every parsed node open/close |
| `maxDepth` | `number` | `1000` | Maximum nesting depth before throwing |
| `maxAliases` | `number` | `100` | Maximum number of alias dereferences before throwing |

```js
const doc = load(yamlString, {
  filename: 'config.yaml',
  onWarning: (w) => console.warn(w.message),
  maxDepth: 100,
  maxAliases: 50,
});
```

## DumpOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indent` | `number` | `2` | Number of spaces per indentation level (minimum 1) |
| `noArrayIndent` | `boolean` | `false` | Do not indent array items relative to their parent key |
| `skipInvalid` | `boolean` | `false` | Silently skip values that cannot be serialized (functions, undefined) instead of throwing |
| `flowLevel` | `number` | `-1` | Nesting level at which to switch to flow style; `-1` means block everywhere |
| `styles` | `Record<string, string>` | `{}` | Per-type style overrides, e.g. `{ '!!null': 'canonical', '!!int': 'hex' }` |
| `schema` | `Schema` | `DEFAULT_SCHEMA` | Schema used for type representation |
| `sortKeys` | `boolean \| ((a, b) => number)` | `false` | Sort mapping keys alphabetically, or supply a comparator |
| `lineWidth` | `number` | `80` | Target line width for wrapping scalars; `-1` disables wrapping |
| `noRefs` | `boolean` | `false` | Disable anchor/alias generation for repeated object references |
| `noCompatMode` | `boolean` | `false` | Do not quote YAML 1.1 boolean words (`yes`/`no`/`on`/`off`) |
| `condenseFlow` | `boolean` | `false` | Remove spaces inside flow-style sequences and mappings |
| `quotingType` | `"'" \| '"'` | `"'"` | Preferred quote character for string scalars |
| `forceQuotes` | `boolean` | `false` | Force quoting for all string scalars |
| `replacer` | `(key: string, value: unknown) => unknown` | — | Transform values before serialization, like `JSON.stringify`'s replacer |

```js
dump(data, {
  indent: 4,
  sortKeys: true,
  lineWidth: 120,
  quotingType: '"',
});
```

## Schema System

yamlite ships four built-in schemas, each a superset of the previous:

| Schema | Tags |
|--------|------|
| `FAILSAFE_SCHEMA` | `!!str`, `!!seq`, `!!map` |
| `JSON_SCHEMA` | + `!!null`, `!!bool`, `!!int`, `!!float` |
| `CORE_SCHEMA` | + implicit resolution (hex/octal ints, `true`/`false`/`null` aliases) |
| `DEFAULT_SCHEMA` | + `!!binary`, `!!omap`, `!!pairs`, `!!set`, `!!timestamp`, `!!merge` |

The default for both `load` and `dump` is `DEFAULT_SCHEMA`.

### Extending a Schema

`Schema.extend()` creates a new schema that inherits all types from the parent and adds your custom types. The original schema is not modified.

```ts
schema.extend(type: Type): Schema
schema.extend(types: Type[]): Schema
schema.extend({ implicit?: Type[], explicit?: Type[] }): Schema
```

```js
import { DEFAULT_SCHEMA, Type } from '@agentine/yamlite';

const PointType = new Type('!point', {
  kind: 'sequence',
  resolve: (data) => Array.isArray(data) && data.length === 2,
  construct: ([x, y]) => ({ x, y }),
});

const mySchema = DEFAULT_SCHEMA.extend(PointType);

load('loc: !point [10, 20]', { schema: mySchema });
// { loc: { x: 10, y: 20 } }
```

Implicit types are tried automatically during tag resolution; explicit types require a YAML tag (`!point`) in the document.

## Type System

### `Type` class

```ts
class Type {
  constructor(tag: string, options?: TypeOptions)
}
```

#### TypeOptions

| Option | Type | Description |
|--------|------|-------------|
| `kind` | `'scalar' \| 'sequence' \| 'mapping'` | **Required.** The YAML node kind this type handles |
| `resolve` | `(data: unknown) => boolean` | Return `true` if this type can represent the given raw value |
| `construct` | `(data: unknown) => unknown` | Convert the raw YAML value to a JavaScript value |
| `instanceOf` | `Function` | JS class whose instances this type serializes |
| `predicate` | `(data: unknown) => boolean` | Alternative to `instanceOf` for matching JS values during dump |
| `represent` | `((data, style?) => string) \| Record<string, (data) => string>` | Serialize a JS value to a YAML string, optionally per named style |
| `representName` | `(data: unknown) => string` | Override the tag name used during serialization |
| `defaultStyle` | `string` | Which style key from `represent` to use when none is specified |
| `styleAliases` | `Record<string, string[]>` | Map alias names to canonical style names |
| `multi` | `boolean` | Allow multiple types with the same tag in a schema |

### Custom type example

```js
import { Type, DEFAULT_SCHEMA } from '@agentine/yamlite';

// Represent JS RegExp objects as !!js/regexp scalars
const RegExpType = new Type('tag:yaml.org,2002:js/regexp', {
  kind: 'scalar',
  instanceOf: RegExp,
  predicate: (data) => data instanceof RegExp,
  represent: (data) => data.toString(),
  resolve: (data) => typeof data === 'string' && data.startsWith('/'),
  construct: (data) => {
    const m = data.match(/^\/(.*)\/([gimsuy]*)$/);
    return m ? new RegExp(m[1], m[2]) : new RegExp(data);
  },
});

const schema = DEFAULT_SCHEMA.extend(RegExpType);
const doc = load('pattern: /hello/i', { schema });
// { pattern: /hello/i }
```

## Built-in Types

### `!!str` — String

Tag: `tag:yaml.org,2002:str` | Kind: scalar

Any YAML scalar that is not resolved by another implicit type becomes a string.

```yaml
greeting: Hello, world!
quoted: 'must be a string'
multiline: |
  line one
  line two
```

### `!!seq` — Sequence

Tag: `tag:yaml.org,2002:seq` | Kind: sequence

Block or flow sequences become JavaScript arrays.

```yaml
colors:
  - red
  - green
  - blue
inline: [a, b, c]
```

### `!!map` — Mapping

Tag: `tag:yaml.org,2002:map` | Kind: mapping

Block or flow mappings become plain JavaScript objects.

```yaml
person:
  name: Ada
  age: 36
inline: { x: 1, y: 2 }
```

### `!!null` — Null

Tag: `tag:yaml.org,2002:null` | Kind: scalar

`null`, `~`, and empty scalars all resolve to JavaScript `null`.

```yaml
a: null
b: ~
c:       # empty — also null
```

Dump styles: `lowercase` (default), `uppercase`, `camelcase`, `canonical` (`~`), `empty`.

### `!!bool` — Boolean

Tag: `tag:yaml.org,2002:bool` | Kind: scalar

`true`/`false` (case-insensitive) resolve to JavaScript booleans.

```yaml
enabled: true
disabled: false
```

Dump styles: `lowercase` (default), `uppercase`, `camelcase`.

### `!!int` — Integer

Tag: `tag:yaml.org,2002:int` | Kind: scalar

Decimal, hexadecimal (`0x`), octal (`0o`), and binary (`0b`) integer literals.

```yaml
decimal:     42
hexadecimal: 0xFF
octal:       0o17
binary:      0b1010
```

Dump styles: `decimal` (default), `hexadecimal`, `octal`, `binary`.

```js
dump({ n: 255 }, { styles: { '!!int': 'hex' } });
// n: 0xFF
```

### `!!float` — Float

Tag: `tag:yaml.org,2002:float` | Kind: scalar

Floating-point numbers including special values.

```yaml
pi:           3.14159
scientific:   6.022e23
infinity:     .inf
neg_infinity: -.inf
not_a_number: .nan
```

### `!!binary` — Binary

Tag: `tag:yaml.org,2002:binary` | Kind: scalar

Base64-encoded content decoded to a Node.js `Buffer`.

```yaml
icon: !!binary |
  iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA
  DUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
```

```js
const { icon } = load(yaml);
// icon is a Buffer
```

### `!!timestamp` — Timestamp

Tag: `tag:yaml.org,2002:timestamp` | Kind: scalar

ISO 8601 date and datetime strings resolve to JavaScript `Date` objects.

```yaml
date:     2024-01-15
datetime: 2024-01-15T09:30:00Z
with_tz:  2024-01-15 09:30:00 +05:30
```

```js
const { date } = load('date: 2024-01-15');
// date instanceof Date === true
```

### `!!merge` — Merge Key

Tag: `tag:yaml.org,2002:merge` | Kind: scalar

The `<<` merge key copies keys from another mapping into the current one, without overwriting existing keys.

```yaml
defaults: &defaults
  color: blue
  size: medium

button:
  <<: *defaults
  color: red     # overrides the merged value
# result: { color: 'red', size: 'medium' }
```

Multiple sources can be merged with a sequence:

```yaml
combined:
  <<: [*defaults, *extras]
```

### `!!omap` — Ordered Map

Tag: `tag:yaml.org,2002:omap` | Kind: sequence

An ordered sequence of single-key mappings. Useful when insertion order must be preserved and keys must be unique.

```yaml
ranked: !!omap
  - gold: 1
  - silver: 2
  - bronze: 3
```

Resolves to the array of single-key objects as-is (insertion order is preserved by the array).

### `!!pairs` — Pairs

Tag: `tag:yaml.org,2002:pairs` | Kind: sequence

Like `!!omap` but duplicate keys are allowed. Resolves to an array of `[key, value]` tuples.

```yaml
entries: !!pairs
  - a: 1
  - b: 2
  - a: 3
```

```js
// [['a', 1], ['b', 2], ['a', 3]]
```

### `!!set` — Set

Tag: `tag:yaml.org,2002:set` | Kind: mapping

A mapping where all values are `null`, representing a set of unique keys.

```yaml
languages: !!set
  TypeScript: ~
  Rust: ~
  Go: ~
```

```js
// { TypeScript: null, Rust: null, Go: null }
```

## YAMLException

All parse and serialization errors are instances of `YAMLException`.

```ts
class YAMLException extends Error {
  name: 'YAMLException';
  reason: string;    // human-readable error description
  mark: Mark | null; // source location, or null for non-parse errors
}

class Mark {
  name: string | null; // filename, if provided via LoadOptions.filename
  buffer: string;      // full input string
  position: number;    // byte offset
  line: number;        // 0-based line number
  column: number;      // 0-based column number
  getSnippet(): string | null; // source excerpt with caret
  toString(compact?: boolean): string;
}
```

```js
import { load, YAMLException } from '@agentine/yamlite';

try {
  load(': invalid');
} catch (e) {
  if (e instanceof YAMLException) {
    console.error(e.reason);         // short description
    console.error(e.mark?.line);     // 0-based line number
    console.error(e.mark?.column);   // 0-based column number
    console.error(e.message);        // full formatted message with snippet
  }
}
```

Error messages include a source snippet with a caret pointing at the problematic position:

```
YAMLException: unexpected token STREAM-END in "config.yaml" at line 3, column 1:
    key: [unclosed
        ^
```

## Deprecated Functions

The js-yaml v3 safe-prefixed functions are retained as stubs that throw a migration error:

```js
safeLoad();    // throws: Function "safeLoad" is removed. Use "load" instead — it is now safe by default.
safeLoadAll(); // throws: Function "safeLoadAll" is removed. Use "loadAll" instead — it is now safe by default.
safeDump();    // throws: Function "safeDump" is removed. Use "dump" instead — it is now safe by default.
```

## CLI Tool

yamlite installs a `yamlite` binary that parses a YAML file and prints its JSON representation to stdout.

```sh
yamlite <filename> [options]
```

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Show help message |
| `-t`, `--trace` | Print full stack trace on error |

```sh
# Parse and pretty-print as JSON
yamlite config.yaml

# Show source location on error
yamlite bad.yaml --trace
```

Exit code is `0` on success, `1` on error.

## Security

yamlite includes built-in protection against denial-of-service via deeply nested or alias-heavy documents.

| Option | Default | Purpose |
|--------|---------|---------|
| `maxDepth` | `1000` | Throws when nesting exceeds this level |
| `maxAliases` | `100` | Throws when alias dereferences within a single document exceed this count |

Tune these per-call to match your threat model:

```js
load(untrustedInput, {
  maxDepth: 20,
  maxAliases: 10,
});
```

Circular object references in `dump()` are detected and always throw regardless of options.

## Migration Guide

### From js-yaml v4

yamlite's API is 100% compatible with js-yaml v4. Change the import and you are done:

```js
// Before
import yaml from 'js-yaml';
const { load, dump } = require('js-yaml');

// After
import yaml from '@agentine/yamlite';
const { load, dump } = require('@agentine/yamlite');
```

### From js-yaml v3

The `safeLoad`, `safeLoadAll`, and `safeDump` functions were removed in js-yaml v4. In yamlite they throw a descriptive error pointing you to the replacement. Replace them as follows:

| v3 | v4 / yamlite |
|----|--------------|
| `safeLoad(str)` | `load(str)` |
| `safeLoadAll(str, fn)` | `loadAll(str, fn)` |
| `safeDump(obj)` | `dump(obj)` |

The `load`, `loadAll`, and `dump` functions are safe by default — they do not execute arbitrary code.

## License

MIT
