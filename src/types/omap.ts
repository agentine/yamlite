import { Type } from '../type.js';

export const omap = new Type('tag:yaml.org,2002:omap', {
  kind: 'sequence',
  resolve: (data) => {
    if (!Array.isArray(data)) return false;
    const keys = new Set<string>();
    for (const item of data) {
      if (item === null || typeof item !== 'object') return false;
      const itemKeys = Object.keys(item as Record<string, unknown>);
      if (itemKeys.length !== 1) return false;
      if (keys.has(itemKeys[0])) return false;
      keys.add(itemKeys[0]);
    }
    return true;
  },
  construct: (data) => data,
});
