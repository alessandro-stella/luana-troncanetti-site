import "server-only";
import { v2 as cloudinary } from "cloudinary";

// ---------- Config ----------

const ALLOWED_FORMATS = "jpg,jpeg,png,webp,gif,avif";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`);
  return value;
}

export function uploadFolder() {
  return process.env.CLOUDINARY_UPLOAD_FOLDER || "blog";
}

// ---------- URL checks ----------

export function cloudinaryUrlPrefix() {
  return `https://res.cloudinary.com/${env("CLOUDINARY_CLOUD_NAME")}/`;
}

export function isCloudinaryUrl(url: string) {
  return url.startsWith(cloudinaryUrlPrefix());
}

export function isOwnPublicId(publicId: string) {
  return publicId.startsWith(`${uploadFolder()}/`);
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
  cloudinary.config({
    cloud_name: env("CLOUDINARY_CLOUD_NAME"),
    api_key: env("CLOUDINARY_API_KEY"),
    api_secret: env("CLOUDINARY_API_SECRET"),
    secure: true,
  });

  const res = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  return res.result === "ok" || res.result === "not found";
}
