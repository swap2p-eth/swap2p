import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const ALLOWED_SLUGS = new Set(["terms", "policy"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  if (!ALLOWED_SLUGS.has(slug)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), "content", `${slug}.md`);
    const content = await readFile(filePath, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
