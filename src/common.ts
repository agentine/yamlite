// Character code constants used by scanner and loader.

export const CHAR_TAB = 0x09; /* Tab */
export const CHAR_LINE_FEED = 0x0a; /* LF */
export const CHAR_CARRIAGE_RETURN = 0x0d; /* CR */
export const CHAR_SPACE = 0x20; /* Space */
export const CHAR_EXCLAMATION = 0x21; /* ! */
export const CHAR_DOUBLE_QUOTE = 0x22; /* " */
export const CHAR_SHARP = 0x23; /* # */
export const CHAR_PERCENT = 0x25; /* % */
export const CHAR_AMPERSAND = 0x26; /* & */
export const CHAR_SINGLE_QUOTE = 0x27; /* ' */
export const CHAR_ASTERISK = 0x2a; /* * */
export const CHAR_COMMA = 0x2c; /* , */
export const CHAR_MINUS = 0x2d; /* - */
export const CHAR_DOT = 0x2e; /* . */
export const CHAR_COLON = 0x3a; /* : */
export const CHAR_GREATER_THAN = 0x3e; /* > */
export const CHAR_QUESTION = 0x3f; /* ? */
export const CHAR_COMMERCIAL_AT = 0x40; /* @ */
export const CHAR_LEFT_SQUARE_BRACKET = 0x5b; /* [ */
export const CHAR_RIGHT_SQUARE_BRACKET = 0x5d; /* ] */
export const CHAR_GRAVE_ACCENT = 0x60; /* ` */
export const CHAR_LEFT_CURLY_BRACKET = 0x7b; /* { */
export const CHAR_VERTICAL_LINE = 0x7c; /* | */
export const CHAR_RIGHT_CURLY_BRACKET = 0x7d; /* } */

export const CHAR_BOM = 0xfeff;
export const CHAR_ZERO = 0x30; /* 0 */
export const CHAR_NINE = 0x39; /* 9 */
export const CHAR_UPPER_A = 0x41; /* A */
export const CHAR_UPPER_F = 0x46; /* F */
export const CHAR_UPPER_Z = 0x5a; /* Z */
export const CHAR_UNDERSCORE = 0x5f; /* _ */
export const CHAR_LOWER_A = 0x61; /* a */
export const CHAR_LOWER_F = 0x66; /* f */
export const CHAR_LOWER_Z = 0x7a; /* z */

export function isEOL(c: number): boolean {
  return c === CHAR_LINE_FEED || c === CHAR_CARRIAGE_RETURN;
}

export function isWhiteSpace(c: number): boolean {
  return c === CHAR_TAB || c === CHAR_SPACE;
}

export function isWhiteSpaceOrEOL(c: number): boolean {
  return (
    c === CHAR_TAB ||
    c === CHAR_SPACE ||
    c === CHAR_LINE_FEED ||
    c === CHAR_CARRIAGE_RETURN
  );
}

export function isFlowIndicator(c: number): boolean {
  return (
    c === CHAR_COMMA ||
    c === CHAR_LEFT_SQUARE_BRACKET ||
    c === CHAR_RIGHT_SQUARE_BRACKET ||
    c === CHAR_LEFT_CURLY_BRACKET ||
    c === CHAR_RIGHT_CURLY_BRACKET
  );
}

export function isDecCode(c: number): boolean {
  return c >= CHAR_ZERO && c <= CHAR_NINE;
}

export function isHexCode(c: number): boolean {
  return (
    (c >= CHAR_ZERO && c <= CHAR_NINE) ||
    (c >= CHAR_UPPER_A && c <= CHAR_UPPER_F) ||
    (c >= CHAR_LOWER_A && c <= CHAR_LOWER_F)
  );
}

export function fromHexCode(c: number): number {
  if (c >= CHAR_ZERO && c <= CHAR_NINE) return c - CHAR_ZERO;
  if (c >= CHAR_UPPER_A && c <= CHAR_UPPER_F) return c - CHAR_UPPER_A + 10;
  if (c >= CHAR_LOWER_A && c <= CHAR_LOWER_F) return c - CHAR_LOWER_A + 10;
  return -1;
}

export function isOctCode(c: number): boolean {
  return c >= CHAR_ZERO && c <= 0x37; /* 0-7 */
}

// Simple escape sequences for double-quoted scalars.
export const SIMPLE_ESCAPE_SEQUENCES: Record<number, string> = {
  0x30: '\x00', // 0
  0x61: '\x07', // a (bell)
  0x62: '\x08', // b (backspace)
  0x74: '\x09', // t (tab)
  0x09: '\x09', // Tab
  0x6e: '\x0a', // n (newline)
  0x76: '\x0b', // v (vertical tab)
  0x66: '\x0c', // f (form feed)
  0x72: '\x0d', // r (carriage return)
  0x65: '\x1b', // e (escape)
  0x20: ' ', // space
  0x22: '"', // double quote
  0x2f: '/', // slash
  0x5c: '\\', // backslash
  0x4e: '\x85', // N (next line)
  0x5f: '\xa0', // _ (non-breaking space)
  0x4c: '\u2028', // L (line separator)
  0x50: '\u2029', // P (paragraph separator)
};
