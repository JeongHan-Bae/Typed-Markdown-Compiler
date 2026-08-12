import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "@vue/server-renderer";
import { h } from "vue";
import { siteConfig } from "../config.ts";
import { parseMarkdown } from "../src/parser/parser.ts";
import { lowerAstToIr } from "../src/ir/ast-to-ir.ts";
import { generateVueNodes } from "../src/codegen/vue-code-generator.ts";
import { assetOutputPath, normalizeAssetName } from "../src/resolver/asset-resolver.ts";
import {
  compareIndexedThenAlphabetical,
  discoverContent,
  RouteResolver
} from "../src/resolver/route-resolver.ts";
import type { CollectionResult, RootNode, RouteRecord } from "../src/ast/types.ts";
import { resolveCurrentGitEmail, resolveCurrentGithubUsername } from "./git-identity.ts";

function renderContent(
  ast: RootNode,
  context: {
    resolver: RouteResolver;
    collections: ReadonlyMap<string, CollectionResult>;
    assetHref: (name: string) => string;
  }
) {
  return generateVueNodes(lowerAstToIr(ast, {
    routeHref: (name) => context.resolver.href(name),
    relativeHref: (path) => context.resolver.hrefForRelative(path),
    assetHref: context.assetHref,
    collections: context.collections
  }));
}

const runtimeFixtureConfig = {
  ...siteConfig,
  contentDirectory: "dev/rt-test/fixtures/content",
  publicDirectory: "dev/rt-test/fixtures/public"
};

test("normalizes Markdown and Ruby syntax into the project AST", () => {
  const document = parseMarkdown(
    "---\ntitle: Configured page\ndescription: Configured summary\n---\n\n# Body heading\n\nHello <ruby>compiler<rt>typed</rt></ruby>.",
    "fixture/example.md",
    "example"
  );

  const paragraph = document.ast.children[0];
  assert.equal(paragraph?.type, "paragraph");
  if (paragraph?.type !== "paragraph") {
    return;
  }

  assert.deepEqual(paragraph.children, [
    { type: "text", value: "Hello " },
    { type: "ruby", base: "compiler", annotation: "typed" },
    { type: "text", value: "." }
  ]);
  assert.equal(document.metadata.title, "Configured page");
  assert.equal(document.metadata.description, "Configured summary");
});

test("derives a document title only from frontmatter, an H1, or the file name", () => {
  const fileNameFallback = parseMarkdown(
    "## Section heading\n\nBody.",
    "fixture/file-name-title.md",
    "file-name-title"
  );
  const firstLevelOneHeading = parseMarkdown(
    "## Intro section\n\n# Document title\n\nBody.",
    "fixture/fallback.md",
    "fallback"
  );

  assert.equal(fileNameFallback.metadata.title, "File Name Title");
  assert.equal(firstLevelOneHeading.metadata.title, "Document title");
});

test("normalizes native alignment wrappers for text and images", async () => {
  const document = parseMarkdown([
    '<div align="left">',
    "",
    "Left-aligned paragraph.",
    "",
    "</div>",
    "",
    '<div style="text-align: center;">',
    "",
    "## Center-aligned heading",
    "",
    "</div>",
    "",
    '<div align="right">',
    "",
    "![Right-aligned image](asset:icons/test-marker.svg)",
    "",
    "</div>"
  ].join("\n"), "fixture/example.md", "example");

  const alignmentNodes = document.ast.children.filter((node) => node.type === "content-alignment");
  assert.deepEqual(alignmentNodes.map((node) => node.alignment), ["left", "center", "right"]);
  assert.equal(alignmentNodes[0]?.children[0]?.type, "paragraph");
  assert.equal(alignmentNodes[1]?.children[0]?.type, "heading");
  assert.equal(alignmentNodes[2]?.children[0]?.type, "paragraph");

  const html = await renderToString(h("div", null, renderContent(document.ast, {
    resolver: new RouteResolver([], ""),
    collections: new Map(),
    assetHref: (name) => `/assets/${name}`
  })));
  assert.match(html, /class="content-alignment content-alignment--left"/u);
  assert.match(html, /class="content-alignment content-alignment--center"[^>]*><h2>/u);
  assert.match(html, /class="content-alignment content-alignment--right"/u);
  assert.match(html, /alt="Right-aligned image"/u);
});

