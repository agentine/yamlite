import type { Schema } from './schema.js';

import { YAMLException } from './exception.js';
import { DEFAULT_SCHEMA } from './schemas/default.js';

export interface DumpOptions {
  indent?: number;
  noArrayIndent?: boolean;
  skipInvalid?: boolean;
  flowLevel?: number;
  styles?: Record<string, string>;
  schema?: Schema;
  sortKeys?: boolean | ((a: string, b: string) => number);
  lineWidth?: number;
  noRefs?: boolean;
  noCompatMode?: boolean;
  condenseFlow?: boolean;
  quotingType?: "'" | '"';
  forceQuotes?: boolean;
  replacer?: (key: string, value: unknown) => unknown;
}

interface DumpState {
  indent: number;
  noArrayIndent: boolean;
  skipInvalid: boolean;
  flowLevel: number;
  styles: Record<string, string>;
  schema: Schema;
  sortKeys: boolean | ((a: string, b: string) => number);
  lineWidth: number;
  noRefs: boolean;
  condenseFlow: boolean;
  quotingType: "'" | '"';
  forceQuotes: boolean;
  replacer: ((key: string, value: unknown) => unknown) | null;
  // Ref tracking
  duplicates: Set<unknown>;
  usedDuplicates: Set<unknown>;
  objectAnchorMap: Map<unknown, string>;
  anchorCounter: number;
  // Circular detection
  objectStack: Set<unknown>;
}

function createState(options?: DumpOptions): DumpState {
  return {
    indent: Math.max(1, options?.indent ?? 2),
    noArrayIndent: options?.noArrayIndent ?? false,
    skipInvalid: options?.skipInvalid ?? false,
    flowLevel: options?.flowLevel ?? -1,
    styles: options?.styles ?? {},
    schema: options?.schema ?? DEFAULT_SCHEMA,
    sortKeys: options?.sortKeys ?? false,
    lineWidth: options?.lineWidth ?? 80,
    noRefs: options?.noRefs ?? false,
    condenseFlow: options?.condenseFlow ?? false,
    quotingType: options?.quotingType ?? "'",
    forceQuotes: options?.forceQuotes ?? false,
    replacer: options?.replacer ?? null,
    duplicates: new Set(),
    usedDuplicates: new Set(),
    objectAnchorMap: new Map(),
    anchorCounter: 0,
    objectStack: new Set(),
  };
}

// -- Reference detection --

function findDuplicates(state: DumpState, input: unknown): void {
  const seen = new Set<unknown>();
  const dupes = new Set<unknown>();

  function walk(value: unknown): void {
    if (value === null || typeof value !== 'object') return;
    if (seen.has(value)) {
      dupes.add(value);
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
    } else {
      for (const v of Object.values(value as Record<string, unknown>)) walk(v);
    }
  }

  walk(input);
  state.duplicates = dupes;
}

function getAnchor(state: DumpState, obj: unknown): string {
  let anchor = state.objectAnchorMap.get(obj);
  if (!anchor) {
    anchor = 'a' + (++state.anchorCounter);
    state.objectAnchorMap.set(obj, anchor);
  }
  return anchor;
}

// (detectType removed — primitives handled directly in writeNode)

// -- Scalar writing --

const ESCAPE_MAP: Record<number, string> = {
  0x00: '\\0',
  0x07: '\\a',
  0x08: '\\b',
  0x09: '\\t',
  0x0a: '\\n',
  0x0b: '\\v',
  0x0c: '\\f',
  0x0d: '\\r',
  0x1b: '\\e',
  0x22: '\\"',
  0x5c: '\\\\',
  0x85: '\\N',
  0xa0: '\\_',
  0x2028: '\\L',
  0x2029: '\\P',
};

function needsQuoting(value: string): boolean {
  if (value.length === 0) return true;

  // Values that look like YAML special tokens
  const lower = value.toLowerCase();
  if (
    lower === 'true' || lower === 'false' ||
    lower === 'null' || lower === '~' ||
    lower === '.inf' || lower === '-.inf' || lower === '+.inf' ||
    lower === '.nan'
  ) return true;

  // Starts with special characters
  const first = value.charCodeAt(0);
  if (first === 0x2d || first === 0x3f || first === 0x3a || // - ? :
      first === 0x2c || first === 0x5b || first === 0x5d || // , [ ]
      first === 0x7b || first === 0x7d || first === 0x23 || // { } #
      first === 0x26 || first === 0x2a || first === 0x21 || // & * !
      first === 0x7c || first === 0x3e || first === 0x27 || // | > '
      first === 0x22 || first === 0x25 || first === 0x40 || // " % @
      first === 0x60) return true; // `

  // Contains : followed by space, # preceded by space, or line breaks
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    if (ch === 0x3a && i + 1 < value.length && (value.charCodeAt(i + 1) === 0x20 || value.charCodeAt(i + 1) === 0x09)) return true;
    if (ch === 0x23 && i > 0 && value.charCodeAt(i - 1) === 0x20) return true;
    if (ch === 0x0a || ch === 0x0d) return true;
    if (ch < 0x20 && ch !== 0x09) return true; // Non-printable
  }

  // Looks like a number
  if (/^[-+]?(?:\d[\d_]*\.?[\d_]*(?:[eE][-+]?\d+)?|0x[\da-fA-F_]+|0o[0-7_]+|0b[01_]+)$/.test(value)) return true;

  // Trailing/leading spaces
  if (value.startsWith(' ') || value.startsWith('\t') || value.endsWith(' ') || value.endsWith('\t')) return true;

  return false;
}

