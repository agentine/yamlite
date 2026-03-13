import type { Schema } from './schema.js';
import type { YAMLException } from './exception.js';

export interface LoadOptions {
  filename?: string;
  schema?: Schema;
  onWarning?: (warning: YAMLException) => void;
  json?: boolean;
  listener?: (eventType: 'open' | 'close', state: object) => void;
}

export function load(_input: string, _options?: LoadOptions): unknown {
  // Stub — implemented in Phase 1.3.
  throw new Error('load() is not yet implemented');
}

export function loadAll(
  _input: string,
  _iterator?: (doc: unknown) => void,
  _options?: LoadOptions,
): unknown[] {
  // Stub — implemented in Phase 1.3.
  throw new Error('loadAll() is not yet implemented');
}
