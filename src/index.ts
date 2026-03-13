export { YAMLException } from './exception.js';
export { Mark } from './mark.js';
export { Type } from './type.js';
export { Schema } from './schema.js';

// Schema instances — will be populated by schema modules.
export { FAILSAFE_SCHEMA } from './schemas/failsafe.js';
export { JSON_SCHEMA } from './schemas/json.js';
export { CORE_SCHEMA } from './schemas/core.js';
export { DEFAULT_SCHEMA } from './schemas/default.js';

// Built-in types map.
export { types } from './types/index.js';

// Core functions — stubs until loader/dumper are implemented.
export type { LoadOptions } from './loader.js';
export { load, loadAll } from './loader.js';

export type { DumpOptions } from './dumper.js';
export { dump } from './dumper.js';

// Deprecated functions (js-yaml v3 → v4 migration).
export function safeLoad(): never {
  throw new Error(
    'Function "safeLoad" is removed. Use "load" instead — it is now safe by default.',
  );
}

export function safeLoadAll(): never {
  throw new Error(
    'Function "safeLoadAll" is removed. Use "loadAll" instead — it is now safe by default.',
  );
}

export function safeDump(): never {
  throw new Error(
    'Function "safeDump" is removed. Use "dump" instead — it is now safe by default.',
  );
}
