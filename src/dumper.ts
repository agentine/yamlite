import type { Schema } from './schema.js';

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

export function dump(_input: unknown, _options?: DumpOptions): string {
  // Stub — implemented in Phase 3.
  throw new Error('dump() is not yet implemented');
}
