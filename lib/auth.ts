import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { checkRateLimit } from "@vercel/firewall";
import { connection } from "next/server";

// ---------- Config ----------

export const SESSION_COOKIE = "admin_session";
const SESSION_TTL_S = 60 * 60 * 8;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

// ---------- Password check ----------

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function checkPassword(candidate: string) {
  return safeEqual(candidate, env("ADMIN_PASSWORD"));
}

// ---------- Signed session token ----------

function sign(payload: string) {
  return createHmac("sha256", env("SESSION_SECRET"))
    .update(payload)
    .digest("hex");
}

function createSessionToken() {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_TTL_S);
  return `${expires}.${sign(expires)}`;
}

function isValidToken(token: string) {
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (!safeEqual(signature, sign(expires))) return false;
  return Number(expires) > Date.now() / 1000;
}

export async function hasValidSession() {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return !!token && isValidToken(token);
}

// ---------- In-memory attempt limiter ----------

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

async function clientKey() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

function lockedMinutes(key: string) {
  const f = failures.get(key);
  if (!f) return 0;
  if (f.resetAt <= Date.now()) {
    failures.delete(key);
    return 0;
  }
  return f.count >= MAX_FAILURES
    ? Math.ceil((f.resetAt - Date.now()) / 60_000)
    : 0;
}

function recordFailure(key: string) {
  const now = Date.now();
  const f = failures.get(key);
  if (!f || f.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    f.count++;
  }
}

// ---------- Password verification with rate limiting ----------

async function verifyPasswordWithLimit(
  password: unknown,
): Promise<string | null> {
  const key = await clientKey();

  const wait = lockedMinutes(key);
  if (wait > 0) return `Troppi tentativi falliti. Riprova tra ${wait} minuti`;

  if (process.env.VERCEL) {
    const { rateLimited, error } = await checkRateLimit("admin-auth", {
      rateLimitKey: key,
    });

    if (rateLimited || error === "blocked") {
      return "Troppi tentativi. Riprova tra qualche minuto";
    }
    if (error === "not-found") {
      console.warn('Regola "admin-auth" non trovata nella dashboard di Vercel');
    }
  }

  if (typeof password !== "string" || !checkPassword(password)) {
    recordFailure(key);
    await new Promise((r) => setTimeout(r, 500));
    return "Password errata";
  }

  failures.delete(key);
  return null;
}

// ---------- Session API used by Server Actions ----------

export async function loginWithPassword(
  password: unknown,
): Promise<string | null> {
  const error = await verifyPasswordWithLimit(password);
  if (error) return error;

  (await cookies()).set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: SESSION_TTL_S,
  });

  return null;
}

export async function endSession() {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 0,
  });
}

// ---------- Write access (session + password) ----------

export async function checkWriteAccess(
  password: unknown,
): Promise<string | null> {
  if (!(await hasValidSession())) {
    return "Sessione scaduta: effettua di nuovo l'accesso";
  }
  return verifyPasswordWithLimit(password);
}
