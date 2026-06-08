import { NextResponse } from "next/server";
import { requireUnlock, serverError } from "@/lib/api";
import { addExerciseToPlan, createPlan, createPlanFromExercises, getAppState, removeExerciseFromPlan } from "@/lib/data";

export async function GET() {
  const locked = await requireUnlock();

  if (locked) {
    return locked;
  }

  try {
    const state = await getAppState();
    return NextResponse.json(state.plans);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const locked = await requireUnlock();

  if (locked) {
    return locked;
  }

  try {
    const body = (await request.json()) as {
      action?: "create-day" | "create-day-from-session" | "add-exercise" | "remove-exercise";
      splitId?: number;
      name?: string;
      planId?: number;
      planExerciseId?: number;
      exerciseName?: string;
      muscleGroupIds?: number[];
      exerciseIds?: number[];
    };

    if (body.action === "create-day" && body.splitId && body.name) {
      const planId = await createPlan({ splitId: body.splitId, name: body.name });
      return NextResponse.json({ ok: true, planId });
    } else if (body.action === "create-day-from-session" && body.splitId && body.name) {
      const planId = await createPlanFromExercises({
        splitId: body.splitId,
        name: body.name,
        exerciseIds: body.exerciseIds ?? []
      });
      return NextResponse.json({ ok: true, planId });
    } else if (body.action === "add-exercise" && body.planId && body.exerciseName) {
      await addExerciseToPlan({
        planId: body.planId,
        exerciseName: body.exerciseName,
        muscleGroupIds: body.muscleGroupIds ?? []
      });
    } else if (body.action === "remove-exercise" && body.planExerciseId) {
      await removeExerciseFromPlan(body.planExerciseId);
    } else {
      return NextResponse.json({ message: "Aktion oder Pflichtfeld fehlt." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
