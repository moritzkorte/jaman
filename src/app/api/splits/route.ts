import { NextResponse } from "next/server";
import { requireUnlock, serverError } from "@/lib/api";
import { createSplit } from "@/lib/data";

export async function POST(request: Request) {
  const locked = await requireUnlock();

  if (locked) {
    return locked;
  }

  try {
    const body = (await request.json()) as { name?: string; planNames?: string[] };

    if (!body.name) {
      return NextResponse.json({ message: "Split-Name fehlt." }, { status: 400 });
    }

    await createSplit({ name: body.name, planNames: body.planNames ?? [] });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
