/** Fields signed by the server to upload one image straight to Cloudinary. */
export interface SignedImageUpload {
  url: string;
  fields: Record<string, string>;
}

/** Sends the file to Cloudinary, reporting the progress from 0 to 1. */
export function uploadImage(
  file: File,
  { url, fields }: SignedImageUpload,
  onProgress?: (progress: number) => void,
) {
  return new Promise<{ public_id: string }>((resolve, reject) => {
    const body = new FormData();

    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append("file", file);

    const request = new XMLHttpRequest();

    request.open("POST", url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      const response = JSON.parse(request.responseText || "{}");

      if (request.status >= 200 && request.status < 300) resolve(response);
      else {
        reject(
          new Error(response.error?.message ?? "Cloudinary rechazó la imagen."),
        );
      }
    };
    request.onerror = () =>
      reject(new Error("No se pudo conectar con el servicio de imágenes."));
    request.send(body);
  });
}

/** MIME types for an `accept` list from Cloudinary format names. */
export const imageMimeTypes = (formats: readonly string[]) =>
  formats
    .map((format) => `image/${format === "jpg" ? "jpeg" : format}`)
    .filter((type, index, all) => all.indexOf(type) === index);
