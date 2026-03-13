import { Schema } from '../schema.js';
import { CORE_SCHEMA } from './core.js';
import { binary } from '../types/binary.js';
import { omap } from '../types/omap.js';
import { pairs } from '../types/pairs.js';
import { set } from '../types/set.js';
import { timestamp } from '../types/timestamp.js';
import { merge } from '../types/merge.js';

export const DEFAULT_SCHEMA = new Schema({
  include: [CORE_SCHEMA],
  implicit: [timestamp, merge],
  explicit: [binary, omap, pairs, set],
});
