import { Type } from '../type.js';

const YAML_FLOAT_PATTERN =
  /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?$|^[-+]?\.(?:inf|Inf|INF)$|^\.(?:nan|NaN|NAN)$/;

export const float = new Type('tag:yaml.org,2002:float', {
  kind: 'scalar',
  resolve: (data) => {
    if (data === null) return false;
    return YAML_FLOAT_PATTERN.test(String(data));
  },
  construct: (data) => {
    let value = String(data).replace(/_/g, '').toLowerCase();

    if (value === '.inf' || value === '+.inf') return Infinity;
    if (value === '-.inf') return -Infinity;
    if (value === '.nan') return NaN;
    return parseFloat(value);
  },
  predicate: (data) =>
    typeof data === 'number' &&
    (data % 1 !== 0 || data === Infinity || data === -Infinity || Number.isNaN(data)),
  represent: (data, style) => {
    const value = data as number;
    if (isNaN(value)) return '.nan';
    if (value === Infinity) return '.inf';
    if (value === -Infinity) return '-.inf';
    if (style === 'uppercase') return String(value).toUpperCase();
    if (style === 'camelcase') {
      // Won't typically be used for float, but match js-yaml
      return String(value);
    }
    return String(value);
  },
  defaultStyle: 'lowercase',
});
