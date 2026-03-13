import { Type } from '../type.js';

export const set = new Type('tag:yaml.org,2002:set', {
  kind: 'mapping',
  resolve: (data) => {
    if (data === null || typeof data !== 'object') return false;
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (value !== null) return false;
    }
    return true;
  },
  construct: (data) => data,
});
