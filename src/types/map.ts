import { Type } from '../type.js';

export const map = new Type('tag:yaml.org,2002:map', {
  kind: 'mapping',
  construct: (data) => data !== null ? data : {},
});
