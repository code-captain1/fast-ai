// app/api/chat/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat, message } from "@/db/chat-schema";

const MAX_PROMPT_LENGTH = 1000;
const MAX_HISTORY = 10;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type ChatMessage = { role: "user" | "assistant"; content: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { chatId?: string | null; messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // The prompt is the last user message the client sent
  const last = (body.messages ?? [])
    .filter(
      (m) => m.role === "user" && typeof m.content === "string" && m.content.trim()
    )
    .at(-1);
  const prompt = last?.content.trim().slice(0, MAX_PROMPT_LENGTH);

  if (!prompt) {
    return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
  }

  try {
    let chatId = body.chatId ?? null;
    let history: ChatMessage[] = [];

    if (chatId) {
      // The chat must exist and belong to this user
      if (!UUID_RE.test(chatId)) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }
      const [existing] = await db
        .select({ id: chat.id })
        .from(chat)
        .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }

      // Trusted history comes from the database, not the client
      const rows = await db
        .select({ role: message.role, content: message.content })
        .from(message)
        .where(
          and(
            eq(message.chatId, chatId),
            eq(message.kind, "chat"),
            inArray(message.role, ["user", "assistant"])
          )
        )
        .orderBy(desc(message.createdAt))
        .limit(MAX_HISTORY);

      history = rows.reverse() as ChatMessage[];
    } else {
      const [created] = await db
        .insert(chat)
        .values({ userId, title: prompt.slice(0, 60) })
        .returning({ id: chat.id });
      chatId = created.id;
    }

    // Save the user message before calling the model so it is never lost
    await db
      .insert(message)
      .values({ chatId, role: "user", kind: "chat", content: prompt });

    let text: string;
    try {
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        max_tokens: 2048,
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          ...history,
          { role: "user", content: prompt },
        ],
      });
      text = completion.choices[0]?.message?.content || "No response generated";
    } catch (error) {
      console.error("Groq request failed:", error);
      return NextResponse.json(
        {
          error: "We couldn't generate a response. Please try again.",
          chatId,
        },
        { status: 500 }
      );
    }

    await db.insert(message).values({
      chatId,
      role: "assistant",
      kind: "chat",
      content: text,
      metadata: { model: "openai/gpt-oss-20b" },
    });
    await db
      .update(chat)
      .set({ updatedAt: new Date() })
      .where(eq(chat.id, chatId));

    return NextResponse.json({ text, chatId });
  } catch (error) {
    console.error("Chat request failed:", error);
    return NextResponse.json(
      { error: "We couldn't save your chat. Please try again." },
      { status: 500 }
    );
  }
}