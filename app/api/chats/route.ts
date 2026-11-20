// app/api/chats/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat } from "@/db/chat-schema";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const chats = await db
      .select({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt })
      .from(chat)
      .where(and(eq(chat.userId, session.user.id), isNull(chat.archivedAt)))
      .orderBy(desc(chat.updatedAt))
      .limit(50);

    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Listing chats failed:", error);
    return NextResponse.json(
      { error: "Could not load your chats" },
      { status: 500 }
    );
  }
}