"use client";

import Image, { type ImageLoader } from "next/image";
import clsx from "clsx";

/**
 * Asks Cloudinary for the exact width the browser needs, in the best format
 * it supports. Other URLs are left as they are.
 */
const cloudinaryLoader: ImageLoader = ({ src, width, quality }) =>
  src.includes("/image/upload/")
    ? src.replace(
        "/image/upload/",
        `/image/upload/f_auto,q_${quality ?? "auto"},c_limit,w_${width}/`,
      )
    : src;

export interface AppImageProps {
  src: string;
  alt: string;
  /** Rendered width in CSS; the image fills its positioned parent. */
  sizes: string;
  className?: string;
  /** Loads it eagerly, e.g. the main photo above the fold. */
  isPriority?: boolean;
}

/** Remote image (Cloudinary) that fills its parent, cropped to cover it. */
export function AppImage({
  src,
  alt,
  sizes,
  className,
  isPriority,
}: AppImageProps) {
  return (
    <Image
      fill
      alt={alt}
      className={clsx("object-cover", className)}
      loader={cloudinaryLoader}
      preload={isPriority}
      sizes={sizes}
      src={src}
    />
  );
}
