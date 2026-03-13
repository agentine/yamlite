import { Schema } from '../schema.js';
import { str } from '../types/str.js';
import { seq } from '../types/seq.js';
import { map } from '../types/map.js';

export const FAILSAFE_SCHEMA = new Schema({
  explicit: [str, seq, map],
});
