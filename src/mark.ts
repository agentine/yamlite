export class Mark {
  name: string | null;
  buffer: string;
  position: number;
  line: number;
  column: number;

  constructor(
    name: string | null,
    buffer: string,
    position: number,
    line: number,
    column: number,
  ) {
    this.name = name;
    this.buffer = buffer;
    this.position = position;
    this.line = line;
    this.column = column;
  }

  getSnippet(indent = 4, maxLength = 75): string | null {
    if (!this.buffer) return null;

    let head = '';
    let start = this.position;

    while (start > 0 && '\x00\r\n\x85\u2028\u2029'.indexOf(this.buffer.charAt(start - 1)) === -1) {
      start -= 1;
      if (this.position - start > maxLength / 2 - 1) {
        head = ' ... ';
        start += 5;
        break;
      }
    }

    let tail = '';
    let end = this.position;

    while (end < this.buffer.length && '\x00\r\n\x85\u2028\u2029'.indexOf(this.buffer.charAt(end)) === -1) {
      end += 1;
      if (end - start > maxLength - 2) {
        tail = ' ...';
        end -= 4;
        break;
      }
    }

    const snippet = this.buffer.slice(start, end);
    const prefix = ' '.repeat(indent);
    const caret = ' '.repeat(indent + this.position - start + head.length) + '^';

    return prefix + head + snippet + tail + '\n' + caret;
  }

  toString(compact?: boolean): string {
    let where = '';

    if (this.name) {
      where += `in "${this.name}" `;
    }

    where += `at line ${this.line + 1}, column ${this.column + 1}`;

    if (!compact) {
      const snippet = this.getSnippet();
      if (snippet) {
        where += ':\n' + snippet;
      }
    }

    return where;
  }
}
