import { Type } from './type.js';

export class Schema {
  implicit: Type[];
  explicit: Type[];
  compiledImplicit: Type[];
  compiledExplicit: Type[];
  compiledTypeMap: Record<string, Type>;

  constructor(definition?: {
    include?: Schema[];
    implicit?: Type[];
    explicit?: Type[];
  }) {
    this.implicit = definition?.implicit ?? [];
    this.explicit = definition?.explicit ?? [];

    // Compile: merge included schemas then local types.
    const allImplicit: Type[] = [];
    const allExplicit: Type[] = [];

    if (definition?.include) {
      for (const schema of definition.include) {
        allImplicit.push(...schema.compiledImplicit);
        allExplicit.push(...schema.compiledExplicit);
      }
    }

    allImplicit.push(...this.implicit);
    allExplicit.push(...this.explicit);

    this.compiledImplicit = allImplicit;
    this.compiledExplicit = allExplicit;

    // Build tag → type lookup map.
    this.compiledTypeMap = Object.create(null) as Record<string, Type>;
    for (const type of [...this.compiledImplicit, ...this.compiledExplicit]) {
      this.compiledTypeMap[type.tag] = type;
    }
  }

  extend(
    definition: Type | Type[] | { implicit?: Type[]; explicit?: Type[] },
  ): Schema {
    if (definition instanceof Type) {
      return new Schema({ include: [this], explicit: [definition] });
    }
    if (Array.isArray(definition)) {
      return new Schema({ include: [this], explicit: definition });
    }
    return new Schema({
      include: [this],
      implicit: definition.implicit,
      explicit: definition.explicit,
    });
  }
}
