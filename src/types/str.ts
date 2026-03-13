import { Type } from '../type.js';

export const str = new Type('tag:yaml.org,2002:str', {
  kind: 'scalar',
  construct: (data) => data !== null ? String(data) : '',
});
