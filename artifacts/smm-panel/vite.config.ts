import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

function resolvePort(rawPort: string | undefined, fallback = "5173") {
  const port = Number(rawPort || fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
  return port;
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const port = resolvePort(env.PORT || process.env.PORT);
  const apiTarget =
    env.VITE_API_BASE_URL ||
    env.VITE_API_ORIGIN ||
    process.env.VITE_API_BASE_URL ||
    process.env.VITE_API_ORIGIN ||
    "http://localhost:3000";
  const basePath = env.BASE_PATH || process.env.BASE_PATH || "/";

  return {
    base: basePath,
    plugins: [
      react(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
