import { useEffect, useState } from "react";
import { client } from "./api";

/** Lazy image preview for paths under last scan roots. */
export default function Thumb({ path, mime }: { path: string; mime: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(path);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      const u = await client.previewUrl(path);
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      objectUrl = u;
      setUrl(u);
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, isImage]);

  if (!isImage || !url) return null;
  return <img className="thumb" src={url} alt="" loading="lazy" />;
}
