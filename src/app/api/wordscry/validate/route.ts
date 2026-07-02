import { NextRequest, NextResponse } from "next/server";
import { isValidDictionaryWord } from "@/lib/dictionary";

// Public, stateless dictionary lookup — no game state is exposed, so no auth is required.
export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get("word") || "";
  return NextResponse.json({ valid: isValidDictionaryWord(word) });
}