test("normalizes native H1 through H5 blocks to Markdown heading nodes", () => {
  const markdownDocument = parseMarkdown([
    "# Document title",
    "",
    "# First level",
    "",
    "## Second level",
    "",
    "### Third level",
    "",
    "#### Fourth level",
    "",
    "##### Fifth level"
  ].join("\n"), "fixture/markdown.md", "markdown");
  const nativeDocument = parseMarkdown([
    "<h1>Document title</h1>",
    "",
    "<h1>First level</h1>",
    "",
    "<h2>Second level</h2>",
    "",
    "<h3>Third level</h3>",
    "",
    "<h4>Fourth level</h4>",
    "",
    "<h5>Fifth level</h5>"
  ].join("\n"), "fixture/native.md", "native");

  assert.equal(nativeDocument.metadata.title, markdownDocument.metadata.title);
  assert.deepEqual(nativeDocument.ast, markdownDocument.ast);
  assert.deepEqual(
    nativeDocument.ast.children.map((node) => node.type === "heading" ? node.depth : null),
    [1, 2, 3, 4, 5]
  );
});

test("normalizes image sizing declarations and renders percentage styles", async () => {
  const document = parseMarkdown(
    "![Default](asset:icons/test-marker.svg)\n\n![Capped](asset:icons/test-marker.svg){max-width=30%}\n\n![Forced](asset:icons/test-marker.svg){width=25%}",
    "fixture/example.md",
    "example"
  );
  const paragraphs = document.ast.children.filter((node) => node.type === "paragraph");
  const defaultImage = paragraphs[0]?.type === "paragraph" ? paragraphs[0].children[0] : null;
  const cappedImage = paragraphs[1]?.type === "paragraph" ? paragraphs[1].children[0] : null;
  const forcedImage = paragraphs[2]?.type === "paragraph" ? paragraphs[2].children[0] : null;

  assert.equal(defaultImage?.type, "image");
  assert.equal(cappedImage?.type, "image");
  assert.equal(forcedImage?.type, "image");
  if (defaultImage?.type !== "image" || cappedImage?.type !== "image" || forcedImage?.type !== "image") {
    return;
  }

  assert.equal(defaultImage.forcedWidthPercent, undefined);
  assert.equal(defaultImage.maxWidthPercent, undefined);
  assert.equal(cappedImage.maxWidthPercent, 30);
  assert.equal(cappedImage.forcedWidthPercent, undefined);
  assert.equal(forcedImage.forcedWidthPercent, 25);
  assert.equal(forcedImage.maxWidthPercent, undefined);

  const html = await renderToString(h("div", null, renderContent(document.ast, {
    resolver: new RouteResolver([], ""),
    collections: new Map(),
    assetHref: (name) => `/assets/${name}`
  })));
  const defaultImageHtml = html.match(/<img[^>]*alt="Default"[^>]*>/u)?.[0];
  assert.ok(defaultImageHtml !== undefined);
  assert.doesNotMatch(defaultImageHtml, /\bstyle=/u);
  assert.match(html, /alt="Capped"[^>]*style="[^"]*max-width:\s*30%/u);
  assert.match(html, /alt="Forced"[^>]*style="[^"]*width:\s*25%;[^"]*max-width:\s*100%/u);
  assert.match(html, /<p class="image-paragraph">/u);

  const lineBreakDocument = parseMarkdown(
    "![Capped](asset:icons/test-marker.svg){max-width=30%}\n![Forced](asset:icons/test-marker.svg){width=25%}",
    "fixture/example.md",
    "example"
  );
  const lineBreakHtml = await renderToString(h("div", null, renderContent(lineBreakDocument.ast, {
    resolver: new RouteResolver([], ""),
    collections: new Map(),
    assetHref: (name) => "/assets/" + name
  })));
  assert.match(lineBreakHtml, /alt="Capped"[^>]*style="[^"]*max-width:\s*30%/u);
  assert.match(lineBreakHtml, /alt="Forced"[^>]*style="[^"]*width:\s*25%;[^"]*max-width:\s*100%/u);
  assert.doesNotMatch(lineBreakHtml, /\{(?:max-width|width)=\d+(?:\.\d+)?%\}/u);

  const mixedDocument = parseMarkdown(
    "Text before ![Mixed](asset:icons/test-marker.svg)",
    "fixture/example.md",
    "example"
  );
  const mixedHtml = await renderToString(h("div", null, renderContent(mixedDocument.ast, {
    resolver: new RouteResolver([], ""),
    collections: new Map(),
    assetHref: (name) => `/assets/${name}`
  })));
  assert.match(mixedHtml, /<p class="image-paragraph image-paragraph--mixed">/u);
});

