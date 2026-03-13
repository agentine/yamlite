import { Mark } from './mark.js';

export class YAMLException extends Error {
  override name = 'YAMLException' as const;
  reason: string;
  mark: Mark | null;

  constructor(reason: string, mark?: Mark | null) {
    super();
    this.reason = reason;
    this.mark = mark ?? null;
    this.message = this.toString(false);
  }

  override toString(compact?: boolean): string {
    let result = 'YAMLException: ';

    if (this.reason) {
      result += this.reason;
    }

    if (this.mark) {
      result += ' ' + this.mark.toString(compact);
    }

    return result;
  }
}
