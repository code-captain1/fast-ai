// app/api/chats/[id]/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { and, asc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audioFile, chat, message } from "@/db/chat-schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const [found] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, id), eq(chat.userId, session.user.id)))
    .limit(1);

  if (!found) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Chat turns and saved voice messages, in order, with their audio id
  const messages = await db
    .select({
      role: message.role,
      kind: message.kind,
      content: message.content,
      audioId: audioFile.id,
    })
    .from(message)
    .leftJoin(
      audioFile,
      and(
        eq(audioFile.messageId, message.id),
        eq(audioFile.source, "generate")
      )
    )
    .where(
      and(eq(message.chatId, id), inArray(message.role, ["user", "assistant"]))
    )
    .orderBy(asc(message.createdAt))
    .limit(200);

  return NextResponse.json({ chatId: id, messages });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const [owned] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, id), eq(chat.userId, userId)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Audio files belonging to this chat's messages
  const files = await db
    .select({ id: audioFile.id, url: audioFile.url })
    .from(audioFile)
    .innerJoin(message, eq(audioFile.messageId, message.id))
    .where(eq(message.chatId, id));

  // Remove the stored files first. If this fails, nothing is deleted
  // from the database, so the user can simply try again.
  const urls = files.map((f) => f.url).filter((u): u is string => !!u);
  if (urls.length > 0) {
    try {
      await del(urls);
    } catch (error) {
      console.error("Deleting audio files failed:", error);
      return NextResponse.json(
        { error: "Couldn't delete this chat's audio files" },
        { status: 500 }
      );
    }
  }

  // Messages are removed by the cascade on message.chat_id
  await db.transaction(async (tx) => {
    if (files.length > 0) {
      await tx.delete(audioFile).where(
        inArray(
          audioFile.id,
          files.map((f) => f.id)
        )
      );
    }
    await tx
      .delete(chat)
      .where(and(eq(chat.id, id), eq(chat.userId, userId)));
  });

  return NextResponse.json({ ok: true });
}