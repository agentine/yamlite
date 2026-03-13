import { YAMLException } from './exception.js';
import { Mark } from './mark.js';
import {
  CHAR_TAB,
  CHAR_LINE_FEED,
  CHAR_CARRIAGE_RETURN,
  CHAR_SPACE,
  CHAR_EXCLAMATION,
  CHAR_DOUBLE_QUOTE,
  CHAR_SHARP,
  CHAR_PERCENT,
  CHAR_AMPERSAND,
  CHAR_SINGLE_QUOTE,
  CHAR_ASTERISK,
  CHAR_COMMA,
  CHAR_MINUS,
  CHAR_DOT,
  CHAR_COLON,
  CHAR_GREATER_THAN,
  CHAR_QUESTION,
  CHAR_COMMERCIAL_AT,
  CHAR_LEFT_SQUARE_BRACKET,
  CHAR_RIGHT_SQUARE_BRACKET,
  CHAR_GRAVE_ACCENT,
  CHAR_LEFT_CURLY_BRACKET,
  CHAR_VERTICAL_LINE,
  CHAR_RIGHT_CURLY_BRACKET,
  CHAR_BOM,
  isWhiteSpace,
  isEOL,
  isWhiteSpaceOrEOL,
  isFlowIndicator,
  isHexCode,
  fromHexCode,
  SIMPLE_ESCAPE_SEQUENCES,
} from './common.js';

// Token types
export interface Token {
  type: string;
  value?: string;
  style?: string;
  startMark: Mark;
  endMark: Mark;
  // Directive-specific
  major?: number;
  minor?: number;
  handle?: string;
  prefix?: string;
}

interface SimpleKey {
  tokenNumber: number;
  line: number;
  column: number;
  position: number;
  required: boolean;
}

export class Scanner {
  input: string;
  length: number;
  position: number;
  line: number;
  lineStart: number;
  tokens: Token[];
  tokensTaken: number;
  flowLevel: number;
  indent: number;
  indents: number[];
  simpleKeyAllowed: boolean;
  possibleSimpleKeys: Record<number, SimpleKey>;
  done: boolean;
  filename: string | null;

  constructor(input: string, filename?: string) {
    // Strip BOM
    if (input.charCodeAt(0) === CHAR_BOM) {
      input = input.slice(1);
    }

    this.input = input;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.tokens = [];
    this.tokensTaken = 0;
    this.flowLevel = 0;
    this.indent = -1;
    this.indents = [];
    this.simpleKeyAllowed = true;
    this.possibleSimpleKeys = {};
    this.done = false;
    this.filename = filename ?? null;

    // Emit STREAM-START
    this.tokens.push(this.makeToken('STREAM-START', this.mark(), this.mark()));
  }

  // -- Public API --

  checkToken(...types: string[]): boolean {
    while (this.needMoreTokens()) {
      this.fetchMoreTokens();
    }
    if (this.tokens.length > 0) {
      if (types.length === 0) return true;
      return types.includes(this.tokens[0].type);
    }
    return false;
  }

  peekToken(): Token | null {
    while (this.needMoreTokens()) {
      this.fetchMoreTokens();
    }
    return this.tokens.length > 0 ? this.tokens[0] : null;
  }

  getToken(): Token | null {
    while (this.needMoreTokens()) {
      this.fetchMoreTokens();
    }
    if (this.tokens.length > 0) {
      this.tokensTaken++;
      return this.tokens.shift()!;
    }
    return null;
  }

  // -- Helpers --

  private mark(): Mark {
    return new Mark(
      this.filename,
      this.input,
      this.position,
      this.line,
      this.position - this.lineStart,
    );
  }

  private makeToken(type: string, startMark: Mark, endMark: Mark, extra?: Partial<Token>): Token {
    return { type, startMark, endMark, ...extra };
  }

  private throwError(message: string, mark?: Mark): never {
    throw new YAMLException(message, mark ?? this.mark());
  }

  private peek(offset = 0): number {
    const pos = this.position + offset;
    return pos < this.length ? this.input.charCodeAt(pos) : 0;
  }

  private peekChar(offset = 0): string {
    const pos = this.position + offset;
    return pos < this.length ? this.input[pos] : '\0';
  }