function needsDoubleQuoting(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    if (ch < 0x20 && ch !== 0x09 && ch !== 0x0a && ch !== 0x0d) return true;
    if (ch === 0x5c) return true;
    if (ch > 0x7e && ch < 0xa0) return true;
  }
  return false;
}

function escapeDoubleQuoted(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    if (ch in ESCAPE_MAP) {
      result += ESCAPE_MAP[ch];
    } else if (ch < 0x20) {
      result += '\\x' + ch.toString(16).padStart(2, '0');
    } else {
      result += value[i];
    }
  }
  return result;
}

function hasMultipleLines(value: string): boolean {
  return value.indexOf('\n') !== -1;
}

function writeScalar(state: DumpState, value: string, level: number, isKey: boolean): string {
  if (value.length === 0) {
    return state.quotingType === '"' ? '""' : "''";
  }

  // Block scalars for multiline (not in flow, not for keys)
  if (!isKey && level >= 0 && hasMultipleLines(value) && (state.flowLevel < 0 || level < state.flowLevel)) {
    // Use literal block scalar
    const indentStr = ' '.repeat(state.indent);
    const prefix = ' '.repeat(state.indent * level);

    // Determine chomp indicator
    let chomp = '';
    if (value.endsWith('\n')) {
      const lastTwo = value.slice(-2);
      if (lastTwo === '\n\n' || (lastTwo.length === 2 && lastTwo[0] === '\n')) {
        // Check if there are extra trailing newlines
        const trimmed = value.replace(/\n+$/, '');
        const trailingNewlines = value.length - trimmed.length;
        if (trailingNewlines > 1) {
          chomp = '+';
        }
        // Default clip handles single trailing newline
      }
    } else {
      chomp = '-'; // Strip — no trailing newline
    }

    let body = value;
    if (chomp === '' || chomp === '+') {
      // Remove the final newline for body (it's handled by chomp)
      if (body.endsWith('\n')) body = body.slice(0, -1);
    }

    const lines = body.split('\n');
    const indented = lines.map(l => prefix + indentStr + l).join('\n');
    return '|' + chomp + '\n' + indented + '\n';
  }

  if (state.forceQuotes || needsQuoting(value)) {
    if (needsDoubleQuoting(value) || state.quotingType === '"') {
      return '"' + escapeDoubleQuoted(value) + '"';
    }
    // Single-quoted
    return "'" + value.replace(/'/g, "''") + "'";
  }

  return value;
}

// -- Core serialization --

function writeNode(state: DumpState, value: unknown, level: number, block: boolean, compact: boolean, isKey: boolean): string | null {
  // Handle undefined
  if (value === undefined) {
    if (state.skipInvalid) return null;
    throw new YAMLException('unacceptable kind of an object to dump (undefined)');
  }

  // Handle functions
  if (typeof value === 'function') {
    if (state.skipInvalid) return null;
    throw new YAMLException('unacceptable kind of an object to dump (function)');
  }

  // Check for circular reference
  if (value !== null && typeof value === 'object') {
    if (state.objectStack.has(value)) {
      throw new YAMLException('cannot dump object with circular reference');
    }

    // Check for duplicate (ref/anchor)
    if (!state.noRefs && state.duplicates.has(value)) {
      if (state.usedDuplicates.has(value)) {
        // Already emitted — emit alias
        return '*' + getAnchor(state, value);
      }
      state.usedDuplicates.add(value);
    }
  }

  // Handle primitives directly (before detectType to avoid re-quoting)
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '.nan';
    if (value === Infinity) return '.inf';
    if (value === -Infinity) return '-.inf';
    return String(value);
  }
  if (typeof value === 'string') return writeScalar(state, value, level, isKey);
  if (typeof value === 'bigint') return String(value);

  // Date
  if (value instanceof Date) return value.toISOString();

  // Buffer
  if (Buffer.isBuffer(value)) {
    const b64 = value.toString('base64');
    const lines: string[] = [];
    for (let i = 0; i < b64.length; i += 76) {
      lines.push(b64.slice(i, i + 76));
    }
    return '!!binary |\n' + lines.map(l => ' '.repeat(state.indent * (level + 1)) + l).join('\n') + '\n';
  }

  // Array
  if (Array.isArray(value)) {
    return writeArray(state, value, level, block, compact);
  }

  // Object (mapping)
  if (typeof value === 'object' && value !== null) {
    return writeObject(state, value as Record<string, unknown>, level, block, compact);
  }

  if (state.skipInvalid) return null;
  throw new YAMLException(`unacceptable kind of an object to dump (${typeof value})`);
}

