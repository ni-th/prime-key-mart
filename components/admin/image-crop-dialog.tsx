"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Every product image is shown at 16:10 (cards and product page). */
const ASPECT = 16 / 10;
/** Exported size: sharp on 2x screens, small enough to upload quickly. */
const OUTPUT_WIDTH = 1600;
/** Below this crop width the image will look soft on the product page. */
const MIN_SHARP_WIDTH = 1200;

/** Draw the selected area onto a canvas and export it (WebP, else PNG). */
async function exportCrop(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read the image."));
    el.src = src;
  });

  // Never upscale: a small source stays its own size (just cropped).
  const width = Math.min(OUTPUT_WIDTH, Math.round(area.width));
  const height = Math.round(width / ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't crop images.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height);

  const toBlob = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  // WebP keeps transparency and is small. Browsers that can't encode WebP
  // (older Safari) silently return PNG instead, which is also fine.
  const blob = (await toBlob("image/webp", 0.9)) ?? (await toBlob("image/png"));
  if (!blob) throw new Error("Could not export the cropped image.");
  return blob;
}

/**
 * Crop step before upload: a fixed 16:10 frame the admin can drag and zoom.
 * Returns the cropped image (max 1600 x 1000) via `onConfirm`.
 */
export function ImageCropDialog({
  src,
  onCancel,
  onConfirm,
}: {
  /** Object URL of the picked file; dialog is open while this is set. */
  src: string | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  function reset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setBusy(false);
    setError(null);
  }

  async function confirm() {
    if (!src || !area) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await exportCrop(src, area);
      reset();
      onConfirm(blob);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Cropping failed.");
    }
  }

  const lowRes = area !== null && area.width < MIN_SHARP_WIDTH;

  return (
    <Dialog
      open={src !== null}
      onOpenChange={(open) => {
        if (!open && !busy) {
          reset();
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
          <DialogDescription>
            Drag to position and zoom to fit. Products are shown at 16:10; keep
            the product near the middle (the cart shows a square from the center).
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted sm:h-96">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={ASPECT}
              minZoom={1}
              maxZoom={4}
              zoomSpeed={0.2}
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1.5 w-full cursor-pointer accent-primary"
          />
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
        </div>

        {lowRes && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This crop is only {Math.round(area.width)} px wide, so the image may look
            soft on the product page. Zoom out or use a larger image (1600 px wide or
            more) if you can.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              reset();
              onCancel();
            }}
          >
            Cancel
          </Button>
          <Button type="button" disabled={busy || !area} onClick={confirm}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Crop &amp; upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
