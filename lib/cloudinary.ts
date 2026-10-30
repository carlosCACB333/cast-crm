import "server-only";

import { createHash } from "node:crypto";

import { APIError } from "better-auth/api";

// Cloudinary through its REST API: uploads are signed here and sent from the
// browser straight to Cloudinary, so files never pass through this server.
// The API secret never leaves the server.

const API_URL = "https://api.cloudinary.com/v1_1";

function getConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new APIError("SERVICE_UNAVAILABLE", {
      code: "IMAGES_NOT_CONFIGURED",
    });
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    /** Root folder of this deployment inside the Cloudinary account. */
    rootFolder: process.env.CLOUDINARY_FOLDER || "cast-crm",
  };
}

/** Signature of a request: sorted `name=value` pairs plus the secret, SHA-1. */
function sign(params: Record<string, string>, apiSecret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1")
    .update(payload + apiSecret)
    .digest("hex");
}

/** Folder of an organization's module item, e.g. `cast-crm/org/products/id`. */
export function assetFolder(...parts: string[]) {
  return [getConfig().rootFolder, ...parts].join("/");
}

/**
 * Fields the browser sends with the file to upload it into `folder`. Valid
 * for one hour; the formats are enforced by Cloudinary.
 */
export function signImageUpload(folder: string, formats: readonly string[]) {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const params = {
    allowed_formats: formats.join(","),
    folder,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };

  return {
    url: `${API_URL}/${cloudName}/image/upload`,
    fields: { ...params, api_key: apiKey, signature: sign(params, apiSecret) },
  };
}

export interface CloudinaryImage {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

/** Details of an uploaded image read from Cloudinary, or null if missing. */
export async function getImage(publicId: string) {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const response = await fetch(
    `${API_URL}/${cloudName}/resources/image/upload/${publicId
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Cloudinary respondió ${response.status}`);
  }

  return (await response.json()) as CloudinaryImage;
}

/** Uploads a copy of an existing image into `folder`, fetched by Cloudinary. */
export async function copyImage(sourceUrl: string, folder: string) {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const params = {
    folder,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const response = await fetch(`${API_URL}/${cloudName}/image/upload`, {
    method: "POST",
    body: new URLSearchParams({
      ...params,
      file: sourceUrl,
      api_key: apiKey,
      signature: sign(params, apiSecret),
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloudinary respondió ${response.status}`);
  }

  return (await response.json()) as CloudinaryImage;
}

/** Deletes an image; images that no longer exist count as deleted. */
export async function deleteImage(publicId: string) {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const params = {
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const response = await fetch(`${API_URL}/${cloudName}/image/destroy`, {
    method: "POST",
    body: new URLSearchParams({
      ...params,
      api_key: apiKey,
      signature: sign(params, apiSecret),
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloudinary respondió ${response.status}`);
  }

  const { result } = (await response.json()) as { result: string };

  if (result !== "ok" && result !== "not found") {
    throw new Error(`Cloudinary no pudo borrar la imagen: ${result}`);
  }
}

/**
 * Deletes every image whose public id starts with `folder/`. Cloudinary
 * removes up to 1000 per request and reports `partial` while more remain.
 */
export async function deleteImagesInFolder(folder: string) {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const url = `${API_URL}/${cloudName}/resources/image/upload?${new URLSearchParams({ prefix: `${folder}/` })}`;

  for (;;) {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Cloudinary respondió ${response.status}`);
    }

    const { partial } = (await response.json()) as { partial?: boolean };

    if (!partial) return;
  }
}

/** Delivery URL of an image with Cloudinary transformations, e.g. `c_fill,w_256`. */
export function transformedUrl(secureUrl: string, transformation: string) {
  return secureUrl.replace(
    "/image/upload/",
    `/image/upload/${transformation}/`,
  );
}

/**
 * Public id of an image inside `folder` read back from its delivery URL, or
 * null when the URL does not point into that folder.
 */
export function publicIdInFolder(url: string, folder: string) {
  const start = url.indexOf(`/${folder}/`);

  return start === -1 ? null : url.slice(start + 1).replace(/\.[^./]+$/, "");
}
