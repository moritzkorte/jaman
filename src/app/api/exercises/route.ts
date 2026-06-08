import { NextResponse } from "next/server";
import { requireUnlock, serverError } from "@/lib/api";
import { createOrUpdateExercise } from "@/lib/data";

export async function POST(request: Request) {
  const locked = await requireUnlock();

  if (locked) {
    return locked;
  }

  try {
    const body = (await request.json()) as { name?: string; muscleGroupIds?: number[] };

    if (!body.name) {
      return NextResponse.json({ message: "Übungsname fehlt." }, { status: 400 });
    }

    const id = await createOrUpdateExercise({ name: body.name, muscleGroupIds: body.muscleGroupIds ?? [] });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return serverError(error);
  }
}
