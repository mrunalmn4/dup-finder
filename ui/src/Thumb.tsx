import { useEffect, useState } from "react";
import { client } from "./api";

/** Lazy image preview — content MIME only; hide on decode/load failure. */
export default function Thumb({ path, mime }: { path: string; mime: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Trust scan sniff, not extension (fixtures use .jpg for non-images).
  const isImage = mime.startsWith("image/");

  useEffect(() => {
    setFailed(false);
    setUrl(null);
    if (!isImage) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      const u = await client.previewUrl(path);
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      if (!u) {
        setFailed(true);
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

  if (!isImage || failed || !url) return null;
  return (
    <img
      className="thumb"
      src={url}
      alt=""
      loading="lazy"
      onError={() => {
        setFailed(true);
        setUrl(null);
      }}
    />
  );
}
