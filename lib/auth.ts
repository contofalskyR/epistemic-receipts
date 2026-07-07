import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";

const MAGIC_LINK_EXPIRY_SECONDS = 900; // 15 minutes, single-use

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM ?? "noreply@epistemic-receipts.com",
      maxAge: MAGIC_LINK_EXPIRY_SECONDS,
    }),
  ],
  session: { strategy: "database" },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    },
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, user }: { session: any; user: any }) {
      if (user?.id) session.user.id = user.id;
      return session;
    },
  },
});
