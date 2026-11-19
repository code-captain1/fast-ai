// app/api/chat/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";

const MAX_PROMPT_LENGTH = 1000;
const MAX_HISTORY = 10;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  // Only signed-in users can call the API
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_PROMPT_LENGTH),
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      max_tokens: 2048,
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        ...messages,
      ],
    });

    const text =
      completion.choices[0]?.message?.content || "No response generated";

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Groq request failed:", error);
    return NextResponse.json(
      { error: "We couldn't generate a response. Please try again." },
      { status: 500 }
    );
  }
}