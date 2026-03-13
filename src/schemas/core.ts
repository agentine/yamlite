import { Schema } from '../schema.js';
import { JSON_SCHEMA } from './json.js';

// CORE_SCHEMA is the same as JSON_SCHEMA with identical implicit resolvers.
// The difference is in how the loader handles untagged values — CORE_SCHEMA
// supports additional implicit patterns (hex 0x, octal 0o, true/false/null/~).
// Since our type resolvers already handle these, CORE extends JSON directly.
export const CORE_SCHEMA = new Schema({
  include: [JSON_SCHEMA],
});
