import type { Prisma, PrismaClient } from "../generated/prisma/client";

import type {
  BoardPatch,
  BoardRecord,
  BoardRepository,
  BoardSummary,
} from "./boards";

const SUMMARY_SELECT = {
  id: true,
  ownerId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const;

const FULL_SELECT = {
  id: true,
  ownerId: true,
  title: true,
  scene: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createPrismaBoardRepository(
  prisma: PrismaClient,
): BoardRepository {
  return {
    async listByOwner(ownerId: string): Promise<BoardSummary[]> {
      return prisma.board.findMany({
        where: { ownerId },
        orderBy: { updatedAt: "desc" },
        select: SUMMARY_SELECT,
      });
    },

    async create(
      ownerId: string,
      title: string,
      scene: unknown,
    ): Promise<BoardRecord> {
      return prisma.board.create({
        data: {
          ownerId,
          title,
          scene: scene as Prisma.InputJsonValue,
        },
        select: FULL_SELECT,
      });
    },

    async findById(
      ownerId: string,
      id: string,
    ): Promise<BoardRecord | null> {
      return prisma.board.findFirst({
        where: { id, ownerId },
        select: FULL_SELECT,
      });
    },

    async update(
      ownerId: string,
      id: string,
      patch: BoardPatch,
    ): Promise<BoardRecord | null> {
      const existing = await prisma.board.findFirst({
        where: { id, ownerId },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      return prisma.board.update({
        where: { id: existing.id },
        data: {
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.scene === undefined
            ? {}
            : { scene: patch.scene as Prisma.InputJsonValue }),
        },
        select: FULL_SELECT,
      });
    },

    async delete(ownerId: string, id: string): Promise<boolean> {
      const existing = await prisma.board.findFirst({
        where: { id, ownerId },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      await prisma.board.delete({ where: { id: existing.id } });

      return true;
    },
  };
}
