import { Type } from '../type.js';

const YAML_DATE_REGEXP = /^(\d{4})-(\d{2})-(\d{2})$/;

const YAML_TIMESTAMP_REGEXP =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt ](\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:[ ]*(?:Z|([+-]\d{1,2})(?::(\d{2}))?))?)?$/;

export const timestamp = new Type('tag:yaml.org,2002:timestamp', {
  kind: 'scalar',
  resolve: (data) => {
    if (data === null) return false;
    const s = String(data);
    return YAML_DATE_REGEXP.test(s) || YAML_TIMESTAMP_REGEXP.test(s);
  },
  construct: (data) => {
    const s = String(data);
    const dateMatch = YAML_DATE_REGEXP.exec(s);
    if (dateMatch) {
      return new Date(Date.UTC(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3]));
    }
    const match = YAML_TIMESTAMP_REGEXP.exec(s);
    if (!match) return new Date(NaN);

    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    const hour = match[4] ? +match[4] : 0;
    const minute = match[5] ? +match[5] : 0;
    const second = match[6] ? +match[6] : 0;

    let fraction = 0;
    if (match[7]) {
      let frac = match[7].slice(0, 3);
      while (frac.length < 3) frac += '0';
      fraction = +frac;
    }

    let delta = 0;
    if (match[8]) {
      delta = +match[8] * 60;
      if (match[9]) delta += (delta > 0 ? +match[9] : -+match[9]);
      delta *= -60000; // convert to ms offset
    }

    return new Date(Date.UTC(year, month, day, hour, minute, second, fraction) + delta);
  },
  instanceOf: Date,
  represent: (data) => (data as Date).toISOString(),
});
