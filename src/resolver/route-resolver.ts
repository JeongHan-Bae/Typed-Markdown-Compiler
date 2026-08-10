import { readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import {
  FIRST_INDEX,
  NO_INDEX,
  ROUTE_SEGMENT_SEPARATOR,
  SORT_AFTER,
  SORT_BEFORE
} from "../../constants/runtime.ts";
import type {
  CollectionItem,
  CollectionResult,
  NavigationContext,
  NavigationLink,
  RouteRecord,
  SiteConfig,
  SourceDocument
} from "../ast/types.ts";
import { parseMarkdownFile } from "../parser/markdown-parser.ts";

export interface ContentManifest {
  documents: Map<string, SourceDocument>;
  routes: RouteRecord[];
  collections: Map<string, CollectionResult>;
  navigation: string[];
}

export class RouteResolver {
  private readonly byName = new Map<string, RouteRecord>();

  private readonly byPath = new Map<string, RouteRecord>();

  private readonly records: RouteRecord[];

  private readonly basePath: string;

  public constructor(records: RouteRecord[], basePath: string) {
    this.basePath = normalizeBasePath(basePath);
    this.records = [];

    for (const record of records) {
      const normalizedRecord = { ...record, path: normalizePath(record.path) };
      if (this.byName.has(normalizedRecord.name)) {
        throw new Error(`Duplicate route name: ${normalizedRecord.name}`);
      }
      if (this.byPath.has(normalizedRecord.path)) {
        throw new Error(`Duplicate route path: ${normalizedRecord.path}`);
      }

      this.byName.set(normalizedRecord.name, normalizedRecord);
      this.byPath.set(normalizedRecord.path, normalizedRecord);
      this.records.push(normalizedRecord);

      for (const alias of normalizedRecord.aliases ?? []) {
        if (this.byName.has(alias)) {
          throw new Error(`Duplicate route name or alias: ${alias}`);
        }
        this.byName.set(alias, normalizedRecord);
      }
    }
  }

  public get(name: string): RouteRecord {
    const record = this.byName.get(name);
    if (record === undefined) {
      throw new Error(`Unknown route: ${name}`);
    }
    return record;
  }

  public tryGet(name: string): RouteRecord | undefined {
    return this.byName.get(name);
  }

  public href(name: string): string {
    return this.hrefForPath(this.get(name).path);
  }

  public hrefForPath(path: string): string {
    const normalizedPath = normalizePath(path);
    const routePath = normalizedPath === "/" ? "/" : `${normalizedPath}/`;
    return this.basePath.length === 0 ? routePath : `${this.basePath}${routePath}`;
  }

  public hrefForRelative(path: string): string {
    if (this.basePath.length === 0 || !path.startsWith("/")) {
      return path;
    }
    return `${this.basePath}/${path.replace(/^\/+/u, "")}`;
  }

  public all(): RouteRecord[] {
    return [...this.records];
  }
}

export async function discoverContent(
  rootDirectory: string,
  config: SiteConfig
): Promise<ContentManifest> {
  const contentDirectory = join(rootDirectory, config.contentDirectory);
  const markdownFiles = await findMarkdownFiles(contentDirectory);
  const documents = new Map<string, SourceDocument>();
  const routes: RouteRecord[] = [];

  for (const absolutePath of markdownFiles) {
    const sourcePath = normalizeSourcePath(relative(contentDirectory, absolutePath));
    const slug = basename(sourcePath, extname(sourcePath));
    const document = await parseMarkdownFile(absolutePath, slug, sourcePath);
    documents.set(sourcePath, document);

    if (!document.metadata.draft) {
      routes.push(createRouteRecord(sourcePath, document));
    }
  }

  const collections = createCollections(routes, documents);
  const navigation = routes
    .filter((route) => isRootContentRoute(route.sourcePath))
    .sort(compareIndexedThenAlphabetical)
    .map((route) => route.name);

  return { documents, routes, collections, navigation };
}

async function findMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const sortedEntries = entries.sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMarkdownFiles(entryPath));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.push(entryPath);
    }
  }

  return files;
}

