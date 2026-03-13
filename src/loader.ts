import type { Schema } from './schema.js';
import type { Type } from './type.js';
import { YAMLException } from './exception.js';
import { DEFAULT_SCHEMA } from './schemas/default.js';
import { Scanner, type Token } from './scanner.js';
import { Mark } from './mark.js';

export interface LoadOptions {
  filename?: string;
  schema?: Schema;
  onWarning?: (warning: YAMLException) => void;
  json?: boolean;
  listener?: (eventType: 'open' | 'close', state: object) => void;
  maxDepth?: number;
  maxAliases?: number;
}

interface LoaderState {
  input: string;
  filename: string | null;
  schema: Schema;
  onWarning: ((warning: YAMLException) => void) | null;
  json: boolean;
  listener: ((eventType: 'open' | 'close', state: object) => void) | null;
  scanner: Scanner;
  anchors: Record<string, unknown>;
  anchorMap: Record<string, unknown>;
  tagDirectives: Array<{ handle: string; prefix: string }>;
  version: [number, number] | null;
  depth: number;
  maxDepth: number;
  aliasCount: number;
  maxAliases: number;
}

const FAILSAFE_TAGS: Record<string, string> = {
  '!': 'tag:yaml.org,2002:',
  '!!': 'tag:yaml.org,2002:',
};

const DEFAULT_TAG_PREFIXES: Array<{ handle: string; prefix: string }> = [
  { handle: '!', prefix: '!' },
  { handle: '!!', prefix: 'tag:yaml.org,2002:' },
];

function createState(input: string, options?: LoadOptions): LoaderState {
  return {
    input,
    filename: options?.filename ?? null,
    schema: options?.schema ?? DEFAULT_SCHEMA,
    onWarning: options?.onWarning ?? null,
    json: options?.json ?? false,
    listener: options?.listener ?? null,
    scanner: new Scanner(input, options?.filename),
    anchors: Object.create(null),
    anchorMap: Object.create(null),
    tagDirectives: [...DEFAULT_TAG_PREFIXES],
    version: null,
    depth: 0,
    maxDepth: options?.maxDepth ?? 1000,
    aliasCount: 0,
    maxAliases: options?.maxAliases ?? 100,
  };
}

function throwError(state: LoaderState, message: string, mark?: Mark): never {
  throw new YAMLException(message, mark ?? state.scanner.peekToken()?.startMark ?? undefined);
}

function warn(state: LoaderState, message: string, mark?: Mark): void {
  const exc = new YAMLException(message, mark);
  if (state.onWarning) {
    state.onWarning(exc);
  }
}

// -- Token helpers --

function peekTokenType(state: LoaderState): string | null {
  const tok = state.scanner.peekToken();
  return tok ? tok.type : null;
}

function expectToken(state: LoaderState, ...types: string[]): Token {
  const tok = state.scanner.getToken();
  if (!tok) {
    throwError(state, `expected ${types.join(' or ')} but got end of stream`);
  }
  if (types.length > 0 && !types.includes(tok.type)) {
    throwError(state, `expected ${types.join(' or ')} but got ${tok.type}`, tok.startMark);
  }
  return tok;
}

// -- Tag resolution --

function resolveTag(state: LoaderState, handle: string | undefined, suffix: string | undefined): string | null {
  if (!handle && !suffix) return null;

  // Verbatim tag: !<...>
  if (handle === '!' && suffix && suffix.includes(':')) {
    return suffix;
  }

  if (handle) {
    // Look up tag directive
    for (const td of state.tagDirectives) {
      if (td.handle === handle) {
        return td.prefix + (suffix ?? '');
      }
    }
    // Default mapping
    if (handle in FAILSAFE_TAGS) {
      return FAILSAFE_TAGS[handle] + (suffix ?? '');
    }
    throwError(state, `undeclared tag handle "${handle}"`);
  }

  // Non-specific tag (just !)
  if (suffix) {
    return '!' + suffix;
  }

  return null;
}