test("rejects image sizing percentages outside the CSS percentage range", () => {
  assert.throws(
    () => parseMarkdown("![Too wide](asset:icons/test-marker.svg){width=101%}", "fixture/example.md", "example"),
    /Image width must be between 0% and 100%/u
  );
  assert.throws(
    () => parseMarkdown("![Too wide](asset:icons/test-marker.svg){max-width=101%}", "fixture/example.md", "example"),
    /Image max-width must be between 0% and 100%/u
  );
});

test("converts every documented Markdown extension into static HTML", async () => {
  const tick = String.fromCharCode(96);
  const source = [
    "---",
    "title: Complete syntax example",
    "type: page",
    "date: 2026-08-10",
    "indexed: 0",
    "tags:",
    "  - syntax",
    "draft: false",
    "---",
    "",
    "# Source heading",
    "",
    "Paragraph with **strong**, *emphasis*, ~~deleted~~, and "
      + tick + "inline code" + tick + ".",
    "",
    "- Unordered item",
    "- [x] Checked task",
    "",
    "1. Ordered item",
    "",
    "> Block quote.",
    "",
    "~~~ts",
    "const value: string = \"typed\";",
    "~~~",
    "",
    "| Name | Meaning |",
    "| --- | --- |",
    "| AST | Normalized tree |",
    "",
    "---",
    "",
    "[Home](route:index) [Marker](asset:icons/test-marker.svg)",
    "",
    "![Capped](asset:icons/test-marker.svg){max-width=30%}",
    "![Forced](asset:icons/test-marker.svg){width=25%}",
    "",
    "<ruby>typed<rt>annotation</rt></ruby>"
  ].join("\n");
  const document = parseMarkdown(source, "fixture/example.md", "example");
  assert.equal(document.metadata.title, "Complete syntax example");
  assert.equal(document.metadata.type, "page");
  assert.equal(document.metadata.date, "2026-08-10");
  assert.equal(document.metadata.indexed, 0);
  assert.deepEqual(document.metadata.tags, ["syntax"]);
  assert.equal(document.metadata.draft, false);

  const resolver = new RouteResolver([{
    name: "index",
    path: "/",
    sourcePath: "fixture/index.md",
    template: "page",
    title: "Home",
    aliases: ["", "home"]
  }], "");
  const html = await renderToString(h("div", null, renderContent(document.ast, {
    resolver,
    collections: new Map(),
    assetHref: (name) => "/assets/" + name
  })));

  assert.equal(document.metadata.description, "Paragraph with strong, emphasis, deleted, and inline code.");
  assert.match(html, /<strong>strong<\/strong>/u);
  assert.match(html, /<em>emphasis<\/em>/u);
  assert.match(html, /<del>deleted<\/del>/u);
  assert.match(html, /<code>inline code<\/code>/u);
  assert.match(html, /<ul>/u);
  assert.match(html, /<ol>/u);
  assert.match(html, /<input class="task-checkbox"/u);
  assert.match(html, /<blockquote>/u);
  assert.match(html, /<pre><code class="language-ts">/u);
  assert.match(html, /<table>/u);
  assert.match(html, /<hr>/u);
  assert.match(html, /href="\/"/u);
  assert.match(html, /href="\/assets\/icons\/test-marker\.svg"/u);
  assert.match(html, /alt="Capped"[^>]*style="[^"]*max-width:\s*30%/u);
  assert.match(html, /alt="Forced"[^>]*style="[^"]*width:\s*25%;[^"]*max-width:\s*100%/u);
  assert.match(html, /<ruby>typed<rt>annotation<\/rt><\/ruby>/u);
  assert.doesNotMatch(html, /\{(?:max-width|width)=\d+(?:\.\d+)?%\}/u);
});

