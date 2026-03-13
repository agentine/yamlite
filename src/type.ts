export interface TypeOptions {
  kind: 'scalar' | 'sequence' | 'mapping';
  multi?: boolean;
  resolve?: (data: unknown) => boolean;
  construct?: (data: unknown) => unknown;
  instanceOf?: Function;
  predicate?: (data: unknown) => boolean;
  represent?:
    | ((data: unknown, style?: string) => string)
    | Record<string, (data: unknown) => string>;
  representName?: (data: unknown) => string;
  defaultStyle?: string;
  styleAliases?: Record<string, string[]>;
}

const VALID_KINDS = new Set(['scalar', 'sequence', 'mapping']);

export class Type {
  tag: string;
  kind: 'scalar' | 'sequence' | 'mapping';
  multi: boolean;
  resolve: (data: unknown) => boolean;
  construct: (data: unknown) => unknown;
  instanceOf?: Function;
  predicate?: (data: unknown) => boolean;
  represent?:
    | ((data: unknown, style?: string) => string)
    | Record<string, (data: unknown) => string>;
  representName?: (data: unknown) => string;
  defaultStyle?: string;
  styleAliases: Record<string, string>;

  constructor(tag: string, options?: TypeOptions) {
    this.tag = tag;
    this.kind = options?.kind ?? 'scalar';

    if (!VALID_KINDS.has(this.kind)) {
      throw new Error(`Invalid kind "${this.kind}" for type "${tag}". Must be scalar, sequence, or mapping.`);
    }

    this.multi = options?.multi ?? false;
    this.resolve = options?.resolve ?? (() => true);
    this.construct = options?.construct ?? ((data: unknown) => data);
    this.instanceOf = options?.instanceOf;
    this.predicate = options?.predicate;
    this.represent = options?.represent;
    this.representName = options?.representName;
    this.defaultStyle = options?.defaultStyle;

    // Build flattened style aliases lookup.
    this.styleAliases = {};
    if (options?.styleAliases) {
      for (const [style, aliases] of Object.entries(options.styleAliases)) {
        for (const alias of aliases) {
          this.styleAliases[alias] = style;
        }
      }
    }
  }
}
