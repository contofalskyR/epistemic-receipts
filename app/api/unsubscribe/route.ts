import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse("Missing token.", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  try {
    await prisma.topicSubscription.delete({ where: { unsubscribeToken: token } });
  } catch {
    // Already deleted or token not found — treat as success
  }

  return new NextResponse("You've been unsubscribed.", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
