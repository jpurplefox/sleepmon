import { useEffect } from "react";

/** Sets the page title and meta description while mounted; restores them on unmount. */
export function useDocumentMeta({ title, description }: { title: string; description: string }): void {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.append(meta);
    }
    const prevTitle = document.title;
    const prevDescription = meta.content;
    document.title = title;
    meta.content = description;
    return () => {
      document.title = prevTitle;
      if (created) meta.remove();
      else meta.content = prevDescription;
    };
  }, [title, description]);
}