test("turns list frontmatter into a collection AST node", () => {
  const document = parseMarkdown(
    "---\ntitle: Fixture notes\ntype: list\nindexed: 2\nsource: fixture-entries/\n---\n\n# Fixture notes",
    "fixture/notes.md",
    "notes"
  );
  const lastNode = document.ast.children[document.ast.children.length - 1];

  assert.equal(document.metadata.type, "list");
  assert.equal(document.metadata.indexed, 2);
  assert.equal(document.metadata.listSource, "fixture-entries/");
  assert.deepEqual(lastNode, { type: "collection", name: "fixture-entries" });
});

test("sorts indexed content before unindexed content", async () => {
  const records: RouteRecord[] = [
    { name: "unindexed-beta", path: "/beta", sourcePath: "beta.md", template: "page", title: "Beta" },
    { name: "indexed-three", path: "/three", sourcePath: "three.md", template: "page", title: "Three", indexed: 3 },
    { name: "indexed-zero", path: "/zero", sourcePath: "zero.md", template: "page", title: "Zero", indexed: 0 },
    { name: "unindexed-alpha", path: "/alpha", sourcePath: "alpha.md", template: "page", title: "Alpha" },
    { name: "indexed-one", path: "/one", sourcePath: "one.md", template: "page", title: "One", indexed: 1 }
  ];

  assert.deepEqual(
    records.sort(compareIndexedThenAlphabetical).map((record) => record.name),
    ["indexed-zero", "indexed-one", "indexed-three", "unindexed-alpha", "unindexed-beta"]
  );

  const manifest = await discoverContent(process.cwd(), runtimeFixtureConfig);
  assert.deepEqual(manifest.navigation, ["index", "entries", "about", "notes", "syntax"]);
  assert.deepEqual(
    manifest.collections.get("entries")?.items.map((item) => item.routeName),
    ["entries:branch"]
  );
  assert.ok(manifest.routes.some((route) => route.name === "entries:branch:leaf"));
});

test("resolves route links only at the Vue SSR boundary", async () => {
  const githubUsername = resolveCurrentGithubUsername();
  const gitEmail = resolveCurrentGitEmail();
  const links = [
    "[Notes](route:fixture:notes)",
    githubUsername === null ? null : `[GitHub](https://github.com/${githubUsername})`,
    gitEmail === null ? null : `[Email](mailto:${gitEmail})`,
    "[RSS](/feed.xml)"
  ].filter((link): link is string => link !== null);
  const document = parseMarkdown(
    links.join(" and "),
    "fixture/example.md",
    "example"
  );
  const records: RouteRecord[] = [
    {
      name: "index",
      path: "/",
      sourcePath: "fixture/index.md",
      template: "page",
      title: "Home",
      aliases: ["", "home"]
    },
    {
      name: "fixture:notes",
      path: "/fixture/notes",
      sourcePath: "fixture/notes.md",
      template: "list",
      title: "Fixture notes"
    }
  ];
  const resolver = new RouteResolver(records, "");
  assert.equal(resolver.href(""), "/");
  assert.equal(resolver.href("index"), "/");
  assert.equal(resolver.hrefForRelative("/feed.xml"), "/feed.xml");
  const basePathResolver = new RouteResolver(records, "/fixture-site/");
  assert.equal(basePathResolver.href("index"), "/fixture-site/");
  assert.equal(basePathResolver.href("fixture:notes"), "/fixture-site/fixture/notes/");
  assert.equal(basePathResolver.hrefForRelative("/feed.xml"), "/fixture-site/feed.xml");
  const link = document.ast.children[0];
  assert.equal(link?.type, "paragraph");
  if (link?.type !== "paragraph") {
    return;
  }

  assert.equal(link.children[0]?.type, "link");
  if (link.children[0]?.type !== "link") {
    return;
  }
  assert.deepEqual(link.children[0].target, { type: "route", name: "fixture:notes" });
  const linkTargets = link.children
    .filter((child) => child.type === "link")
    .map((child) => child.target);
  assert.deepEqual(linkTargets[0], { type: "route", name: "fixture:notes" });
  if (githubUsername !== null) {
    assert.deepEqual(linkTargets[1], {
      type: "external",
      href: `https://github.com/${githubUsername}`
    });
  }
  if (gitEmail !== null) {
    const emailTarget = linkTargets.find(
      (target) => target.type === "external" && target.href === `mailto:${gitEmail}`
    );
    assert.deepEqual(emailTarget, { type: "external", href: `mailto:${gitEmail}` });
  }
  assert.deepEqual(linkTargets.at(-1), { type: "relative", href: "/feed.xml" });

  const html = await renderToString(h("div", null, renderContent(document.ast, {
    resolver,
    collections: new Map(),
    assetHref: (name) => `/assets/${name}`
  })));
  assert.match(html, /href="\/fixture\/notes\/"/u);
  if (githubUsername !== null) {
    assert.match(html, new RegExp(`href="https://github\\.com/${githubUsername}"`, "u"));
  }
  if (gitEmail !== null) {
    assert.match(html, new RegExp(`href="${escapeRegExp(`mailto:${gitEmail}`)}"`, "u"));
  }
  assert.match(html, /href="\/feed\.xml"/u);
});

