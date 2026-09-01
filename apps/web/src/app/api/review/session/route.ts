import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  REVIEW_COOKIE_NAME,
  createSessionToken,
  isCorrectPassword,
  isSessionValid,
  sessionCookieOptions,
} from "../../../../lib/review-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  return NextResponse.json({ authenticated: isSessionValid(token) });
}

export async function POST(request: NextRequest) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!isCorrectPassword(password)) {
    return NextResponse.json(
      { ok: false, error: "wrong_password" },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(REVIEW_COOKIE_NAME, createSessionToken(), sessionCookieOptions);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(REVIEW_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
