import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { resolveEnvironment } from "./constants/environment.ts";
import { DEFAULT_DEV_HOST, DEFAULT_DEV_PORT } from "./constants/runtime.ts";
import { resolveConstants } from "./constants/site.ts";

const port = Number(process.env.PORT ?? DEFAULT_DEV_PORT);
const configuredBasePath = resolveConstants(resolveEnvironment(process.env)).basePath;
const viteBasePath = configuredBasePath.length === 0 ? "/" : `${configuredBasePath}/`;

const directoryIndexFallback: Plugin = {
  name: "directory-index-fallback",
  configureServer: addDirectoryIndexFallback,
  configurePreviewServer: addDirectoryIndexFallback
};

export default defineConfig(({ isPreview }) => ({
  root: isPreview ? "." : "dist",
  base: viteBasePath,
  appType: "mpa",
  plugins: [directoryIndexFallback],
  server: {
    host: process.env.HOST ?? DEFAULT_DEV_HOST,
    port,
    strictPort: true,
    hmr: false
  },
  preview: {
    host: process.env.HOST ?? DEFAULT_DEV_HOST,
    port,
    strictPort: true
  }
}));

function addDirectoryIndexFallback(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((request, _response, next) => {
    const requestUrl = request.url;
    if (requestUrl === undefined) {
      next();
      return;
    }

    const url = new URL(requestUrl, "http://localhost");
    const pathname = url.pathname;
    const indexPath = resolve(join(process.cwd(), "dist"), "." + pathname, "index.html");
    const distPath = resolve(join(process.cwd(), "dist"));
    const isDirectoryRoute = !pathname.endsWith("/") && extname(pathname) === "";
    const isInsideDist = indexPath === distPath || indexPath.startsWith(distPath + "/");

    if (isDirectoryRoute && isInsideDist && existsSync(indexPath)) {
      request.url = pathname + "/" + url.search;
    }
    next();
  });
}
