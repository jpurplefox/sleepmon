/// <reference types="vitest/config" />
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Source maps are uploaded to Sentry and deleted before deploy; without an auth
// token (local builds, forks) the plugin is skipped and no maps are emitted.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

// The SSR build (the landing prerender, ADR-0013) is never deployed: no maps, no upload.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    ...(uploadSourceMaps && !isSsrBuild
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.VITE_RELEASE },
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: uploadSourceMaps && !isSsrBuild ? "hidden" : false,
    copyPublicDir: !isSsrBuild,
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
}));
