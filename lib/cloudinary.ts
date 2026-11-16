import "server-only";
import { v2 as cloudinary } from "cloudinary";
import type { DiagnosticStep } from "@/lib/types";

// ---------- Config ----------

const ALLOWED_FORMATS = "jpg,jpeg,png,webp,gif,avif";
const REQUIRED_ENV = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

function configure() {
  cloudinary.config({
    cloud_name: env("CLOUDINARY_CLOUD_NAME"),
    api_key: env("CLOUDINARY_API_KEY"),
    api_secret: env("CLOUDINARY_API_SECRET"),
    secure: true,
  });
}

export function uploadFolder() {
  return process.env.CLOUDINARY_UPLOAD_FOLDER || "blog";
}

// ---------- Errors ----------

export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 200);
  if (typeof e === "object" && e !== null) {
    const { message, http_code } = e as { message?: string; http_code?: number };
    if (message) return http_code ? `HTTP ${http_code}: ${message}` : message;
  }
  return "errore sconosciuto";
}

// ---------- URL checks ----------

export function cloudinaryUrlPrefix() {
  return `https://res.cloudinary.com/${env("CLOUDINARY_CLOUD_NAME")}/`;
}

export function isCloudinaryUrl(url: string) {
  return url.startsWith(cloudinaryUrlPrefix());
}

// ---------- Signing ----------

export function signUpload() {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = uploadFolder();

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, allowed_formats: ALLOWED_FORMATS },
    env("CLOUDINARY_API_SECRET"),
  );

  return {
    signature,
    timestamp,
    folder,
    allowedFormats: ALLOWED_FORMATS,
    apiKey: env("CLOUDINARY_API_KEY"),
    cloudName: env("CLOUDINARY_CLOUD_NAME"),
  };
}

// ---------- Deletion ----------

export async function destroyImage(publicId: string) {
  configure();

  const res = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  return res.result === "ok" || res.result === "not found";
}

// ---------- Diagnostics ----------

export async function runCloudinaryChecks(): Promise<DiagnosticStep[]> {
  const steps: DiagnosticStep[] = [];

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  const suspicious = REQUIRED_ENV.filter((name) => {
    const value = process.env[name];
    return value && /^["'\s]|["'\s]$/.test(value);
  });

  if (missing.length > 0 || suspicious.length > 0) {
    steps.push({
      name: "Variabili d'ambiente",
      ok: false,
      detail: [
        missing.length > 0 ? `Mancanti: ${missing.join(", ")}.` : "",
        suspicious.length > 0
          ? `Spazi o virgolette ai bordi del valore: ${suspicious.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
    return steps;
  }

  steps.push({
    name: "Variabili d'ambiente",
    ok: true,
    detail: `Cloud name «${process.env.CLOUDINARY_CLOUD_NAME}», cartella «${uploadFolder()}»`,
  });

  try {
    configure();
    const res = await cloudinary.api.ping();
    steps.push({
      name: "Credenziali Cloudinary",
      ok: true,
      detail: `Risposta: ${res.status}`,
    });
  } catch (e) {
    steps.push({
      name: "Credenziali Cloudinary",
      ok: false,
      detail: describeError(e),
    });
    return steps;
  }

  try {
    signUpload();
    steps.push({ name: "Firma di upload", ok: true, detail: "Generata correttamente" });
  } catch (e) {
    steps.push({ name: "Firma di upload", ok: false, detail: describeError(e) });
  }

  return steps;
}
