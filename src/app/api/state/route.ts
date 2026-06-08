import { NextResponse } from "next/server";
import { requireUnlock, serverError } from "@/lib/api";
import { getAppState } from "@/lib/data";

export async function GET() {
  const locked = await requireUnlock();

  if (locked) {
    return locked;
  }

  try {
    const state = await getAppState();
    return NextResponse.json(state);
  } catch (error) {
    return serverError(error);
  }
}
