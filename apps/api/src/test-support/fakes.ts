import type { AuthUser, AuthVerifier } from "../middleware/requireAuth";
import type {
  BoardPatch,
  BoardRecord,
  BoardRepository,
  BoardSummary,
} from "../repositories/boards";

export const USER_A: AuthUser = { id: "user-a", email: "a@example.com" };
export const USER_B: AuthUser = { id: "user-b", email: "b@example.com" };

const TOKENS = new Map<string, AuthUser>([
  ["token-a", USER_A],
  ["token-b", USER_B],
]);

export function createTestAuth(): {
  auth: AuthVerifier;
  ensureUser: (user: AuthUser) => Promise<void>;
  ensured: AuthUser[];
} {
  const ensured: AuthUser[] = [];

  return {
    auth: async (token: string) => TOKENS.get(token) ?? null,
    ensureUser: async (user: AuthUser) => {
      ensured.push(user);
    },
    ensured,
  };
}

export function createInMemoryBoardRepository(): BoardRepository {
  const boards = new Map<string, BoardRecord>();
  let counter = 0;
  const timestamp = () => new Date("2026-01-01T00:00:00.000Z");

  return {
    async listByOwner(ownerId: string): Promise<BoardSummary[]> {
      return [...boards.values()]
        .filter((board) => board.ownerId === ownerId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(({ scene: _scene, ...summary }) => summary);
    },

    async create(
      ownerId: string,
      title: string,
      scene: unknown,
    ): Promise<BoardRecord> {
      counter += 1;

      const board: BoardRecord = {
        id: `board-${counter}`,
        ownerId,
        title,
        scene,
        createdAt: timestamp(),
        updatedAt: timestamp(),
      };

      boards.set(board.id, board);

      return board;
    },

    async findById(
      ownerId: string,
      id: string,
    ): Promise<BoardRecord | null> {
      const board = boards.get(id);

      return board && board.ownerId === ownerId ? board : null;
    },

    async update(
      ownerId: string,
      id: string,
      patch: BoardPatch,
    ): Promise<BoardRecord | null> {
      const board = boards.get(id);

      if (!board || board.ownerId !== ownerId) {
        return null;
      }

      const updated: BoardRecord = {
        ...board,
        ...(patch.title === undefined ? {} : { title: patch.title }),
        ...(patch.scene === undefined ? {} : { scene: patch.scene }),
      };

      boards.set(id, updated);

      return updated;
    },

    async delete(ownerId: string, id: string): Promise<boolean> {
      const board = boards.get(id);

      if (!board || board.ownerId !== ownerId) {
        return false;
      }

      boards.delete(id);

      return true;
    },
  };
}
