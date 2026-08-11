import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { renderToString } from "@vue/server-renderer";
import { h, type VNode } from "vue";
import { siteConfig } from "../config.ts";
import type { CollectionResult } from "../src/ast/types.ts";
import { lowerAstToIr } from "../src/ir/ast-to-ir.ts";
import type { IrNode } from "../src/ir/types.ts";
import { generateVueNodes } from "../src/codegen/vue-code-generator.ts";
import { parseMarkdown } from "../src/parser/parser.ts";
import { scanMarkdown } from "../src/compiler/scanner.ts";
import { TokenKind, type LexerToken } from "../src/tokens/types.ts";
import {
  compareIndexedThenAlphabetical,
  discoverContent,
  RouteResolver
} from "../src/resolver/route-resolver.ts";
import {
  canonicalIndexedRouteLayout,
  conflictingExternalAndDirectoryIndexLayout,
  externallyNamedCollectionLayout,
  invalidDirectoryIndexFeatures,
  indexedPipelineFeatures,
  sameNamedCollectionLayout
} from "./features/indexed-routes.ts";

function emptyCollection(name: string): CollectionResult {
  return {
    name,
    sourcePath: name,
    head: {
      name,
      path: `/${name}`,
      sourcePath: `${name}/index.md`,
      template: "list",
      title: name
    },
    items: []
  };
}

function pipelineContext() {
  return {
    routeHref: (name: string) => name === "index" ? "/" : `/${name}/`,
    relativeHref: (path: string) => path,
    assetHref: (name: string) => `/assets/${name}`,
    collections: new Map<string, CollectionResult>([
      ["blogs", emptyCollection("blogs")],
      ["blogs/series", emptyCollection("blogs/series")],
      ["blogs/implicit", emptyCollection("blogs/implicit")]
    ])
  };
}

for (const feature of indexedPipelineFeatures) {
  test(`indexed route feature ${feature.id} validates every compiler stage`, async () => {
    const tokens = scanMarkdown(feature.source);
    const document = parseMarkdown(feature.source, feature.sourcePath, feature.slug);
    const ir = lowerAstToIr(document.ast, pipelineContext());
    const vnodes = generateVueNodes(ir);
    const html = await renderToString(h("div", null, vnodes));

    assert.deepEqual(tokens.map((token) => token.kind), feature.expected.tokenKinds);
    assert.deepEqual(
      syntaxTokens(tokens).map((token) => token.node.type),
      feature.expected.syntaxNodeTypes
    );
    assert.deepEqual(document.ast.children.map((node) => node.type), feature.expected.astChildTypes);
    assert.deepEqual(flattenIrTags(ir), feature.expected.irTags);
    assert.deepEqual(flattenVNodeTags(vnodes), feature.expected.vnodeTags);
    assert.equal(html, feature.expected.html);
    assert.equal(document.sourcePath, feature.sourcePath);
    assert.equal(document.slug, feature.slug);
    assert.equal(document.metadata.indexed, feature.indexed);
    assert.equal(
      feature.sourcePath === "index.md" || feature.sourcePath.endsWith("/index.md"),
      feature.routeKind === "index"
    );
  });
}

