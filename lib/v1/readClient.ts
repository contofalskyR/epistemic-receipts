import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// pg-connection-string turns `sslmode=require` into `ssl: {}` and lets the URL
// override the explicit `ssl` option below, which re-enables certificate
// verification and rejects the server's self-signed cert. Strip the param so
// the explicit option wins.
function withoutSslMode(url: string): string {
  return url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
}

function makeReadClient() {
  const pool = new Pool({
    connectionString: withoutSslMode(
      process.env.DATABASE_URL_READ ?? process.env.DATABASE_URL ?? ""
    ),
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForReadPrisma = globalThis as unknown as { readPrisma: PrismaClient };

export const readPrisma = globalForReadPrisma.readPrisma ?? makeReadClient();

if (process.env.NODE_ENV !== "production") globalForReadPrisma.readPrisma = readPrisma;
