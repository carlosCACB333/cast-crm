"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

import { UploadIcon } from "@/components/icons";

export interface AppFileDropzoneProps {
  /** MIME types accepted by the file picker, e.g. ["image/png"]. */
  accept: readonly string[];
  title: string;
  /** Limits shown under the title, e.g. "JPG o PNG, hasta 5 MB". */
  hint?: string;
  isMultiple?: boolean;
  isDisabled?: boolean;
  onFiles: (files: File[]) => void;
}

/** Area to drop files or pick them with the keyboard or a click. */
export function AppFileDropzone({
  accept,
  title,
  hint,
  isMultiple,
  isDisabled,
  onFiles,
}: AppFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);

    if (files.length && !isDisabled) {
      onFiles(isMultiple ? files : files.slice(0, 1));
    }
  };

  return (
    <button
      className={clsx(
        "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-accent",
        isOver ? "border-accent bg-accent/5" : "border-separator",
        isDisabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-accent hover:bg-accent/5",
      )}
      disabled={isDisabled}
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragLeave={() => setIsOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isDisabled) setIsOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        take(event.dataTransfer.files);
      }}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-default text-muted">
        <UploadIcon size={20} />
      </span>
      <span className="text-sm font-medium">{title}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      <input
        ref={inputRef}
        accept={accept.join(",")}
        className="hidden"
        multiple={isMultiple}
        tabIndex={-1}
        type="file"
        onChange={(event) => {
          take(event.target.files);
          // Lets the same file be picked again after an error.
          event.target.value = "";
        }}
      />
    </button>
  );
}