  private forward(count = 1): void {
    for (let i = 0; i < count; i++) {
      const ch = this.peek();
      if (ch === CHAR_LINE_FEED || (ch === CHAR_CARRIAGE_RETURN && this.peek(1) !== CHAR_LINE_FEED)) {
        this.line++;
        this.lineStart = this.position + 1;
      }
      this.position++;
    }
  }

  // -- Token stream control --

  private needMoreTokens(): boolean {
    if (this.done) return false;
    if (this.tokens.length === 0) return true;

    this.stalePossibleSimpleKeys();

    // Check if current token could be a simple key
    const key = this.possibleSimpleKeys[this.flowLevel];
    if (key && key.tokenNumber === this.tokensTaken) {
      return true;
    }

    return false;
  }

  private fetchMoreTokens(): void {
    this.scanToNextToken();

    this.stalePossibleSimpleKeys();
    this.unwindIndent(this.position - this.lineStart);

    const ch = this.peek();

    if (ch === 0 && this.position >= this.length) {
      return this.fetchStreamEnd();
    }

    if (ch === CHAR_PERCENT && this.checkDirective()) {
      return this.fetchDirective();
    }
    if (ch === CHAR_MINUS && this.checkDocumentStart()) {
      return this.fetchDocumentStart();
    }
    if (ch === CHAR_DOT && this.checkDocumentEnd()) {
      return this.fetchDocumentEnd();
    }

    if (ch === CHAR_LEFT_SQUARE_BRACKET) return this.fetchFlowCollectionStart('FLOW-SEQUENCE-START');
    if (ch === CHAR_LEFT_CURLY_BRACKET) return this.fetchFlowCollectionStart('FLOW-MAPPING-START');
    if (ch === CHAR_RIGHT_SQUARE_BRACKET) return this.fetchFlowCollectionEnd('FLOW-SEQUENCE-END');
    if (ch === CHAR_RIGHT_CURLY_BRACKET) return this.fetchFlowCollectionEnd('FLOW-MAPPING-END');
    if (ch === CHAR_COMMA) return this.fetchFlowEntry();
    if (ch === CHAR_MINUS && this.checkBlockEntry()) return this.fetchBlockEntry();
    if (ch === CHAR_QUESTION && this.checkKey()) return this.fetchKey();
    if (ch === CHAR_COLON && this.checkValue()) return this.fetchValue();
    if (ch === CHAR_ASTERISK) return this.fetchAlias();
    if (ch === CHAR_AMPERSAND) return this.fetchAnchor();
    if (ch === CHAR_EXCLAMATION) return this.fetchTag();
    if (ch === CHAR_VERTICAL_LINE && this.flowLevel === 0) return this.fetchBlockScalar('literal');
    if (ch === CHAR_GREATER_THAN && this.flowLevel === 0) return this.fetchBlockScalar('folded');
    if (ch === CHAR_SINGLE_QUOTE) return this.fetchFlowScalar('single');
    if (ch === CHAR_DOUBLE_QUOTE) return this.fetchFlowScalar('double');

    if (this.checkPlainScalar()) return this.fetchPlainScalar();

    this.throwError(`unexpected character ${String.fromCharCode(ch)} (${ch})`);
  }

  // -- Indentation --

  private unwindIndent(column: number): void {
    if (this.flowLevel !== 0) return;

    while (this.indent > column) {
      const mark = this.mark();
      this.indent = this.indents.pop()!;
      this.tokens.push(this.makeToken('BLOCK-END', mark, mark));
    }
  }

  private addIndent(column: number): boolean {
    if (this.indent < column) {
      this.indents.push(this.indent);
      this.indent = column;
      return true;
    }
    return false;
  }

  // -- Simple keys --

  private savePossibleSimpleKey(): void {
    const required = this.flowLevel === 0 && this.indent === (this.position - this.lineStart);
    if (this.simpleKeyAllowed) {
      this.removePossibleSimpleKey();
      this.possibleSimpleKeys[this.flowLevel] = {
        tokenNumber: this.tokensTaken + this.tokens.length,
        line: this.line,
        column: this.position - this.lineStart,
        position: this.position,
        required,
      };
    }
  }

