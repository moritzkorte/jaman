import { NextResponse } from "next/server";
import { requireUnlock, serverError } from "@/lib/api";
import { createBodyweightEntry } from "@/lib/data";

export async function POST(request: Request) {
  const locked = await requireUnlock();

  if (locked) {
    return locked;
  }

  try {
    const body = (await request.json()) as { measuredOn?: string; weightKg?: number };

    if (!body.measuredOn || typeof body.weightKg !== "number") {
      return NextResponse.json({ message: "Datum oder Gewicht fehlt." }, { status: 400 });
    }

    await createBodyweightEntry({ measuredOn: body.measuredOn, weightKg: body.weightKg });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
