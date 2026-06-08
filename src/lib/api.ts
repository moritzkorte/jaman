import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/auth";

export async function requireUnlock() {
  if (!(await isUnlocked())) {
    return NextResponse.json({ message: "Nicht freigeschaltet." }, { status: 401 });
  }

  return null;
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
  return NextResponse.json({ message }, { status: 500 });
}