  private removePossibleSimpleKey(): void {
    const key = this.possibleSimpleKeys[this.flowLevel];
    if (key && key.required) {
      this.throwError('while scanning a simple key, could not find expected ":"');
    }
    delete this.possibleSimpleKeys[this.flowLevel];
  }

  private stalePossibleSimpleKeys(): void {
    for (const level of Object.keys(this.possibleSimpleKeys)) {
      const key = this.possibleSimpleKeys[+level];
      if (key && (key.line !== this.line || this.position - key.position > 1024)) {
        if (key.required) {
          this.throwError('while scanning a simple key, could not find expected ":"');
        }
        delete this.possibleSimpleKeys[+level];
      }
    }
  }

  // -- Whitespace / comments --

  private scanToNextToken(): void {
    for (;;) {
      // Skip spaces (and tabs in flow context)
      while (this.peek() === CHAR_SPACE || (this.flowLevel > 0 && this.peek() === CHAR_TAB)) {
        this.forward();
      }

      // Skip comment
      if (this.peek() === CHAR_SHARP) {
        while (!isEOL(this.peek()) && this.peek() !== 0) {
          this.forward();
        }
      }

      // Skip line break
      if (this.scanLineBreak()) {
        if (this.flowLevel === 0) {
          this.simpleKeyAllowed = true;
        }
      } else {
        break;
      }
    }
  }

  private scanLineBreak(): string {
    const ch = this.peek();
    if (ch === CHAR_LINE_FEED) {
      this.forward();
      return '\n';
    }
    if (ch === CHAR_CARRIAGE_RETURN) {
      if (this.peek(1) === CHAR_LINE_FEED) {
        this.forward(2);
      } else {
        this.forward();
      }
      return '\n';
    }
    return '';
  }

  // -- Checkers --

  private checkDirective(): boolean {
    return this.position - this.lineStart === 0;
  }

  private checkDocumentStart(): boolean {
    if (this.position - this.lineStart !== 0) return false;
    if (this.peek() === CHAR_MINUS && this.peek(1) === CHAR_MINUS && this.peek(2) === CHAR_MINUS) {
      const after = this.peek(3);
      return after === 0 || isWhiteSpaceOrEOL(after);
    }
    return false;
  }

  private checkDocumentEnd(): boolean {
    if (this.position - this.lineStart !== 0) return false;
    if (this.peek() === CHAR_DOT && this.peek(1) === CHAR_DOT && this.peek(2) === CHAR_DOT) {
      const after = this.peek(3);
      return after === 0 || isWhiteSpaceOrEOL(after);
    }
    return false;
  }

  private checkBlockEntry(): boolean {
    const after = this.peek(1);
    return isWhiteSpaceOrEOL(after) || after === 0;
  }

  private checkKey(): boolean {
    if (this.flowLevel !== 0) return true;
    const after = this.peek(1);
    return isWhiteSpaceOrEOL(after) || after === 0;
  }

  private checkValue(): boolean {
    if (this.flowLevel !== 0) return true;
    const after = this.peek(1);
    return isWhiteSpaceOrEOL(after) || after === 0;
  }

  private checkPlainScalar(): boolean {
    const ch = this.peek();
    if (ch === 0) return false;
    if (isWhiteSpaceOrEOL(ch)) return false;
    if (ch === CHAR_MINUS || ch === CHAR_QUESTION || ch === CHAR_COLON) {
      const after = this.peek(1);
      if (isWhiteSpaceOrEOL(after) && this.flowLevel === 0) return false;
      if (ch === CHAR_COLON && this.flowLevel !== 0) {
        const after2 = this.peek(1);
        if (isWhiteSpaceOrEOL(after2) || isFlowIndicator(after2)) return false;
      }
    }
    if ((ch === CHAR_COMMERCIAL_AT || ch === CHAR_GRAVE_ACCENT) && this.flowLevel === 0) {
      return false;
    }
    return true;
  }

  // -- Fetchers --

  private fetchStreamEnd(): void {
    this.unwindIndent(-1);
    this.removePossibleSimpleKey();
    this.simpleKeyAllowed = false;
    const mark = this.mark();
    this.tokens.push(this.makeToken('STREAM-END', mark, mark));
    this.done = true;
  }