function resolveImplicitTag(state: LoaderState, value: string, kind: 'scalar' | 'sequence' | 'mapping'): string {
  const schema = state.schema;
  for (const type of schema.compiledImplicit) {
    if (type.kind === kind && type.resolve(value)) {
      return type.tag;
    }
  }
  // Fallback tags
  if (kind === 'scalar') return 'tag:yaml.org,2002:str';
  if (kind === 'sequence') return 'tag:yaml.org,2002:seq';
  return 'tag:yaml.org,2002:map';
}

function constructValue(state: LoaderState, tag: string, value: unknown, mark?: Mark): unknown {
  const typeObj: Type | undefined = state.schema.compiledTypeMap[tag];
  if (!typeObj) {
    throwError(state, `unknown tag "${tag}"`, mark);
  }
  if (typeObj.resolve(value) === false) {
    throwError(state, `cannot resolve tag "${tag}" with the given value`, mark);
  }
  return typeObj.construct(value);
}

// -- Recursive-descent parser --

function parseStream(state: LoaderState): unknown[] {
  expectToken(state, 'STREAM-START');

  const documents: unknown[] = [];

  while (peekTokenType(state) !== 'STREAM-END') {
    // Skip document-end markers between documents
    while (peekTokenType(state) === 'DOCUMENT-END') {
      state.scanner.getToken();
    }
    if (peekTokenType(state) === 'STREAM-END') break;

    const doc = parseDocument(state);
    documents.push(doc);
  }

  expectToken(state, 'STREAM-END');
  return documents;
}

function parseDocument(state: LoaderState): unknown {
  // Reset state for each document
  state.anchors = Object.create(null);
  state.anchorMap = Object.create(null);
  state.tagDirectives = [...DEFAULT_TAG_PREFIXES];
  state.version = null;
  state.depth = 0;
  state.aliasCount = 0;

  // Process directives
  const userTagHandles = new Set<string>();
  while (peekTokenType(state) === 'DIRECTIVE') {
    const tok = state.scanner.getToken()!;
    if (tok.value === 'YAML') {
      if (state.version !== null) {
        throwError(state, 'duplicate %YAML directive', tok.startMark);
      }
      state.version = [tok.major!, tok.minor!];
      if (state.version[0] !== 1) {
        throwError(state, `unsupported YAML version: ${state.version[0]}.${state.version[1]}`, tok.startMark);
      }
    } else if (tok.value === 'TAG') {
      const handle = tok.handle!;
      const prefix = tok.prefix!;
      // Check for duplicate user TAG directive
      if (userTagHandles.has(handle)) {
        throwError(state, `duplicate %TAG directive "${handle}"`, tok.startMark);
      }
      userTagHandles.add(handle);
      // Update existing default or add new
      let found = false;
      for (const existing of state.tagDirectives) {
        if (existing.handle === handle) {
          existing.prefix = prefix;
          found = true;
          break;
        }
      }
      if (!found) {
        state.tagDirectives.push({ handle, prefix });
      }
    }
  }

  // Explicit document start
  if (peekTokenType(state) === 'DOCUMENT-START') {
    state.scanner.getToken();
  }

  let result: unknown;

  if (peekTokenType(state) === 'DOCUMENT-END' || peekTokenType(state) === 'STREAM-END') {
    // Empty document
    result = null;
  } else {
    result = parseNode(state, true, false);
  }

  // Consume document end if present
  if (peekTokenType(state) === 'DOCUMENT-END') {
    state.scanner.getToken();
  }

  return result;
}

