import { Type } from '../type.js';

export const seq = new Type('tag:yaml.org,2002:seq', {
  kind: 'sequence',
  construct: (data) => data !== null ? data : [],
});
