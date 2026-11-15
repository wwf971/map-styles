declare module 'rbush' {
  export type BBox = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };

  export default class RBush<T extends BBox = BBox> {
    constructor(maxEntries?: number);
    all(): T[];
    search(box: BBox): T[];
    collides(box: BBox): boolean;
    load(data: T[]): this;
    insert(item: T): this;
    clear(): this;
    remove(item: T, equals?: (a: T, b: T) => boolean): this;
    toJSON(): unknown;
    fromJSON(data: unknown): this;
  }
}
