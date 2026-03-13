import { Type } from '../type.js';

export const merge = new Type('tag:yaml.org,2002:merge', {
  kind: 'scalar',
  resolve: (data) => String(data) === '<<',
});
