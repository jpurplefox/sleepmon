import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement scrollIntoView; stub it so tests can spy on it (node-environment tests have no Element).
if (typeof Element !== "undefined") Element.prototype.scrollIntoView = () => {};

// We use explicit imports (no Vitest globals), so RTL's automatic afterEach
// cleanup is not wired up — do it here for every component test.
afterEach(() => {
  cleanup();
});