function parseNode(state: LoaderState, _block: boolean, indentlessSequence: boolean): unknown {
  state.depth++;
  if (state.depth > state.maxDepth) {
    throwError(state, `maximum nesting depth exceeded (${state.maxDepth})`);
  }

  try {
  let anchor: string | null = null;
  let tag: string | null = null;
  let tagMark: Mark | undefined;

  const tokenType = peekTokenType(state);

  // ALIAS
  if (tokenType === 'ALIAS') {
    const tok = state.scanner.getToken()!;
    const name = tok.value!;
    if (!(name in state.anchorMap)) {
      throwError(state, `unidentified alias "${name}"`, tok.startMark);
    }
    state.aliasCount++;
    if (state.aliasCount > state.maxAliases) {
      throwError(state, `maximum number of alias dereferences exceeded (${state.maxAliases})`, tok.startMark);
    }
    return state.anchorMap[name];
  }

  // ANCHOR
  if (tokenType === 'ANCHOR') {
    const tok = state.scanner.getToken()!;
    anchor = tok.value!;
  }

  // TAG
  if (peekTokenType(state) === 'TAG') {
    const tok = state.scanner.getToken()!;
    tagMark = tok.startMark;
    tag = resolveTag(state, tok.handle, tok.value);
  }

  // If anchor came after tag, check again
  if (!anchor && peekTokenType(state) === 'ANCHOR') {
    const tok = state.scanner.getToken()!;
    anchor = tok.value!;
  }

  // Notify listener
  const listenerState = { tag, anchor };
  if (state.listener) {
    state.listener('open', listenerState);
  }

  let result: unknown;
  const nextType = peekTokenType(state);

  if (nextType === 'BLOCK-SEQUENCE-START') {
    result = parseBlockSequence(state, tag, tagMark);
  } else if (nextType === 'BLOCK-MAPPING-START') {
    result = parseBlockMapping(state, tag, tagMark);
  } else if (nextType === 'FLOW-SEQUENCE-START') {
    result = parseFlowSequence(state, tag, tagMark);
  } else if (nextType === 'FLOW-MAPPING-START') {
    result = parseFlowMapping(state, tag, tagMark);
  } else if (nextType === 'SCALAR') {
    result = parseScalar(state, tag, tagMark);
  } else if (indentlessSequence && nextType === 'BLOCK-ENTRY') {
    result = parseIndentlessSequence(state, tag, tagMark);
  } else {
    if (tag !== null) {
      // Tagged empty value — resolve as null with the given tag
      if (tag === 'tag:yaml.org,2002:null' || tag === '!') {
        result = null;
      } else {
        result = constructValue(state, tag, null, tagMark);
      }
    } else {
      // If we have an anchor but no content, it's null
      if (anchor !== null) {
        result = null;
      } else {
        const tok = state.scanner.peekToken();
        throwError(state, `unexpected token ${tok?.type ?? 'end of stream'}`, tok?.startMark);
      }
    }
  }

  // Store anchor
  if (anchor !== null) {
    state.anchorMap[anchor] = result;
  }

  if (state.listener) {
    state.listener('close', listenerState);
  }

  return result;
  } finally {
    state.depth--;
  }
}

function parseScalar(state: LoaderState, tag: string | null, tagMark?: Mark): unknown {
  const tok = state.scanner.getToken()!;
  const value = tok.value ?? '';
  const style = tok.style;

  if (tag === null || tag === '!') {
    // Implicit resolution
    if (style === 'plain') {
      // Try implicit resolvers
      const resolvedTag = resolveImplicitTag(state, value, 'scalar');
      return constructValue(state, resolvedTag, value, tok.startMark);
    }
    // Non-plain (quoted) — always string unless explicitly tagged
    return value;
  }

  // Explicit tag
  return constructValue(state, tag, value, tagMark ?? tok.startMark);
}

function parseBlockSequence(state: LoaderState, tag: string | null, tagMark?: Mark): unknown {
  const startTok = expectToken(state, 'BLOCK-SEQUENCE-START');
  const result: unknown[] = [];

  while (peekTokenType(state) === 'BLOCK-ENTRY') {
    state.scanner.getToken(); // consume BLOCK-ENTRY

    if (peekTokenType(state) === 'BLOCK-ENTRY' || peekTokenType(state) === 'BLOCK-END') {
      // Empty entry
      result.push(null);
    } else {
      result.push(parseNode(state, true, false));
    }
  }

  expectToken(state, 'BLOCK-END');

  // Apply tag
  if (tag === null || tag === '!') {
    return result;
  }
  return constructValue(state, tag, result, tagMark ?? startTok.startMark);
}