  private fetchDirective(): void {
    this.unwindIndent(-1);
    this.removePossibleSimpleKey();
    this.simpleKeyAllowed = false;

    const startMark = this.mark();
    this.forward(); // skip %

    const name = this.scanDirectiveName();
    let token: Token;

    if (name === 'YAML') {
      const [major, minor] = this.scanYamlDirectiveValue();
      token = this.makeToken('DIRECTIVE', startMark, this.mark(), { value: name, major, minor });
    } else if (name === 'TAG') {
      const [handle, prefix] = this.scanTagDirectiveValue();
      token = this.makeToken('DIRECTIVE', startMark, this.mark(), { value: name, handle, prefix });
    } else {
      // Unknown directive — skip to end of line.
      while (!isEOL(this.peek()) && this.peek() !== 0) {
        this.forward();
      }
      token = this.makeToken('DIRECTIVE', startMark, this.mark(), { value: name });
    }

    this.tokens.push(token);
  }

  private scanDirectiveName(): string {
    let name = '';
    let ch = this.peek();
    while (ch !== 0 && !isWhiteSpaceOrEOL(ch)) {
      name += this.peekChar();
      this.forward();
      ch = this.peek();
    }
    if (!name) {
      this.throwError('while scanning a directive, expected directive name');
    }
    return name;
  }

  private scanYamlDirectiveValue(): [number, number] {
    while (this.peek() === CHAR_SPACE) this.forward();
    const major = this.scanYamlDirectiveNumber();
    if (this.peek() !== CHAR_DOT) {
      this.throwError('while scanning a YAML directive, expected "."');
    }
    this.forward();
    const minor = this.scanYamlDirectiveNumber();
    return [major, minor];
  }

  private scanYamlDirectiveNumber(): number {
    const start = this.position;
    let ch = this.peek();
    while (ch >= 0x30 && ch <= 0x39) {
      this.forward();
      ch = this.peek();
    }
    if (this.position === start) {
      this.throwError('while scanning a YAML directive, expected version number');
    }
    return parseInt(this.input.slice(start, this.position), 10);
  }

  private scanTagDirectiveValue(): [string, string] {
    while (this.peek() === CHAR_SPACE) this.forward();
    const handle = this.scanTagDirectiveHandle();
    while (this.peek() === CHAR_SPACE) this.forward();
    const prefix = this.scanTagDirectivePrefix();
    return [handle, prefix];
  }

  private scanTagDirectiveHandle(): string {
    if (this.peek() !== CHAR_EXCLAMATION) {
      this.throwError('while scanning a TAG directive, expected "!"');
    }
    let handle = '!';
    this.forward();
    let ch = this.peek();
    while (ch !== 0 && !isWhiteSpaceOrEOL(ch) && ch !== CHAR_EXCLAMATION) {
      handle += this.peekChar();
      this.forward();
      ch = this.peek();
    }
    if (ch === CHAR_EXCLAMATION) {
      handle += '!';
      this.forward();
    }
    return handle;
  }

  private scanTagDirectivePrefix(): string {
    let prefix = '';
    let ch = this.peek();
    while (ch !== 0 && !isWhiteSpaceOrEOL(ch)) {
      prefix += this.peekChar();
      this.forward();
      ch = this.peek();
    }
    return prefix;
  }

  private fetchDocumentStart(): void {
    this.fetchDocumentIndicator('DOCUMENT-START');
  }

  private fetchDocumentEnd(): void {
    this.fetchDocumentIndicator('DOCUMENT-END');
  }

  private fetchDocumentIndicator(type: string): void {
    this.unwindIndent(-1);
    this.removePossibleSimpleKey();
    this.simpleKeyAllowed = false;
    const startMark = this.mark();
    this.forward(3);
    this.tokens.push(this.makeToken(type, startMark, this.mark()));
  }

  private fetchFlowCollectionStart(type: string): void {
    this.savePossibleSimpleKey();
    this.flowLevel++;
    this.simpleKeyAllowed = true;
    const startMark = this.mark();
    this.forward();
    this.tokens.push(this.makeToken(type, startMark, this.mark()));
  }

