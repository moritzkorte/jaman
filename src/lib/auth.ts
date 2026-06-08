import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "workout_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getCookieSecret() {
  const secret = process.env.COOKIE_SECRET;

  if (!secret) {
    throw new Error("COOKIE_SECRET is missing.");
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getCookieSecret()).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }

  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }

  return process.env.VERCEL === "1";
}

export function isCorrectPasscode(passcode: string) {
  const expected = process.env.APP_PASSCODE;

  if (!expected) {
    throw new Error("APP_PASSCODE is missing.");
  }

  return safeEqual(passcode, expected);
}

export async function createSessionCookie() {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  const signature = sign(payload);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isUnlocked() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;

  if (!session) {
    return false;
  }

  const [payload, signature] = session.split(".");

  if (!payload || !signature || sign(payload) !== signature) {
    return false;
  }

  const expiresAt = Number(payload);

  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}