test("escapes HTML-like input that is not a supported AST extension", async () => {
  const document = parseMarkdown("<script>alert('x')</script>", "fixture/example.md", "example");
  const resolver = new RouteResolver([], "");
  const html = await renderToString(h("div", null, renderContent(document.ast, {
    resolver,
    collections: new Map(),
    assetHref: (name) => `/assets/${name}`
  })));

  assert.doesNotMatch(html, /<script>/u);
  assert.match(html, /&lt;script&gt;/u);
});

test("supports colon-separated route names and asset targets", async () => {
  const document = parseMarkdown(
    "[Fixture leaf](route:fixture:entries:branch:leaf) [marker](asset:icons/test-marker.svg) ![marker](asset:icons/test-marker.svg)",
    "fixture/example.md",
    "example"
  );
  const paragraph = document.ast.children[0];
  assert.equal(paragraph?.type, "paragraph");
  if (paragraph?.type !== "paragraph") {
    return;
  }

  const routeLink = paragraph.children[0];
  const assetLink = paragraph.children[2];
  const image = paragraph.children[4];
  assert.deepEqual(routeLink?.type === "link" ? routeLink.target : null, {
    type: "route",
    name: "fixture:entries:branch:leaf"
  });
  assert.deepEqual(assetLink?.type === "link" ? assetLink.target : null, {
    type: "asset",
    name: "icons/test-marker.svg"
  });
  assert.deepEqual(image?.type === "image" ? image.src : null, {
    type: "asset",
    name: "icons/test-marker.svg"
  });
  assert.equal(normalizeAssetName("icons\\test-marker.svg"), "icons/test-marker.svg");
  assert.equal(assetOutputPath("icons/test-marker.svg"), "assets/icons/test-marker.svg");

  const resolver = new RouteResolver([
    {
      name: "fixture:entries:branch:leaf",
      path: "/fixture/entries/branch/leaf",
      sourcePath: "fixture/entries/branch/leaf.md",
      template: "list-object",
      title: "Fixture leaf"
    }
  ], "");
  assert.equal(resolver.href("fixture:entries:branch:leaf"), "/fixture/entries/branch/leaf/");

  const html = await renderToString(h("div", null, renderContent(document.ast, {
    resolver,
    collections: new Map(),
    assetHref: (name) => `../../assets/${name}`
  })));
  assert.match(html, /href="\/fixture\/entries\/branch\/leaf\/"/u);
  assert.match(html, /href="\.\.\/\.\.\/assets\/icons\/test-marker\.svg"/u);
  assert.match(html, /src="\.\.\/\.\.\/assets\/icons\/test-marker\.svg"/u);
});

test("rejects unsafe and non-image asset targets", () => {
  const document = parseMarkdown("![bad](asset:../secret.txt)", "fixture/example.md", "example");
  const resolver = new RouteResolver([], "");
  assert.throws(
    () => renderContent(document.ast, {
      resolver,
      collections: new Map(),
      assetHref: (name) => `/assets/${name}`
    }),
    /Unsafe asset path rejected/u
  );
  assert.throws(
    () => renderContent(parseMarkdown("![bad](asset:icons/secret.txt)", "fixture/example.md", "example").ast, {
      resolver,
      collections: new Map(),
      assetHref: (name) => "/assets/" + name
    }),
    /Unsupported asset type/u
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