function createRouteRecord(sourcePath: string, document: SourceDocument): RouteRecord {
  const sourceParts = sourcePath.split("/");
  const fileName = sourceParts.pop() ?? sourcePath;
  const fileSlug = basename(fileName, extname(fileName));
  const pathParts = fileSlug.toLowerCase() === "index"
    ? sourceParts
    : [...sourceParts, fileSlug];
  const routePath = pathParts.length === 0 ? "/" : `/${pathParts.join("/")}`;
  const routeName = pathParts.length === 0
    ? "index"
    : pathParts.join(ROUTE_SEGMENT_SEPARATOR);
  return {
    name: routeName,
    path: routePath,
    sourcePath,
    template: "page",
    slug: fileSlug,
    title: document.metadata.title,
    indexed: document.metadata.indexed,
    aliases: routeName === "index" ? ["", "home"] : undefined
  };
}

function createCollections(
  routes: RouteRecord[],
  documents: Map<string, SourceDocument>
): Map<string, CollectionResult> {
  const collections = new Map<string, CollectionResult>();

  for (const route of routes) {
    const document = documents.get(route.sourcePath);
    if (document?.metadata.type !== "list") {
      continue;
    }
    const sourcePath = normalizeCollectionSource(document.metadata.listSource);
    if (sourcePath === null) {
      throw new Error(`List page ${route.sourcePath} must declare a source directory`);
    }
    if (collections.has(sourcePath)) {
      throw new Error(`Multiple list pages declare the same source directory: ${sourcePath}`);
    }

    collections.set(sourcePath, {
      name: sourcePath,
      sourcePath,
      head: route,
      items: []
    });
  }

  for (const route of routes) {
    const parentCollection = findParentCollection(route.sourcePath, collections);
    if (parentCollection === null || route.slug?.toLowerCase() === "index") {
      route.template = selectTemplate(route, false, documents);
      continue;
    }

    route.collection = parentCollection.name;
    route.template = selectTemplate(route, true, documents);
    const document = documents.get(route.sourcePath);
    if (document === undefined) {
      throw new Error(`No document found for collection item: ${route.sourcePath}`);
    }
    parentCollection.items.push({
      collection: parentCollection.name,
      slug: route.slug ?? route.name,
      routeName: route.name,
      path: route.path,
      sourcePath: route.sourcePath,
      document
    });
  }

  for (const collection of collections.values()) {
    collection.items.sort(compareCollectionItems);
  }

  return collections;
}

function findParentCollection(
  sourcePath: string,
  collections: Map<string, CollectionResult>
): CollectionResult | null {
  const sourceParts = sourcePath.split("/");
  sourceParts.pop();
  const parentPath = sourceParts.join("/");
  return collections.get(parentPath) ?? null;
}

function selectTemplate(
  route: RouteRecord,
  isListObject: boolean,
  documents: Map<string, SourceDocument>,
): RouteRecord["template"] {
  const document = documents.get(route.sourcePath);
  if (document === undefined) {
    throw new Error(`No document found for route: ${route.name}`);
  }

  if (isListObject && document.metadata.type === "list") {
    return "list-object-list";
  }
  if (isListObject) {
    return "list-object";
  }
  if (document.metadata.type === "list") {
    return "list";
  }
  return "page";
}

function normalizeCollectionSource(source: string | undefined): string | null {
  if (source === undefined) {
    return null;
  }
  const normalized = source.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
  return normalized.length === 0 ? null : normalized;
}

export function createPrimaryNavigation(
  routeNames: string[],
  resolver: RouteResolver,
  currentRoute: RouteRecord,
  collections: Map<string, CollectionResult>
): NavigationLink[] {
  return routeNames.map((name) => {
    const route = resolver.get(name);
    const currentCollection = currentRoute.collection === undefined
      ? undefined
      : collections.get(currentRoute.collection);
    const isCollectionHead = currentCollection?.head.name === route.name;
    const current = route.path === "/"
      ? currentRoute.path === "/"
      : currentRoute.path === route.path || currentRoute.path.startsWith(`${route.path}/`) || isCollectionHead;
    return {
      label: route.title,
      path: resolver.href(name),
      current
    };
  });
}