function writeArray(state: DumpState, arr: unknown[], level: number, _block: boolean, compact: boolean): string {
  if (arr.length === 0) return '[]';

  const useFlow = state.flowLevel >= 0 && level >= state.flowLevel;

  // Track circular refs
  state.objectStack.add(arr);

  // Anchor prefix
  let prefix = '';
  if (!state.noRefs && state.usedDuplicates.has(arr)) {
    prefix = '&' + getAnchor(state, arr) + ' ';
  }

  let result: string;

  if (useFlow) {
    // Flow style
    const sep = state.condenseFlow ? ',' : ', ';
    const items = arr.map((item, idx) => {
      if (state.replacer) {
        item = state.replacer(String(idx), item);
      }
      const s = writeNode(state, item, level + 1, false, false, false);
      return s ?? '';
    });
    result = prefix + '[' + items.join(sep) + ']';
  } else {
    // Block style
    const indentStr = ' '.repeat(state.indent * level);
    const itemIndent = state.noArrayIndent ? '' : indentStr;
    const lines: string[] = [];
    for (let idx = 0; idx < arr.length; idx++) {
      let item: unknown = arr[idx];
      if (state.replacer) {
        item = state.replacer(String(idx), item);
      }
      const s = writeNode(state, item, level + 1, true, false, false);
      if (s === null) {
        lines.push(itemIndent + '- null');
        continue;
      }
      const isBlockContent = /^\s/.test(s);
      if (isBlockContent) {
        // Block content (nested mapping/sequence) — inline first line after dash
        const nlIdx = s.indexOf('\n');
        if (nlIdx === -1) {
          lines.push(itemIndent + '- ' + s.trimStart());
        } else {
          lines.push(itemIndent + '- ' + s.substring(0, nlIdx).trimStart() + s.substring(nlIdx));
        }
      } else {
        lines.push(itemIndent + '- ' + s);
      }
    }
    result = prefix + lines.join('\n');
  }

  state.objectStack.delete(arr);
  return result;
}

function writeObject(state: DumpState, obj: Record<string, unknown>, level: number, _block: boolean, compact: boolean): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';

  // Sort keys if requested
  if (state.sortKeys === true) {
    keys.sort();
  } else if (typeof state.sortKeys === 'function') {
    keys.sort(state.sortKeys);
  }

  const useFlow = state.flowLevel >= 0 && level >= state.flowLevel;

  // Track circular refs
  state.objectStack.add(obj);

  // Anchor prefix
  let prefix = '';
  if (!state.noRefs && state.usedDuplicates.has(obj)) {
    prefix = '&' + getAnchor(state, obj) + ' ';
  }

  let result: string;

  if (useFlow) {
    // Flow style
    const sep = state.condenseFlow ? ',' : ', ';
    const pairs: string[] = [];
    for (const key of keys) {
      let value = obj[key];
      if (state.replacer) {
        value = state.replacer(key, value);
      }
      const keyStr = writeScalar(state, key, level, true);
      const valStr = writeNode(state, value, level + 1, false, false, false);
      if (valStr === null) {
        if (state.skipInvalid) continue;
      }
      if (state.condenseFlow) {
        pairs.push(keyStr + ':' + (valStr ?? 'null'));
      } else {
        pairs.push(keyStr + ': ' + (valStr ?? 'null'));
      }
    }
    result = prefix + '{' + pairs.join(sep) + '}';
  } else {
    // Block style
    const indentStr = ' '.repeat(state.indent * level);
    const lines: string[] = [];
    for (const key of keys) {
      let value = obj[key];
      if (state.replacer) {
        value = state.replacer(key, value);
      }
      const valStr = writeNode(state, value, level + 1, true, true, false);
      if (valStr === null && state.skipInvalid) continue;
      const keyStr = writeScalar(state, key, level, true);

      if (valStr === null) {
        lines.push(indentStr + keyStr + ':');
      } else if (/^\s/.test(valStr) || (valStr.indexOf('\n') !== -1 && !valStr.startsWith('[') && !valStr.startsWith('{') && !valStr.startsWith('*') && !valStr.startsWith('&') && !valStr.startsWith('"') && !valStr.startsWith("'"))) {
        // Block content (nested mapping/sequence/block scalar) — put on next line
        lines.push(indentStr + keyStr + ':\n' + valStr);
      } else {
        lines.push(indentStr + keyStr + ': ' + valStr);
      }
    }
    result = prefix + lines.join('\n');
  }

  state.objectStack.delete(obj);
  return result;
}

// -- Public API --

export function dump(input: unknown, options?: DumpOptions): string {
  const state = createState(options);

  // Apply replacer to root value
  if (state.replacer) {
    input = state.replacer('', input);
  }

  // Find duplicates for ref/anchor tracking
  if (!state.noRefs) {
    findDuplicates(state, input);
  }

  let result = writeNode(state, input, 0, true, true, false);

  if (result === null) {
    return '';
  }

  // Ensure trailing newline
  if (!result.endsWith('\n')) {
    result += '\n';
  }

  return result;
}