function parseIndentlessSequence(state: LoaderState, tag: string | null, tagMark?: Mark): unknown {
  const result: unknown[] = [];
  const startMark = state.scanner.peekToken()?.startMark;

  while (peekTokenType(state) === 'BLOCK-ENTRY') {
    state.scanner.getToken(); // consume BLOCK-ENTRY

    if (peekTokenType(state) === 'BLOCK-ENTRY' ||
        peekTokenType(state) === 'KEY' ||
        peekTokenType(state) === 'VALUE' ||
        peekTokenType(state) === 'BLOCK-END') {
      result.push(null);
    } else {
      result.push(parseNode(state, true, false));
    }
  }

  if (tag === null || tag === '!') {
    return result;
  }
  return constructValue(state, tag, result, tagMark ?? startMark);
}

function parseBlockMapping(state: LoaderState, tag: string | null, tagMark?: Mark): unknown {
  const startTok = expectToken(state, 'BLOCK-MAPPING-START');
  const result: Record<string, unknown> = Object.create(null);
  const keySet = new Set<string>();

  while (peekTokenType(state) === 'KEY' || peekTokenType(state) === 'VALUE') {
    let key: unknown = null;
    let value: unknown = null;

    if (peekTokenType(state) === 'KEY') {
      state.scanner.getToken(); // consume KEY

      if (peekTokenType(state) !== 'KEY' &&
          peekTokenType(state) !== 'VALUE' &&
          peekTokenType(state) !== 'BLOCK-END') {
        key = parseNode(state, true, true);
      }
    }

    if (peekTokenType(state) === 'VALUE') {
      state.scanner.getToken(); // consume VALUE

      if (peekTokenType(state) !== 'KEY' &&
          peekTokenType(state) !== 'VALUE' &&
          peekTokenType(state) !== 'BLOCK-END') {
        value = parseNode(state, true, true);
      }
    }

    const keyStr = stringifyKey(key);

    // Duplicate key check
    if (keySet.has(keyStr)) {
      if (!state.json) {
        warn(state, `duplicate key "${keyStr}"`, state.scanner.peekToken()?.startMark);
      }
    }
    keySet.add(keyStr);

    // Handle merge keys
    if (keyStr === '<<' && isMergeKey(state, key)) {
      if (Array.isArray(value)) {
        // Multiple merge sources
        for (const item of value) {
          if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            mergeInto(result, item as Record<string, unknown>);
          }
        }
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        mergeInto(result, value as Record<string, unknown>);
      }
    } else {
      result[keyStr] = value;
    }
  }

  expectToken(state, 'BLOCK-END');

  if (tag === null || tag === '!') {
    return result;
  }
  return constructValue(state, tag, result, tagMark ?? startTok.startMark);
}

function parseFlowSequence(state: LoaderState, tag: string | null, tagMark?: Mark): unknown {
  const startTok = expectToken(state, 'FLOW-SEQUENCE-START');
  const result: unknown[] = [];

  while (peekTokenType(state) !== 'FLOW-SEQUENCE-END') {
    if (result.length > 0) {
      expectToken(state, 'FLOW-ENTRY');
      // Allow trailing comma
      if (peekTokenType(state) === 'FLOW-SEQUENCE-END') break;
    }

    if (peekTokenType(state) === 'KEY') {
      // Inline mapping within flow sequence: { key: value }
      const pair: Record<string, unknown> = Object.create(null);
      state.scanner.getToken(); // consume KEY

      let pairKey: unknown = null;
      if (peekTokenType(state) !== 'VALUE' &&
          peekTokenType(state) !== 'FLOW-ENTRY' &&
          peekTokenType(state) !== 'FLOW-SEQUENCE-END') {
        pairKey = parseNode(state, false, false);
      }

      let pairValue: unknown = null;
      if (peekTokenType(state) === 'VALUE') {
        state.scanner.getToken(); // consume VALUE
        if (peekTokenType(state) !== 'FLOW-ENTRY' &&
            peekTokenType(state) !== 'FLOW-SEQUENCE-END') {
          pairValue = parseNode(state, false, false);
        }
      }

      pair[stringifyKey(pairKey)] = pairValue;
      result.push(pair);
    } else {
      result.push(parseNode(state, false, false));
    }
  }

  expectToken(state, 'FLOW-SEQUENCE-END');

  if (tag === null || tag === '!') {
    return result;
  }
  return constructValue(state, tag, result, tagMark ?? startTok.startMark);
}

