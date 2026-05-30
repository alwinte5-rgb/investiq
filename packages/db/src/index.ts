import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client (singleton to avoid exhausting connections in
 * dev hot-reload). User-specific reads must always filter by userId for
 * object-level authorization — see @investiq/api lib/permissions.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
