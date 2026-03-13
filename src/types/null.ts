import { Type } from '../type.js';

export const _null = new Type('tag:yaml.org,2002:null', {
  kind: 'scalar',
  resolve: (data) => {
    if (data === null) return true;
    const s = String(data);
    return s === '' || s === '~' || s.toLowerCase() === 'null';
  },
  construct: () => null,
  predicate: (data) => data === null,
  represent: {
    canonical: () => '~',
    lowercase: () => 'null',
    uppercase: () => 'NULL',
    camelcase: () => 'Null',
    empty: () => '',
  },
  defaultStyle: 'lowercase',
});