function parseFlowMapping(state: LoaderState, tag: string | null, tagMark?: Mark): unknown {
  const startTok = expectToken(state, 'FLOW-MAPPING-START');
  const result: Record<string, unknown> = Object.create(null);
  const keySet = new Set<string>();
  let first = true;

  while (peekTokenType(state) !== 'FLOW-MAPPING-END') {
    if (!first) {
      expectToken(state, 'FLOW-ENTRY');
      // Allow trailing comma
      if (peekTokenType(state) === 'FLOW-MAPPING-END') break;
    }
    first = false;

    let key: unknown = null;
    let value: unknown = null;

    if (peekTokenType(state) === 'KEY') {
      state.scanner.getToken(); // consume KEY

      if (peekTokenType(state) !== 'VALUE' &&
          peekTokenType(state) !== 'FLOW-ENTRY' &&
          peekTokenType(state) !== 'FLOW-MAPPING-END') {
        key = parseNode(state, false, false);
      }
    } else {
      // Implicit key
      key = parseNode(state, false, false);
    }

    if (peekTokenType(state) === 'VALUE') {
      state.scanner.getToken(); // consume VALUE

      if (peekTokenType(state) !== 'FLOW-ENTRY' &&
          peekTokenType(state) !== 'FLOW-MAPPING-END') {
        value = parseNode(state, false, false);
      }
    }

    const keyStr = stringifyKey(key);

    if (keySet.has(keyStr)) {
      if (!state.json) {
        warn(state, `duplicate key "${keyStr}"`);
      }
    }
    keySet.add(keyStr);

    if (keyStr === '<<' && isMergeKey(state, key)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            mergeInto(result, item as Record<string, unknown>);
          }
        }
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        mergeInto(result, value as Record<string, unknown>);
      }
    } else {
      result[keyStr] = value;
    }
  }

  expectToken(state, 'FLOW-MAPPING-END');

  if (tag === null || tag === '!') {
    return result;
  }
  return constructValue(state, tag, result, tagMark ?? startTok.startMark);
}

// -- Helpers --

function stringifyKey(key: unknown): string {
  if (key === null || key === undefined) return 'null';
  if (typeof key === 'object') return JSON.stringify(key);
  return String(key);
}

function isMergeKey(state: LoaderState, key: unknown): boolean {
  // Check if the merge type is in the schema
  const mergeType = state.schema.compiledTypeMap['tag:yaml.org,2002:merge'];
  if (!mergeType) return false;
  return key === '<<';
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (!(key in target)) {
      target[key] = source[key];
    }
  }
}

// -- Public API --

export function load(input: string, options?: LoadOptions): unknown {
  if (typeof input !== 'string') {
    throwSimple('input must be a string');
  }

  if (input.length === 0) return undefined;

  const state = createState(input, options);
  const documents = parseStream(state);

  if (documents.length === 0) return undefined;
  if (documents.length === 1) return documents[0];

  throw new YAMLException('expected a single document in the stream, but found more');
}

export function loadAll(
  input: string,
  iteratorOrOptions?: ((doc: unknown) => void) | LoadOptions,
  options?: LoadOptions,
): unknown[] | void {
  if (typeof input !== 'string') {
    throwSimple('input must be a string');
  }

  let iterator: ((doc: unknown) => void) | undefined;
  let opts: LoadOptions | undefined;

  if (typeof iteratorOrOptions === 'function') {
    iterator = iteratorOrOptions;
    opts = options;
  } else {
    opts = iteratorOrOptions;
  }

  if (input.length === 0) return [];

  const state = createState(input, opts);
  const documents = parseStream(state);

  if (iterator) {
    for (const doc of documents) {
      iterator(doc);
    }
    return;
  }

  return documents;
}

function throwSimple(message: string): never {
  throw new YAMLException(message);
}
