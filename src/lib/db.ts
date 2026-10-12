import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { db?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development.
export const db = globalForDb.db ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
