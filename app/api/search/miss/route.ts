import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OWNER_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(req: NextRequest) {
  let query = "";
  try {
    const body = await req.json();
    query = (body.query ?? "").trim().slice(0, 300);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (query.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  if (!OWNER_CHAT_ID) {
    console.log("[search/miss] TELEGRAM_CHAT_ID not set — skipping Telegram notification.");
    return NextResponse.json({ status: "skipped" });
  }

  const text = `🔍 Missing search\n\n"${query}"\n\nA visitor searched for this and got zero results. Consider adding it.`;

  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: OWNER_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    },
  );

  if (!tgRes.ok) {
    return NextResponse.json({ error: "Telegram failed" }, { status: 502 });
  }

  return NextResponse.json({ status: "reported" });
}
