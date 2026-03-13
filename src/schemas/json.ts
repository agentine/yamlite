import { Schema } from '../schema.js';
import { FAILSAFE_SCHEMA } from './failsafe.js';
import { _null } from '../types/null.js';
import { bool } from '../types/bool.js';
import { int } from '../types/int.js';
import { float } from '../types/float.js';

export const JSON_SCHEMA = new Schema({
  include: [FAILSAFE_SCHEMA],
  implicit: [_null, bool, int, float],
});