test("directory index routes and indexed entries resolve at the outer and inner levels", async () => {
  const rootDirectory = await createFixtureRoot(canonicalIndexedRouteLayout);
  try {
    const manifest = await discoverContent(rootDirectory, {
      ...siteConfig,
      contentDirectory: "content"
    });

    assert.deepEqual(manifest.navigation, ["index", "blogs", "about"]);
    assert.deepEqual(
      manifest.collections.get("blogs")?.items.map((item) => item.routeName),
      ["blogs:entry"]
    );
    assert.deepEqual(
      manifest.collections.get("blogs/series")?.items.map((item) => item.routeName),
      ["blogs:series:first", "blogs:series:second"]
    );

    const blogs = manifest.routes.find((route) => route.name === "blogs");
    const series = manifest.routes.find((route) => route.name === "blogs:series");
    assert.equal(blogs?.sourcePath, "blogs/index.md");
    assert.equal(blogs?.indexed, 1);
    assert.equal(series?.sourcePath, "blogs/series/index.md");
    assert.equal(series?.indexed, 2);
    assert.equal(blogs?.collection, undefined);
    assert.equal(series?.collection, undefined);

    const resolver = new RouteResolver(manifest.routes, "");
    assert.equal(resolver.get("blogs").sourcePath, "blogs/index.md");
    assert.equal(resolver.href("blogs"), "/blogs/");
    assert.equal(resolver.get("blogs:series").sourcePath, "blogs/series/index.md");
    assert.equal(resolver.href("blogs:series"), "/blogs/series/");
    assert.equal(resolver.tryGet("home")?.name, "index");
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test("an external list head conflicts with the matching directory index", async () => {
  const rootDirectory = await createFixtureRoot(conflictingExternalAndDirectoryIndexLayout);
  try {
    await assert.rejects(
      discoverContent(rootDirectory, { ...siteConfig, contentDirectory: "content" }),
      /List page blog\.md conflicts with directory index blogs\/index\.md/u
    );
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test("an external list head can give a collection a different user-facing root name", async () => {
  const rootDirectory = await createFixtureRoot(externallyNamedCollectionLayout);
  try {
    const manifest = await discoverContent(rootDirectory, {
      ...siteConfig,
      contentDirectory: "content"
    });
    const collection = manifest.collections.get("blogs");
    assert.deepEqual(manifest.navigation, ["index", "blog"]);
    assert.equal(collection?.head.name, "blog");
    assert.deepEqual(collection?.items.map((item) => item.routeName), ["blogs:entry"]);

    const resolver = new RouteResolver(manifest.routes, "");
    assert.equal(resolver.href("blog"), "/blog/");
    assert.equal(resolver.get("blog").sourcePath, "blog.md");
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test("an external list head can keep the source directory user-facing root name", async () => {
  const rootDirectory = await createFixtureRoot(sameNamedCollectionLayout);
  try {
    const manifest = await discoverContent(rootDirectory, {
      ...siteConfig,
      contentDirectory: "content"
    });
    const collection = manifest.collections.get("blogs");
    assert.deepEqual(manifest.navigation, ["index", "blogs"]);
    assert.equal(collection?.head.name, "blogs");
    assert.deepEqual(collection?.items.map((item) => item.routeName), ["blogs:entry"]);

    const resolver = new RouteResolver(manifest.routes, "");
    assert.equal(resolver.href("blogs"), "/blogs/");
    assert.equal(resolver.get("blogs").sourcePath, "blogs.md");
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

for (const feature of invalidDirectoryIndexFeatures) {
  test(`invalid directory index feature ${feature.id} is rejected`, () => {
    assert.throws(
      () => parseMarkdown(feature.source, feature.sourcePath, "index"),
      feature.error
    );
  });
}

test("indexed comparison keeps zero and nested collection order deterministic", () => {
  const values = [
    { title: "Unindexed", sourcePath: "second.md", indexed: undefined },
    { title: "Nested first", sourcePath: "first.md", indexed: 0 },
    { title: "Indexed later", sourcePath: "later.md", indexed: 2 },
    { title: "Indexed first", sourcePath: "first-indexed.md", indexed: 0 }
  ];
  assert.deepEqual(
    values.sort(compareIndexedThenAlphabetical).map((value) => value.sourcePath),
    ["first-indexed.md", "first.md", "later.md", "second.md"]
  );
});

async function createFixtureRoot(
  files: readonly { path: string; source: string }[]
): Promise<string> {
  const rootDirectory = await mkdtemp(join(tmpdir(), "typed-markdown-indexed-"));
  for (const file of files) {
    const filePath = join(rootDirectory, "content", file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.source, "utf8");
  }
  return rootDirectory;
}

function syntaxTokens(tokens: readonly LexerToken[]) {
  return tokens.filter((token) => token.kind === TokenKind.syntaxNode);
}

function flattenIrTags(nodes: readonly IrNode[]): string[] {
  return nodes.flatMap((node) => node.kind === "text"
    ? []
    : [node.tag, ...flattenIrTags(node.children)]);
}

function flattenVNodeTags(nodes: readonly VNode[]): string[] {
  return nodes.flatMap((node) => {
    const children = Array.isArray(node.children)
      ? node.children.filter((child): child is VNode => typeof child !== "string")
      : [];
    return [node.type as string, ...flattenVNodeTags(children)];
  });
}
