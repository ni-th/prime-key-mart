"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { getProductImageUploadSignature } from "@/app/actions/uploads";
import { ImageCropDialog } from "@/components/admin/image-crop-dialog";
import { optimizedImageUrl } from "@/lib/image-url";
import { IMAGE_PRESETS, type ImagePreset } from "@/lib/image-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Picked files can be large: they're cropped + re-encoded before upload. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
/** Cap on what is actually sent to Cloudinary (a 1600x1000 WebP is far below). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/**
 * Product image field. Uploads the chosen file straight to Cloudinary (signed
 * by our server) and submits the resulting URL as `name` in the form. When
 * Cloudinary isn't configured it falls back to a plain "paste an image URL"
 * input, so the form keeps working.
 */
export function ImageUpload({
  name,
  defaultValue,
  enabled,
  invalid,
  preset = "product",
}: {
  name: string;
  /** Crop shape, export size and upload folder. */
  preset?: ImagePreset;
  defaultValue?: string | null;
  /** Whether Cloudinary keys are set on the server. */
  enabled: boolean;
  invalid?: boolean;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Object URL of the picked file while the crop dialog is open.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = progress !== null;
  const p = IMAGE_PRESETS[preset];

  if (!enabled) {
    return (
      <Input
        name={name}
        type="url"
        placeholder="https://..."
        defaultValue={defaultValue ?? ""}
        aria-invalid={invalid || undefined}
      />
    );
  }

  /** Upload the already-cropped image. */
  async function upload(file: Blob) {
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("The cropped image is over 5 MB. Try a smaller source image.");
      return;
    }

    setProgress(0);
    const res = await getProductImageUploadSignature(preset);
    if (!res.ok) {
      setProgress(null);
      setError(res.error);
      return;
    }
    const s = res.signature;
    const body = new FormData();
    body.append("file", file, file.type === "image/png" ? "product.png" : "product.webp");
    body.append("api_key", s.apiKey);
    body.append("timestamp", String(s.timestamp));
    body.append("signature", s.signature);
    body.append("folder", s.folder);
    body.append("allowed_formats", s.allowedFormats);

    // XHR (not fetch) so we can show upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", s.uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && json.secure_url) {
          setUrl(json.secure_url);
        } else {
          setError(json.error?.message ?? "Upload failed. Please try again.");
        }
      } catch {
        setError("Upload failed. Please try again.");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Upload failed - check your connection and try again.");
    };
    xhr.send(body);
  }

  /** Validate the picked file, then open the crop dialog for it. */
  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setError(null);
    if (!ACCEPT.includes(file.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("That image is over 20 MB. Please use a smaller one.");
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  return (
    <div className="space-y-2">
      <ImageCropDialog
        src={cropSrc}
        preset={preset}
        onCancel={closeCrop}
        onConfirm={(blob) => {
          closeCrop();
          void upload(blob);
        }}
      />
      <input type="hidden" name={name} value={url} />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      {url ? (
        <div className="flex flex-wrap items-start gap-4">
          <div className={cn("relative overflow-hidden rounded-lg border bg-muted", p.previewClass)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- preview of an arbitrary uploaded URL */}
            <img
              src={optimizedImageUrl(url, 800)}
              alt="Image preview"
              className="h-full w-full object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {progress}%
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <RefreshCw className="size-4" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => setUrl("")}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          data-invalid={invalid || undefined}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors outline-none hover:border-primary/60 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 data-invalid:border-destructive",
            dragging && "border-primary bg-accent",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-6 animate-spin text-primary" />
              <span>Uploading... {progress}%</span>
            </>
          ) : (
            <>
              <ImagePlus className="size-6 text-primary" />
              <span>
                <span className="font-medium text-foreground">Click to upload</span>{" "}
                or drag an image here
              </span>
              <span className="text-xs">
                JPG, PNG or WebP, up to 20 MB. You&apos;ll crop it to {p.aspectLabel} next.
              </span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
