# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-13

Initial release of **@agentine/yamlite** — a TypeScript-first, drop-in replacement for [js-yaml](https://github.com/nodeca/js-yaml) with YAML 1.2 compliance, dual ESM/CJS exports, and a CLI.

### Added

- **Scanner** (`scanner.ts`) — YAML 1.2 character-level tokenizer: block/flow scalars, multi-line strings, all scalar styles (plain, single-quoted, double-quoted, literal `|`, folded `>`), anchors, aliases, tags, directives, document markers (`---`, `...`).
- **Loader** (`loader.ts`) — `load(str, opts?)` and `loadAll(str, cb?, opts?)` producing JS values from YAML. Configurable schema, custom type constructors, `json` mode, strict duplicate key detection, depth limit (default 100), and alias expansion limit (default 10000) to prevent alias bomb DoS.
- **Type system** (`types/`) — `Schema` class with four built-in schemas: `FAILSAFE_SCHEMA`, `JSON_SCHEMA`, `CORE_SCHEMA`, `DEFAULT_SCHEMA`. All 13 built-in YAML types: null, bool, int (decimal, octal `0o`, hex `0x`, old-style octal `010`), float (including `.inf`, `-.inf`, `.nan`), string, timestamp, seq, map, pairs, set, omap, merge `<<`, binary.
- **Dumper** (`dumper.ts`) — `dump(obj, opts?)` serializing JS values to YAML strings. Supports: `indent`, `lineWidth`, `noRefs`, `noCompatMode` (quotes `yes`/`no`/`on`/`off` etc. for YAML 1.1 safety), `styles` (per-tag output style override), `sortKeys`, `flowLevel`, `condenseFlow`, `quotingType`, `forceQuotes`, `replacer`, block scalar `chomp` control (`clip`/`strip`/`keep`), `noArrayIndent`.
- **Dual ESM/CJS output** — built with tsup; ESM at `dist/index.mjs`, CJS at `dist/index.cjs`, TypeScript declarations at `dist/index.d.ts`.
- **CLI** (`cli.ts`) — `yamlite` binary: `yamlite parse file.yml`, `yamlite dump file.json`, piped stdin support, `--json` / `--yaml` output flags.
- **237 tests** covering scanner, loader, dumper, type system, and edge cases.
- **js-yaml drop-in** — `load`, `loadAll`, `dump`, `DEFAULT_SCHEMA`, `CORE_SCHEMA`, `JSON_SCHEMA`, `FAILSAFE_SCHEMA`, `YAMLException` all exported with the same signatures as js-yaml v4.

### Fixed (QA-identified bugs resolved before release)

- **CRITICAL: CJS exports broken** — tsup was producing `.js` for CJS output causing `MODULE_NOT_FOUND` errors on `require('@agentine/yamlite')`. Fixed by adding `outExtension` to `tsup.config.ts` to emit `.cjs`/`.mjs` files matching `package.json` exports map.
- **CRITICAL: `replacer` double-applied** — `dump()` replacer function was called twice per value. Fixed by removing the erroneous second call in the serializer.
- **HIGH: `noCompatMode` not implemented** — `yes`/`no`/`on`/`off`/`y`/`n`/`true`/`false` were not being quoted in default mode (YAML 1.1 compat). Implemented correct boolean-string quoting.
- **HIGH: `styles` option ignored** — per-tag style overrides had no effect. Fixed by wiring `DumpState.styles` through the type dispatch chain.
- **HIGH: `lineWidth` not respected** — long scalars were never wrapped. Implemented line-width tracking with scalar chomp.
- **HIGH: block scalar chomp ignored** — `|` and `>` scalars always used clip mode. Implemented `strip`/`keep` chomp indicators.
- **HIGH: `noArrayIndent` ignored** — block sequence entries were always indented. Fixed.
- **HIGH: int type accepted YAML 1.1 underscore separators** — `1_000` was parsed as `1000`. Removed non-standard separators for YAML 1.2 compliance.
- **HIGH: float regex too permissive** — integers matched as floats without decimal point. Tightened regex.
- **HIGH: timestamp `+00:MM` timezone offset** — `+00:30` was parsed as `+00:00`. Fixed offset-minutes parsing.
- **HIGH: float predicate accepted `-0`** — `-0` was not recognized as float. Fixed.
- **MEDIUM: Schema `compiledTypeMap` prototype pollution** — `Object.create({})` allowed `constructor`/`__proto__` tags to crash the resolver. Changed to `Object.create(null)`.
- **MEDIUM: duplicate TAG directive not rejected** — repeated `%TAG` directives were silently accepted. Now raises `YAMLException`.
- **MEDIUM: `loadAll` return type** — was `void` when no callback provided; now correctly returns `any[]`.
- **MEDIUM: depth/alias limits not enforced** — deeply nested or alias-bomb documents could hang the process. Enforced `maxDepth` (100) and `maxAliases` (10000).
- **`dump(-0)` output** — `-0` was serialized as `"0"` losing sign. Now correctly outputs `"-0.0"` for round-trip fidelity.