  private fetchFlowCollectionEnd(type: string): void {
    this.removePossibleSimpleKey();
    this.flowLevel--;
    this.simpleKeyAllowed = false;
    const startMark = this.mark();
    this.forward();
    this.tokens.push(this.makeToken(type, startMark, this.mark()));
  }

  private fetchFlowEntry(): void {
    this.removePossibleSimpleKey();
    this.simpleKeyAllowed = true;
    const startMark = this.mark();
    this.forward();
    this.tokens.push(this.makeToken('FLOW-ENTRY', startMark, this.mark()));
  }

  private fetchBlockEntry(): void {
    if (this.flowLevel === 0) {
      if (!this.simpleKeyAllowed) {
        this.throwError('block sequence entries are not allowed in this context');
      }
      const column = this.position - this.lineStart;
      if (this.addIndent(column)) {
        const mark = this.mark();
        this.tokens.push(this.makeToken('BLOCK-SEQUENCE-START', mark, mark));
      }
    }
    this.simpleKeyAllowed = true;
    this.removePossibleSimpleKey();
    const startMark = this.mark();
    this.forward();
    this.tokens.push(this.makeToken('BLOCK-ENTRY', startMark, this.mark()));
  }

  private fetchKey(): void {
    if (this.flowLevel === 0) {
      if (!this.simpleKeyAllowed) {
        this.throwError('mapping keys are not allowed in this context');
      }
      const column = this.position - this.lineStart;
      if (this.addIndent(column)) {
        const mark = this.mark();
        this.tokens.push(this.makeToken('BLOCK-MAPPING-START', mark, mark));
      }
    }
    this.simpleKeyAllowed = this.flowLevel === 0;
    this.removePossibleSimpleKey();
    const startMark = this.mark();
    this.forward();
    this.tokens.push(this.makeToken('KEY', startMark, this.mark()));
  }

  private fetchValue(): void {
    const key = this.possibleSimpleKeys[this.flowLevel];
    if (key) {
      // Insert KEY token before the simple key value.
      const keyToken = this.makeToken('KEY', key as unknown as Mark, key as unknown as Mark);
      // Actually we need a proper mark for key
      const keyMark = new Mark(this.filename, this.input, key.position, key.line, key.column);
      const insertIdx = key.tokenNumber - this.tokensTaken;
      this.tokens.splice(insertIdx, 0, this.makeToken('KEY', keyMark, keyMark));

      // In block context, add BLOCK-MAPPING-START if needed.
      if (this.flowLevel === 0 && this.addIndent(key.column)) {
        this.tokens.splice(insertIdx, 0, this.makeToken('BLOCK-MAPPING-START', keyMark, keyMark));
      }

      delete this.possibleSimpleKeys[this.flowLevel];
      this.simpleKeyAllowed = false;
    } else {
      // No simple key.
      if (this.flowLevel === 0) {
        if (!this.simpleKeyAllowed) {
          this.throwError('mapping values are not allowed in this context');
        }
        const column = this.position - this.lineStart;
        if (this.addIndent(column)) {
          const mark = this.mark();
          this.tokens.push(this.makeToken('BLOCK-MAPPING-START', mark, mark));
        }
      }
      this.simpleKeyAllowed = this.flowLevel === 0;
    }

    const startMark = this.mark();
    this.forward();
    this.tokens.push(this.makeToken('VALUE', startMark, this.mark()));
  }

  private fetchAlias(): void {
    this.savePossibleSimpleKey();
    this.simpleKeyAllowed = false;
    const startMark = this.mark();
    this.forward(); // skip *
    const value = this.scanAnchorAlias();
    this.tokens.push(this.makeToken('ALIAS', startMark, this.mark(), { value }));
  }

  private fetchAnchor(): void {
    this.savePossibleSimpleKey();
    this.simpleKeyAllowed = false;
    const startMark = this.mark();
    this.forward(); // skip &
    const value = this.scanAnchorAlias();
    this.tokens.push(this.makeToken('ANCHOR', startMark, this.mark(), { value }));
  }

