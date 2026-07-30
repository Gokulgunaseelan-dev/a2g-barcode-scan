import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Live camera barcode scanner (1D + 2D) using ZXing.
 * The library is imported dynamically so it never runs during SSR.
 */
export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              onDetected(result.getText());
            }
          },
        );
        if (cancelled) controls.stop();
      } catch {
        setError("Camera unavailable. Grant camera permission or type the barcode manually.");
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-foreground/90 aspect-[4/3]">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/80" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Hold the barcode inside the frame — it scans automatically.
      </p>
      <Button variant="secondary" className="w-full" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}