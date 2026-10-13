import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { prisma?: PrismaClient; prismaClass?: typeof PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development. After `prisma generate`
// the client class itself is a new one, so the kept client (which knows only
// the old schema) is dropped and replaced without restarting the dev server.
if (globalForDb.prisma && globalForDb.prismaClass !== PrismaClient) {
  void globalForDb.prisma.$disconnect().catch(() => {});
  globalForDb.prisma = undefined;
}

export const db = globalForDb.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.prisma = db;
  globalForDb.prismaClass = PrismaClient;
}
