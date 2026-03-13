import { Type } from '../type.js';

const YAML_INTEGER_PATTERN = /^[-+]?(?:0b[01]+|0o[0-7]+|0x[0-9a-fA-F]+|0[0-7]+|0|[1-9][0-9]*)$/;

export const int = new Type('tag:yaml.org,2002:int', {
  kind: 'scalar',
  resolve: (data) => {
    if (data === null) return false;
    return YAML_INTEGER_PATTERN.test(String(data));
  },
  construct: (data) => {
    let value = String(data);

    if (value.startsWith('0b') || value.startsWith('-0b') || value.startsWith('+0b')) {
      const sign = value.startsWith('-') ? -1 : 1;
      value = value.replace(/^[+-]?0b/, '');
      return sign * parseInt(value, 2);
    }
    if (value.startsWith('0o') || value.startsWith('-0o') || value.startsWith('+0o')) {
      const sign = value.startsWith('-') ? -1 : 1;
      value = value.replace(/^[+-]?0o/, '');
      return sign * parseInt(value, 8);
    }
    if (value.startsWith('0x') || value.startsWith('-0x') || value.startsWith('+0x')) {
      return parseInt(value, 16);
    }
    // Old-style octal: 010 = 8 (YAML 1.1 compat, same as js-yaml v4)
    const stripped = value.replace(/^[+-]/, '');
    if (stripped.length > 1 && stripped.startsWith('0') && /^[0-7]+$/.test(stripped)) {
      const sign = value.startsWith('-') ? -1 : 1;
      return sign * parseInt(stripped, 8);
    }
    return parseInt(value, 10);
  },
  predicate: (data) => typeof data === 'number' && Number.isInteger(data) && !isNaN(data) && !Object.is(data, -0),
  represent: {
    binary: (data) => (data as number) >= 0
      ? '0b' + (data as number).toString(2)
      : '-0b' + (-(data as number)).toString(2),
    octal: (data) => (data as number) >= 0
      ? '0o' + (data as number).toString(8)
      : '-0o' + (-(data as number)).toString(8),
    decimal: (data) => String(data),
    hexadecimal: (data) => (data as number) >= 0
      ? '0x' + (data as number).toString(16).toUpperCase()
      : '-0x' + (-(data as number)).toString(16).toUpperCase(),
  },
  defaultStyle: 'decimal',
  styleAliases: {
    binary: ['2', 'bin'],
    octal: ['8', 'oct'],
    decimal: ['10', 'dec'],
    hexadecimal: ['16', 'hex'],
  },
});
