import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useDocumentMeta } from "./useDocumentMeta";

function Probe({ title, description }: { title: string; description: string }) {
  useDocumentMeta({ title, description });
  return null;
}
const desc = () => document.querySelector('meta[name="description"]')?.getAttribute("content");

afterEach(() => document.head.querySelectorAll('meta[name="description"]').forEach((m) => m.remove()));

describe("useDocumentMeta", () => {
  it("sets the title and description, and restores them on unmount", () => {
    document.title = "before";
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = "old";
    document.head.append(meta);

    const { rerender, unmount } = render(<Probe title="Landing" description="About it" />);
    expect(document.title).toBe("Landing");
    expect(desc()).toBe("About it");

    rerender(<Probe title="Portada" description="De qué se trata" />);
    expect(document.title).toBe("Portada");
    expect(desc()).toBe("De qué se trata");

    unmount();
    expect(document.title).toBe("before");
    expect(desc()).toBe("old");
  });

  it("creates the description meta when the page has none", () => {
    render(<Probe title="T" description="D" />);
    expect(desc()).toBe("D");
  });
});
