export type BoardSummary = {
  id: string;
  ownerId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BoardRecord = BoardSummary & { scene: unknown };

export type BoardPatch = {
  title?: string;
  scene?: unknown;
};

export interface BoardRepository {
  listByOwner(ownerId: string): Promise<BoardSummary[]>;
  create(ownerId: string, title: string, scene: unknown): Promise<BoardRecord>;
  findById(ownerId: string, id: string): Promise<BoardRecord | null>;
  update(
    ownerId: string,
    id: string,
    patch: BoardPatch,
  ): Promise<BoardRecord | null>;
  delete(ownerId: string, id: string): Promise<boolean>;
}