  private scanAnchorAlias(): string {
    let value = '';
    let ch = this.peek();
    while (ch !== 0 && !isWhiteSpaceOrEOL(ch) && !isFlowIndicator(ch) && ch !== CHAR_COLON) {
      value += this.peekChar();
      this.forward();
      ch = this.peek();
    }
    if (!value) {
      this.throwError('while scanning an anchor or alias, expected name');
    }
    return value;
  }

  private fetchTag(): void {
    this.savePossibleSimpleKey();
    this.simpleKeyAllowed = false;
    const startMark = this.mark();
    const [handle, suffix] = this.scanTag();
    this.tokens.push(this.makeToken('TAG', startMark, this.mark(), { handle, value: suffix }));
  }

  private scanTag(): [string, string] {
    this.forward(); // skip first !
    let handle = '!';
    let suffix: string;

    let ch = this.peek();
    if (ch === CHAR_EXCLAMATION) {
      // Verbatim tag: !!tag or !<tag>
      handle = '!!';
      this.forward();
      ch = this.peek();
    } else if (ch === 0x3c) {
      // Verbatim tag: !<tag>
      this.forward();
      suffix = '';
      ch = this.peek();
      while (ch !== 0 && ch !== 0x3e) {
        suffix += this.peekChar();
        this.forward();
        ch = this.peek();
      }
      if (ch !== 0x3e) {
        this.throwError('while scanning a tag, expected ">"');
      }
      this.forward();
      return ['!', suffix];
    }

    // Scan tag handle/suffix
    suffix = '';
    while (ch !== 0 && !isWhiteSpaceOrEOL(ch) && !isFlowIndicator(ch)) {
      if (ch === CHAR_EXCLAMATION) {
        handle += suffix + '!';
        suffix = '';
        this.forward();
        ch = this.peek();
        continue;
      }
      suffix += this.peekChar();
      this.forward();
      ch = this.peek();
    }

    return [handle, suffix];
  }

  private fetchBlockScalar(style: 'literal' | 'folded'): void {
    this.removePossibleSimpleKey();
    this.simpleKeyAllowed = true;
    const startMark = this.mark();
    const value = this.scanBlockScalar(style);
    this.tokens.push(this.makeToken('SCALAR', startMark, this.mark(), { value, style }));
  }

  private scanBlockScalar(style: 'literal' | 'folded'): string {
    this.forward(); // skip | or >

    let chomping = 0; // 0=clip, -1=strip, 1=keep
    let increment = 0;

    let ch = this.peek();

    // Chomp indicator
    if (ch === CHAR_MINUS) {
      chomping = -1;
      this.forward();
      ch = this.peek();
      if (ch >= 0x31 && ch <= 0x39) {
        increment = ch - 0x30;
        this.forward();
      }
    } else if (ch === 0x2b) { // +
      chomping = 1;
      this.forward();
      ch = this.peek();
      if (ch >= 0x31 && ch <= 0x39) {
        increment = ch - 0x30;
        this.forward();
      }
    } else if (ch >= 0x31 && ch <= 0x39) {
      increment = ch - 0x30;
      this.forward();
      ch = this.peek();
      if (ch === CHAR_MINUS) {
        chomping = -1;
        this.forward();
      } else if (ch === 0x2b) {
        chomping = 1;
        this.forward();
      }
    }

    // Skip trailing comment
    while (this.peek() === CHAR_SPACE || this.peek() === CHAR_TAB) this.forward();
    if (this.peek() === CHAR_SHARP) {
      while (!isEOL(this.peek()) && this.peek() !== 0) this.forward();
    }

    // Scan the line break after the header
    this.scanLineBreak();

    // Determine indent
    let minIndent = this.indent + 1;
    if (minIndent < 1) minIndent = 1;

    let detectedIndent: number;
    if (increment > 0) {
      detectedIndent = minIndent + increment - 1;
    } else {
      // Auto-detect indent from first non-empty line
      detectedIndent = 0;
      let pos = this.position;
      while (pos < this.length) {
        const c = this.input.charCodeAt(pos);
        if (c === CHAR_SPACE) {
          pos++;
        } else {
          const lineIndent = pos - this.position + (this.position - this.lineStart);
          // Count leading spaces relative to current position
          let spaces = 0;
          let tmpPos = this.position;
          while (tmpPos < this.length && this.input.charCodeAt(tmpPos) === CHAR_SPACE) {
            spaces++;
            tmpPos++;
          }
          if (tmpPos < this.length && !isEOL(this.input.charCodeAt(tmpPos))) {
            detectedIndent = Math.max(minIndent, spaces);
          }
          break;
        }
      }
      if (detectedIndent === 0) detectedIndent = minIndent;
    }

    const chunks: string[] = [];
    let trailingBreaks = '';

    while (this.position < this.length) {
      // Count leading spaces
      let lineIndent = 0;
      while (this.peek() === CHAR_SPACE && lineIndent < detectedIndent) {
        this.forward();
        lineIndent++;
      }

      // Check if this line has content
      const ch = this.peek();
      if (ch === 0 || this.position >= this.length) break;
      if (isEOL(ch) || ch === 0) {
        // Empty line
        trailingBreaks += this.scanLineBreak() || '\n';
        continue;
      }
      if (lineIndent < detectedIndent) break;

      // Add any pending breaks
      if (trailingBreaks) {
        if (style === 'folded' && chunks.length > 0) {
          // In folded mode, single newlines become spaces
          if (trailingBreaks === '\n') {
            // Single break — fold to space (unless previous chunk ends with newline)
            const last = chunks[chunks.length - 1];
            if (last && !last.endsWith('\n')) {
              chunks.push(' ');
            } else {
              chunks.push(trailingBreaks);
            }
          } else {
            // Multiple breaks — keep them minus one
            chunks.push(trailingBreaks.slice(1));
          }
        } else {
          chunks.push(trailingBreaks);
        }
        trailingBreaks = '';
      }

      // Read line content
      let lineContent = '';
      while (!isEOL(this.peek()) && this.peek() !== 0) {
        lineContent += this.peekChar();
        this.forward();
      }
      chunks.push(lineContent);

      // Read line break
      trailingBreaks = this.scanLineBreak();
    }

    // Apply chomping
    if (chomping !== -1) {
      chunks.push('\n');
    }
    if (chomping === 1) {
      chunks.push(trailingBreaks);
    }

    return chunks.join('');
  }

