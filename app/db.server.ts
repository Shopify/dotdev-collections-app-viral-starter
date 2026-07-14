import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

// SQLite relative paths in DATABASE_URL are resolved against prisma/schema.prisma's
// directory — so `file:./prisma/dev.sqlite` accidentally becomes prisma/prisma/dev.sqlite.
// Always pin to an absolute path under the repo root before creating the client.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqliteFile = path.join(repoRoot, "prisma", "dev.sqlite");
const databaseUrl = `file:${sqliteFile}`;
process.env.DATABASE_URL = databaseUrl;

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaDatabaseUrl: string | undefined;
}

function createClient() {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
}

// In Vite HMR, the module re-evaluates but global.prismaGlobal can keep a client
// pointed at a deleted/wrong SQLite file. Recreate when the URL changes.
if (global.prismaGlobal && global.prismaDatabaseUrl !== databaseUrl) {
  void global.prismaGlobal.$disconnect().catch(() => undefined);
  global.prismaGlobal = undefined;
}

const prisma = global.prismaGlobal ?? createClient();
if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
  global.prismaDatabaseUrl = databaseUrl;
}

export default prisma;