export function createNavigationContext(
  route: RouteRecord,
  resolver: RouteResolver,
  collections: Map<string, CollectionResult>
): NavigationContext {
  const collection = route.collection === undefined ? undefined : collections.get(route.collection);
  const parentRoute = collection?.head.name !== route.name
    ? collection?.head
    : null;
  const currentItemIndex = collection?.items.findIndex((item) => item.routeName === route.name) ?? NO_INDEX;
  const previousItem = currentItemIndex > FIRST_INDEX ? collection?.items[currentItemIndex - 1] : undefined;
  const nextItem = currentItemIndex >= FIRST_INDEX ? collection?.items[currentItemIndex + 1] : undefined;
  const homeRoute = resolver.tryGet("index") ?? resolver.tryGet("home");

  const parent = parentRoute === null || parentRoute === undefined
    ? null
    : toNavigationLink(parentRoute, resolver, false);
  const previous = previousItem === undefined
    ? null
    : toCollectionLink(previousItem, resolver, false);
  const next = nextItem === undefined
    ? null
    : toCollectionLink(nextItem, resolver, false);

  const breadcrumbs: NavigationLink[] = [];
  if (homeRoute !== undefined && route.name !== homeRoute.name) {
    breadcrumbs.push(toNavigationLink(homeRoute, resolver, false));
  }
  for (const ancestor of createCollectionBreadcrumbs(route, resolver, collections)) {
    if (ancestor.path !== resolver.hrefForPath(route.path)
      && !breadcrumbs.some((breadcrumb) => breadcrumb.path === ancestor.path)) {
      breadcrumbs.push(ancestor);
    }
  }
  breadcrumbs.push(toNavigationLink(route, resolver, true));
  return {
    currentPath: route.path,
    parent,
    previous,
    next,
    breadcrumbs
  };
}

function createCollectionBreadcrumbs(
  route: RouteRecord,
  resolver: RouteResolver,
  collections: Map<string, CollectionResult>
): NavigationLink[] {
  const ancestors: NavigationLink[] = [];
  const visited = new Set<string>();
  let collectionName = route.collection;

  while (collectionName !== undefined && !visited.has(collectionName)) {
    visited.add(collectionName);
    const collection = collections.get(collectionName);
    if (collection === undefined) {
      break;
    }

    ancestors.unshift(toNavigationLink(collection.head, resolver, false));
    collectionName = collection.head.collection;
  }

  return ancestors;
}

function toCollectionLink(
  item: CollectionItem,
  resolver: RouteResolver,
  current: boolean
): NavigationLink {
  return {
    label: item.document.metadata.title,
    path: resolver.href(item.routeName),
    current
  };
}

function toNavigationLink(
  route: RouteRecord,
  resolver: RouteResolver,
  current: boolean
): NavigationLink {
  return {
    label: route.title,
    path: resolver.href(route.name),
    current
  };
}

function isRootContentRoute(sourcePath: string): boolean {
  return !sourcePath.includes("/");
}

export function compareIndexedThenAlphabetical(
  left: Pick<RouteRecord, "indexed" | "title" | "sourcePath">,
  right: Pick<RouteRecord, "indexed" | "title" | "sourcePath">
): number {
  const indexedComparison = compareIndexedValues(left.indexed, right.indexed);
  if (indexedComparison !== 0) {
    return indexedComparison;
  }

  const titleComparison = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  return titleComparison === 0
    ? left.sourcePath.localeCompare(right.sourcePath)
    : titleComparison;
}

function compareCollectionItems(left: CollectionItem, right: CollectionItem): number {
  return compareIndexedThenAlphabetical(
    {
      indexed: left.document.metadata.indexed,
      title: left.document.metadata.title,
      sourcePath: left.sourcePath
    },
    {
      indexed: right.document.metadata.indexed,
      title: right.document.metadata.title,
      sourcePath: right.sourcePath
    }
  );
}

function compareIndexedValues(left: number | undefined, right: number | undefined): number {
  if (left !== undefined && right === undefined) {
    return SORT_BEFORE;
  }
  if (left === undefined && right !== undefined) {
    return SORT_AFTER;
  }
  if (left === undefined || right === undefined) {
    return 0;
  }
  return left - right;
}

function normalizeSourcePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//u, "");
}

function normalizeBasePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0 || trimmed === "/") {
    return "";
  }
  return `/${trimmed.replace(/^\/+|\/+$/gu, "")}`;
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0 || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.replace(/^\/+|\/+$/gu, "")}`;
}
