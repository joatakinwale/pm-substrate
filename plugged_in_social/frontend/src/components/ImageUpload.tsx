"use client";

/**
 * Reusable image upload control. Uploads via the existing
 * ``POST /api/media/upload`` flow (R2 / CF Images / CF Stream router)
 * then resolves the final delivery URL via ``GET /api/media/{id}``.
 *
 * Used for the org logo, page/social images, and blog post covers.
 * The upload-and-resolve dance lives in ``lib/media-upload`` so every
 * caller behaves identically.
 */

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Upload, X } from "lucide-react";
import { uploadMediaAsset } from "@/lib/media-upload";

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** Field in the asset row for organisation — e.g. "logo" or "blog-cover". */
  context: string;
  /** Optional placeholder for the URL input fallback. */
  placeholder?: string;
  /** Lets callers nudge thumbnail aspect — square (logo) vs wide (cover). */
  aspect?: "square" | "wide";
  /** Lets the consumer disable the inline URL editor (e.g. force upload-only). */
  showUrlInput?: boolean;
};

export default function ImageUpload({
  value,
  onChange,
  context,
  placeholder = "https://…",
  aspect = "wide",
  showUrlInput = true,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadMediaAsset(file, {
        assetType: "image",
        context,
      });
      onChange(asset.deliveryUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const thumbClass =
    aspect === "square"
      ? "w-20 h-20 rounded-xl"
      : "w-32 h-20 rounded-xl";

  return (
    <div className="flex items-start gap-4">
      <div
        className={`${thumbClass} border border-border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0`}
      >
        {value ? (
          <Image
            src={value}
            alt="Preview"
            width={128}
            height={80}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <Upload className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-gray-50 transition disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? "Uploading…" : "Upload image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-gray-50 transition"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handle(file);
          }}
        />
        {showUrlInput && (
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-1.5 border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-foreground/10"
          />
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
