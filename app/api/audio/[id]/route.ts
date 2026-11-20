// app/api/audio/[id]/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audioFile } from "@/db/chat-schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the owner can read the file
  const [file] = await db
    .select({ storageKey: audioFile.storageKey, mimeType: audioFile.mimeType })
    .from(audioFile)
    .where(and(eq(audioFile.id, id), eq(audioFile.userId, session.user.id)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await get(file.storageKey, { access: "private" });
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = new Uint8Array(await new Response(result.stream).arrayBuffer());
  const total = data.byteLength;

  const baseHeaders = {
    "Content-Type": file.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };

  // Range support so the player can seek
  const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (match) {
    let start = match[1] ? parseInt(match[1], 10) : NaN;
    let end = match[2] ? parseInt(match[2], 10) : NaN;

    if (Number.isNaN(start) && !Number.isNaN(end)) {
      // "bytes=-500" means the last 500 bytes
      start = Math.max(total - end, 0);
      end = total - 1;
    } else if (Number.isNaN(end) || end >= total) {
      end = total - 1;
    }

    if (Number.isNaN(start) || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    const chunk = data.slice(start, end + 1);
    return new Response(chunk, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(chunk.byteLength),
      },
    });
  }

  return new Response(data, {
    headers: { ...baseHeaders, "Content-Length": String(total) },
  });
}