// app/api/audio/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audioFile, chat, message } from "@/db/chat-schema";

const MAX_TEXT_LENGTH = 800;
// Vercel Functions accept request bodies up to about 4.5 MB
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.slice(from, to));

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const file = form.get("audio");
  const text = String(form.get("text") ?? "")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
  const rawChatId = form.get("chatId");
  const chatIdInput =
    typeof rawChatId === "string" && rawChatId ? rawChatId : null;

  if (!(file instanceof File) || !text) {
    return NextResponse.json({ error: "Missing audio or text" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio file is too large" }, { status: 413 });
  }

  // Only accept real WAV files (the format /api/tts produces)
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head.length < 12 || ascii(head, 0, 4) !== "RIFF" || ascii(head, 8, 12) !== "WAVE") {
    return NextResponse.json({ error: "Unsupported audio format" }, { status: 415 });
  }

  // If saving into an existing chat, it must belong to this user
  if (chatIdInput) {
    if (!UUID_RE.test(chatIdInput)) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    const [existing] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, chatIdInput), eq(chat.userId, userId)))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
  }

  // 1. Upload the file to private storage
  const audioId = crypto.randomUUID();
  let blob: Awaited<ReturnType<typeof put>>;
  try {
    blob = await put(`audio/${userId}/${audioId}.wav`, file, {
      access: "private",
      contentType: "audio/wav",
    });
  } catch (error) {
    console.error("Blob upload failed:", error);
    return NextResponse.json(
      { error: "Couldn't store the audio" },
      { status: 502 }
    );
  }

  // 2. Record it in the database (chat + message + audio file, all or nothing)
  try {
    const saved = await db.transaction(async (tx) => {
      let chatId = chatIdInput;
      if (!chatId) {
        const [created] = await tx
          .insert(chat)
          .values({ userId, title: text.slice(0, 60) })
          .returning({ id: chat.id });
        chatId = created.id;
      }

      const [msg] = await tx
        .insert(message)
        .values({ chatId, role: "user", kind: "voice", content: text })
        .returning({ id: message.id });

      await tx.insert(audioFile).values({
        id: audioId,
        userId,
        messageId: msg.id,
        source: "generate",
        storageKey: blob.pathname,
        url: blob.url, // private URL: never sent to the browser
        mimeType: "audio/wav",
        sizeBytes: file.size,
        textInput: text,
      });

      await tx
        .update(chat)
        .set({ updatedAt: new Date() })
        .where(eq(chat.id, chatId));

      return { chatId, messageId: msg.id };
    });

    return NextResponse.json({
      ...saved,
      audio: { id: audioId, url: `/api/audio/${audioId}` },
    });
  } catch (error) {
    console.error("Saving audio failed:", error);
    // don't leave an orphaned file behind
    try {
      await del(blob.url);
    } catch {}
    return NextResponse.json(
      { error: "Couldn't save the audio" },
      { status: 500 }
    );
  }
}