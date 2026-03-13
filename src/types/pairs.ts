import { Type } from '../type.js';

export const pairs = new Type('tag:yaml.org,2002:pairs', {
  kind: 'sequence',
  resolve: (data) => {
    if (!Array.isArray(data)) return false;
    for (const item of data) {
      if (item === null || typeof item !== 'object') return false;
      if (Object.keys(item as Record<string, unknown>).length !== 1) return false;
    }
    return true;
  },
  construct: (data) => {
    if (!Array.isArray(data)) return [];
    return data.map((item) => {
      const obj = item as Record<string, unknown>;
      const key = Object.keys(obj)[0];
      return [key, obj[key]];
    });
  },
});
