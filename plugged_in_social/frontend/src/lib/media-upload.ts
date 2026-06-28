"use client";

import {
  apiFetch,
  type PresignedUploadResponse,
} from "@/lib/api";

type UploadMediaAssetOptions = {
  assetType?: "image" | "video" | "document";
  context: string;
};

type UploadedMediaAsset = {
  assetId: string;
  deliveryUrl: string;
};

export async function uploadMediaAsset(
  file: File,
  { assetType = "image", context }: UploadMediaAssetOptions,
): Promise<UploadedMediaAsset> {
  const contentType =
    file.type || (assetType === "image" ? "image/png" : "application/octet-stream");
  const presigned = await apiFetch<PresignedUploadResponse>(
    `/api/media/upload`,
    {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        content_type: contentType,
        asset_type: assetType,
        context,
      }),
    },
  );

  if (presigned.cf_image_id) {
    const fd = new FormData();
    fd.append("file", file);
    const resp = await fetch(presigned.upload_url, {
      method: "POST",
      body: fd,
    });
    if (!resp.ok) {
      throw new Error(
        `Cloudflare Images upload failed: ${resp.status} ${resp.statusText}`,
      );
    }
  } else {
    const resp = await fetch(presigned.upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!resp.ok) {
      throw new Error(`R2 upload failed: ${resp.status} ${resp.statusText}`);
    }
  }

  const asset = await apiFetch<{ delivery_url: string | null }>(
    `/api/media/${presigned.asset_id}`,
  );
  if (!asset.delivery_url) {
    throw new Error(
      "Upload succeeded but no delivery URL — set CF_IMAGES_DELIVERY_URL or R2_PUBLIC_URL on the backend.",
    );
  }

  return {
    assetId: presigned.asset_id,
    deliveryUrl: asset.delivery_url,
  };
}
