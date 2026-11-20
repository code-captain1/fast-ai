// app/api/tts/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@/lib/auth";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  // Only signed-in users can generate speech
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  try {
    const response = await groq.audio.speech.create({
      model: "canopylabs/orpheus-v1-english",
      voice: "hannah",
      input: text.trim().slice(0, 800),
      response_format: "wav",
    });

    const audio = Buffer.from(await response.arrayBuffer());
    return new Response(audio, {
      headers: { "Content-Type": "audio/wav" },
    });
  } catch (error) {
    console.error("Groq TTS failed:", error);
    return NextResponse.json(
      { error: "Could not generate speech" },
      { status: 500 }
    );
  }
}