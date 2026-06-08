import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ unlocked: await isUnlocked() });
}