  private fetchFlowScalar(style: 'single' | 'double'): void {
    this.savePossibleSimpleKey();
    this.simpleKeyAllowed = false;
    const startMark = this.mark();
    const value = this.scanFlowScalar(style);
    this.tokens.push(this.makeToken('SCALAR', startMark, this.mark(), { value, style }));
  }

  private scanFlowScalar(style: 'single' | 'double'): string {
    const quote = style === 'single' ? CHAR_SINGLE_QUOTE : CHAR_DOUBLE_QUOTE;
    this.forward(); // skip opening quote

    const chunks: string[] = [];

    for (;;) {
      let ch = this.peek();

      // Scan until we hit the quote char, backslash, or line break
      let text = '';
      while (ch !== 0 && ch !== quote && ch !== 0x5c && !isEOL(ch)) {
        if (style === 'double' && ch === 0x5c) break;
        text += this.peekChar();
        this.forward();
        ch = this.peek();
      }
      if (text) chunks.push(text);

      if (style === 'single') {
        if (ch === CHAR_SINGLE_QUOTE) {
          if (this.peek(1) === CHAR_SINGLE_QUOTE) {
            // Escaped single quote
            chunks.push("'");
            this.forward(2);
            continue;
          }
          break; // End of string
        }
      } else {
        // Double-quoted
        if (ch === CHAR_DOUBLE_QUOTE) {
          break; // End of string
        }
        if (ch === 0x5c) {
          // Escape sequence
          this.forward(); // skip backslash
          ch = this.peek();

          if (ch === 0x78) { // \xNN
            this.forward();
            let code = 0;
            for (let i = 0; i < 2; i++) {
              const h = fromHexCode(this.peek());
              if (h < 0) this.throwError('expected hex digit in \\x escape');
              code = code * 16 + h;
              this.forward();
            }
            chunks.push(String.fromCharCode(code));
            continue;
          }
          if (ch === 0x75) { // \uNNNN
            this.forward();
            let code = 0;
            for (let i = 0; i < 4; i++) {
              const h = fromHexCode(this.peek());
              if (h < 0) this.throwError('expected hex digit in \\u escape');
              code = code * 16 + h;
              this.forward();
            }
            chunks.push(String.fromCharCode(code));
            continue;
          }
          if (ch === 0x55) { // \UNNNNNNNN
            this.forward();
            let code = 0;
            for (let i = 0; i < 8; i++) {
              const h = fromHexCode(this.peek());
              if (h < 0) this.throwError('expected hex digit in \\U escape');
              code = code * 16 + h;
              this.forward();
            }
            chunks.push(String.fromCodePoint(code));
            continue;
          }

          if (isEOL(ch)) {
            // Escaped line break — fold
            this.scanLineBreak();
            // Skip leading whitespace on next line
            while (this.peek() === CHAR_SPACE || this.peek() === CHAR_TAB) {
              this.forward();
            }
            continue;
          }

          const esc = SIMPLE_ESCAPE_SEQUENCES[ch];
          if (esc !== undefined) {
            chunks.push(esc);
            this.forward();
            continue;
          }

          this.throwError(`unknown escape character ${String.fromCharCode(ch)}`);
        }
      }

      // Line break within scalar
      if (isEOL(ch)) {
        const lineBreak = this.scanLineBreak();
        // Skip leading whitespace on next line
        let spaces = '';
        while (this.peek() === CHAR_SPACE || this.peek() === CHAR_TAB) {
          spaces += ' ';
          this.forward();
        }
        if (lineBreak === '\n' && !spaces) {
          // Empty continuation — becomes space
          chunks.push(' ');
        } else if (spaces) {
          chunks.push(spaces ? ' ' : lineBreak);
        } else {
          chunks.push(lineBreak);
        }
        continue;
      }

      if (ch === 0) {
        this.throwError('unexpected end of stream in flow scalar');
      }
    }

    this.forward(); // skip closing quote
    return chunks.join('');
  }

