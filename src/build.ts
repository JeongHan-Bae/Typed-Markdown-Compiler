import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import less from "less";
import { siteConfig } from "../config.ts";
import type { CollectionResult, RenderPageInput, RouteRecord, SourceDocument } from "./ast/types.ts";
import { normalizeGithubUsername } from "./plugins/github-follow-link.ts";
import { assetOutputPath, normalizeAssetName } from "./resolver/asset-resolver.ts";
import {
  createNavigationContext,
  createPrimaryNavigation,
  discoverContent,
  RouteResolver
} from "./resolver/route-resolver.ts";
import { renderPageTemplate } from "./renderer/template-renderer.ts";

const rootDirectory = process.cwd();
const distDirectory = join(rootDirectory, "dist");

async function build(): Promise<void> {
  await rm(distDirectory, { recursive: true, force: true });
  await mkdir(distDirectory, { recursive: true });

  const manifest = await discoverContent(rootDirectory, siteConfig);
  const resolver = new RouteResolver(manifest.routes, siteConfig.basePath);
  const collectionMap = manifest.collections;

  await compileStyles();
  await copyPublicAssets();
  const githubAvatarHref = await prepareGithubAvatar(siteConfig.githubUsername);

  for (const route of resolver.all()) {
    await renderRoute(
      route,
      resolver,
      manifest.documents,
      collectionMap,
      manifest.navigation,
      githubAvatarHref
    );
  }

  await writeRouteManifest(resolver, [...collectionMap.values()]);
  console.log(`Built ${resolver.all().length} pages in ${distDirectory}`);
}

async function renderRoute(
  route: RouteRecord,
  resolver: RouteResolver,
  documents: Map<string, SourceDocument>,
  collections: Map<string, CollectionResult>,
  navigationNames: string[],
  githubAvatarHref: string | null
): Promise<void> {
  const document = findDocumentForRoute(route, documents);
  if (document.metadata.draft) {
    return;
  }

  const collection = route.collection === undefined ? undefined : collections.get(route.collection);
  const navigation = createNavigationContext(route, resolver, collections);
  const primaryNavigation = createPrimaryNavigation(navigationNames, resolver, route, collections);
  const outputPath = outputPathForRoute(route.path);
  const assetHref = rootRelativePath("assets/site.css");
  const assetHrefForName = (name: string): string => {
    return rootRelativePath(assetOutputPath(normalizeAssetName(name)));
  };
  const input: RenderPageInput = {
    route,
    document,
    navigation,
    primaryNavigation,
    collection
  };
  const html = await renderPageTemplate(
    siteConfig,
    input,
    resolver,
    collections,
    assetHref,
    assetHrefForName,
    githubAvatarHref
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
}

async function prepareGithubAvatar(username: string): Promise<string | null> {
  const normalizedUsername = normalizeGithubUsername(username);
  if (normalizedUsername === null) {
    return null;
  }

  const remoteHref = `https://github.com/${normalizedUsername}.png?size=128`;
  try {
    const response = await fetch(remoteHref, {
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`GitHub returned a non-image content type: ${contentType || "unknown"}`);
    }
    const extension = githubImageExtension(contentType);
    const relativePath = `assets/github/${normalizedUsername}.${extension}`;
    const outputPath = join(distDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, new Uint8Array(await response.arrayBuffer()));
    return rootRelativePath(relativePath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not cache GitHub avatar for ${normalizedUsername}: ${message}`);
    return null;
  }
}

function githubImageExtension(contentType: string): "gif" | "jpg" | "png" | "webp" {
  if (contentType.includes("gif")) {
    return "gif";
  }
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  return "png";
}

function findDocumentForRoute(
  route: RouteRecord,
  documents: Map<string, SourceDocument>
): SourceDocument {
  const document = documents.get(route.sourcePath);
  if (document !== undefined) {
    return document;
  }

  throw new Error(`No document found for route: ${route.name}`);
}

async function compileStyles(): Promise<void> {
  const stylePath = join(rootDirectory, siteConfig.styleEntry);
  const source = await readFile(stylePath, "utf8");
  const result = await less.render(source, {
    filename: stylePath,
    compress: false,
    javascriptEnabled: false
  });
  const outputPath = join(distDirectory, "assets", "site.css");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.css, "utf8");
}

async function copyPublicAssets(): Promise<void> {
  const publicDirectory = join(rootDirectory, siteConfig.publicDirectory);
  const entries = await readdir(publicDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".gitkeep") {
      continue;
    }
    await cp(join(publicDirectory, entry.name), join(distDirectory, entry.name), {
      recursive: true,
      force: true
    });
  }
}

async function writeRouteManifest(resolver: RouteResolver, collections: CollectionResult[]): Promise<void> {
  const manifest = {
    routes: resolver.all().map((route) => ({
      name: route.name,
      path: resolver.hrefForPath(route.path),
      title: route.title,
      indexed: route.indexed,
      template: route.template,
      collection: route.collection,
      slug: route.slug
    })),
    collections: collections.map((collection) => ({
      name: collection.name,
      path: resolver.hrefForPath(collection.head.path),
      items: collection.items.map((item) => ({
        slug: item.slug,
        path: resolver.href(item.routeName),
        title: item.document.metadata.title,
        indexed: item.document.metadata.indexed
      }))
    }))
  };
  await writeFile(join(distDirectory, "routes.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function outputPathForRoute(path: string): string {
  const cleanPath = path.replace(/^\/+|\/+$/gu, "");
  return cleanPath.length === 0
    ? join(distDirectory, "index.html")
    : join(distDirectory, cleanPath, "index.html");
}

function toWebPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function rootRelativePath(path: string): string {
  const basePath = siteConfig.basePath.replace(/\/+$/gu, "");
  const cleanPath = toWebPath(path).replace(/^\/+/u, "");
  return `${basePath}/${cleanPath}`;
}

build().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
