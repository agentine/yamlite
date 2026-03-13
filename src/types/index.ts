import { Type } from '../type.js';
import { str } from './str.js';
import { seq } from './seq.js';
import { map } from './map.js';
import { _null } from './null.js';
import { bool } from './bool.js';
import { int } from './int.js';
import { float } from './float.js';
import { binary } from './binary.js';
import { timestamp } from './timestamp.js';
import { merge } from './merge.js';
import { omap } from './omap.js';
import { pairs } from './pairs.js';
import { set } from './set.js';

export const types: Record<string, Type> = {
  binary,
  bool,
  float,
  int,
  map,
  merge,
  null: _null,
  omap,
  pairs,
  seq,
  set,
  str,
  timestamp,
};

export { str, seq, map, _null, bool, int, float, binary, timestamp, merge, omap, pairs, set };
