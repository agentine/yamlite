import { Type } from '../type.js';

const BASE64_CHARS = /^[A-Za-z0-9+/\n\r =]+$/;

export const binary = new Type('tag:yaml.org,2002:binary', {
  kind: 'scalar',
  resolve: (data) => {
    if (data === null) return false;
    return BASE64_CHARS.test(String(data));
  },
  construct: (data) => {
    const cleaned = String(data).replace(/[\s\r\n]/g, '');
    return Buffer.from(cleaned, 'base64');
  },
  predicate: (data) => Buffer.isBuffer(data),
  represent: (data) => {
    const b64 = (data as Buffer).toString('base64');
    // Wrap at 76 characters per line.
    const lines: string[] = [];
    for (let i = 0; i < b64.length; i += 76) {
      lines.push(b64.slice(i, i + 76));
    }
    return lines.join('\n');
  },
});
