import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

function makeReadClient() {
  const connectionString = process.env.DATABASE_URL_READ ?? process.env.DATABASE_URL!;
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForReadPrisma = globalThis as unknown as { readPrisma: PrismaClient };

export const readPrisma = globalForReadPrisma.readPrisma ?? makeReadClient();

if (process.env.NODE_ENV !== "production") globalForReadPrisma.readPrisma = readPrisma;
