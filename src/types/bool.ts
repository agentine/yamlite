import { Type } from '../type.js';

export const bool = new Type('tag:yaml.org,2002:bool', {
  kind: 'scalar',
  resolve: (data) => {
    if (data === null) return false;
    const s = String(data).toLowerCase();
    return s === 'true' || s === 'false';
  },
  construct: (data) => String(data).toLowerCase() === 'true',
  predicate: (data) => typeof data === 'boolean',
  represent: {
    lowercase: (data) => (data ? 'true' : 'false'),
    uppercase: (data) => (data ? 'TRUE' : 'FALSE'),
    camelcase: (data) => (data ? 'True' : 'False'),
  },
  defaultStyle: 'lowercase',
});