  private fetchPlainScalar(): void {
    this.savePossibleSimpleKey();
    this.simpleKeyAllowed = false;
    const startMark = this.mark();
    const startLine = this.line;
    const value = this.scanPlainScalar();
    this.tokens.push(this.makeToken('SCALAR', startMark, this.mark(), { value, style: 'plain' }));
    // Plain scalar may have consumed a trailing line break + indent.
    // In block context, crossing a line boundary re-enables simple keys.
    if (this.flowLevel === 0 && this.line !== startLine) {
      this.simpleKeyAllowed = true;
    }
  }

  private scanPlainScalar(): string {
    const chunks: string[] = [];
    let spaces = '';
    const indent = this.indent + 1;

    for (;;) {
      let text = '';
      let ch = this.peek();

      // Scan until break
      if (ch === CHAR_SHARP) break;

      while (ch !== 0) {
        if (ch === CHAR_COLON) {
          const after = this.peek(1);
          if (isWhiteSpaceOrEOL(after) || (this.flowLevel !== 0 && isFlowIndicator(after))) break;
        }
        if (this.flowLevel !== 0 && isFlowIndicator(ch)) break;
        if (isWhiteSpaceOrEOL(ch)) break;
        if (ch === CHAR_SHARP && this.position > 0) {
          const prev = this.input.charCodeAt(this.position - 1);
          if (isWhiteSpace(prev)) break;
        }

        text += this.peekChar();
        this.forward();
        ch = this.peek();
      }

      if (!text && !spaces) break;

      if (spaces) {
        chunks.push(spaces);
        spaces = '';
      }
      if (text) chunks.push(text);

      // Check for line break
      if (!isEOL(this.peek())) break;

      const lineBreak = this.scanLineBreak();

      // Skip whitespace at start of next line
      let lineSpaces = 0;
      while (this.peek() === CHAR_SPACE) {
        this.forward();
        lineSpaces++;
      }

      // Check indent
      if (this.flowLevel === 0 && lineSpaces < indent) break;

      // Check for comment or document markers
      const nextCh = this.peek();
      if (nextCh === CHAR_SHARP || nextCh === 0) break;
      if (this.position - this.lineStart === 0) {
        if (this.checkDocumentStart() || this.checkDocumentEnd()) break;
      }

      spaces = lineBreak === '\n' ? ' ' : lineBreak;
    }

    return chunks.join('');
  }
}
