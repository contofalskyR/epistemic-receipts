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

function makePrismaClient() {
  const pool = new Pool({
    connectionString: withoutSslMode(process.env.DATABASE_URL ?? ""),
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
