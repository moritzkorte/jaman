import { NextResponse } from "next/server";
import { createSessionCookie, isCorrectPasscode } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { passcode?: string };

  if (!body.passcode || !isCorrectPasscode(body.passcode)) {
    return NextResponse.json({ message: "Der Code passt nicht." }, { status: 401 });
  }

  await createSessionCookie();

  return NextResponse.json({ ok: true });
}
