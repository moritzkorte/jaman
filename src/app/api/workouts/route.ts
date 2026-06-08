import { NextResponse } from "next/server";
import { requireUnlock, serverError } from "@/lib/api";
import { createWorkout } from "@/lib/data";

export async function POST(request: Request) {
  const locked = await requireUnlock();

  if (locked) {
    return locked;
  }

  try {
    const body = (await request.json()) as Parameters<typeof createWorkout>[0];
    await createWorkout(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
