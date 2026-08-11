import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToString } from "@vue/server-renderer";
import { h, type VNode } from "vue";
import { parseMarkdown } from "../src/parser/parser.ts";
import { scanMarkdown } from "../src/compiler/scanner.ts";
import { lowerAstToIr } from "../src/ir/ast-to-ir.ts";
import { generateVueNodes } from "../src/codegen/vue-code-generator.ts";
import type { CollectionResult } from "../src/ast/types.ts";
import type { IrNode } from "../src/ir/types.ts";
import { TokenKind, type LexerToken, type ScannedHtmlTreeNode } from "../src/tokens/types.ts";
import {
  pipelineEquivalenceFeatures,
  pipelineFeatures,
  requiredCoverage
} from "./features/pipeline-features.ts";
import {
  invalidFeatures,
  requiredInvalidCoverage
} from "./features/invalid-syntax.ts";
import {
  htmlDomSource,
  inlineHtmlBoundarySource,
  inlineHtmlEquivalentSource,
  inlineMarkdownSource
} from "./features/syntax-cases.ts";

const emptyCollection: CollectionResult = {
  name: "blogs",
  sourcePath: "blogs",
  head: {
    name: "index",
    path: "/",
    sourcePath: "index.md",
    template: "list",
    title: "Collection"
  },
  items: []
};

const pipelineContext = {
  routeHref: (name: string) => name === "index" ? "/" : `/${name}/`,
  relativeHref: (path: string) => path,
  assetHref: (name: string) => `/assets/${name}`,
  collections: new Map<string, CollectionResult>([["blogs", emptyCollection]])
};

for (const feature of pipelineFeatures) {
  test(`feature ${feature.id} validates every compiler stage`, async () => {
    const tokens = scanMarkdown(feature.source);
    const document = parseMarkdown(feature.source, feature.sourcePath, feature.slug);
    const ir = lowerAstToIr(document.ast, pipelineContext);
    const vnodes = generateVueNodes(ir);
    const html = await renderToString(h("div", null, vnodes));

    assert.deepEqual(tokens.map((token) => token.kind), feature.expected.tokenKinds);
    assert.deepEqual(
      syntaxTokens(tokens).map((token) => token.node.type),
      feature.expected.syntaxNodeTypes
    );
    assert.deepEqual(
      document.ast.children.map((node) => node.type),
      feature.expected.astChildTypes
    );
    assert.deepEqual(flattenIrTags(ir), feature.expected.irTags);
    assert.deepEqual(flattenVNodeTags(vnodes), feature.expected.vnodeTags);
    assert.equal(html, feature.expected.html);

    if (feature.expected.ast !== undefined) {
      assert.deepEqual(document.ast, feature.expected.ast);
    }
    if (feature.expected.ir !== undefined) {
      assert.deepEqual(ir, feature.expected.ir);
      assert.deepEqual(projectVNodes(vnodes), projectIr(feature.expected.ir));
    }
    if (feature.expected.htmlTreeTags !== undefined) {
      assert.deepEqual(flattenHtmlTokenTags(tokens), feature.expected.htmlTreeTags);
    }
  });
}

test("features collectively cover every documented syntax object", () => {
  const covered = new Set([
    ...pipelineFeatures.flatMap((feature) => feature.coverage),
    ...pipelineEquivalenceFeatures.flatMap((feature) => feature.coverage)
  ]);
  for (const syntax of requiredCoverage) {
    assert.ok(covered.has(syntax), `missing feature coverage: ${syntax}`);
  }
  for (const feature of pipelineFeatures) {
    assert.equal(feature.expected.tokenKinds.at(-1), TokenKind.eof, `${feature.id} must test EOF`);
    assert.ok(feature.expected.syntaxNodeTypes.length > 0, `${feature.id} must test syntax tokens`);
    assert.ok(feature.expected.astChildTypes.length > 0, `${feature.id} must test AST`);
    assert.ok(feature.expected.irTags.length > 0, `${feature.id} must test IR`);
    assert.ok(feature.expected.vnodeTags.length > 0, `${feature.id} must test VNodes`);
    assert.ok(feature.expected.html.length > 0, `${feature.id} must test SSR HTML`);
  }
  assert.deepEqual(
    [...covered].sort(),
    [...new Set(requiredCoverage)].sort(),
    "every feature coverage label must be part of the documented coverage inventory"
  );
});

test("docs/syntax.md is itself exercised through every compiler stage", async () => {
  const source = await readFile(new URL("../docs/syntax.md", import.meta.url), "utf8");
  const compiled = await compileFeatureSource(source, "docs/syntax.md", "syntax");
  const syntax = syntaxTokens(compiled.tokens);

  assert.ok(syntax.length > 0);
  assert.ok(syntax.some((token) => token.node.type === "heading"));
  assert.ok(syntax.some((token) => token.node.type === "list"));
  assert.ok(syntax.some((token) => token.node.type === "code-block"));
  assert.ok(compiled.document.ast.children.length > 0);
  assert.ok(compiled.ir.length > 0);
  assert.equal(compiled.vnodes.length, compiled.ir.length);
  assert.equal(compiled.document.metadata.title, "Markdown Syntax");
  assert.match(compiled.html, /<h2>Frontmatter<\/h2>/u);
  assert.match(compiled.html, /&lt;table&gt;/u);
  assert.match(compiled.html, /<code class="language-markdown">/u);
  assert.doesNotMatch(compiled.html, /<script\b/u);
  assert.match(compiled.html, /\{max-width=30%\}/u);
});

test("the disposable dynamic syntax fixture also passes every compiler stage", async () => {
  const source = await readFile(
    new URL("../dev/rt-test/fixtures/content/syntax.md", import.meta.url),
    "utf8"
  );
  const compiled = await compileFeatureSource(source, "syntax.md", "syntax");
  const syntax = syntaxTokens(compiled.tokens);

  assert.ok(syntax.some((token) => token.node.type === "heading"));
  assert.ok(syntax.some((token) => token.node.type === "list"));
  assert.ok(syntax.some((token) => token.node.type === "code-block"));
  assert.ok(syntax.some((token) => token.node.type === "html-block"));
  assert.ok(syntax.some((token) => token.node.type === "html-block" && token.node.tree !== null));
  assert.ok(compiled.document.ast.children.length > 0);
  assert.ok(compiled.ir.length > 0);
  assert.equal(compiled.vnodes.length, compiled.ir.length);
  assert.ok(flattenIrTags(compiled.ir).includes("div"));
  assert.ok(flattenIrTags(compiled.ir).includes("ruby"));
  assert.ok(flattenVNodeTags(compiled.vnodes).includes("table"));
  assert.match(compiled.html, /<h1>HTML H1<\/h1>/u);
  assert.match(compiled.html, /<h5>HTML H5<\/h5>/u);
  assert.match(compiled.html, /<code>tt<\/code>/u);
  assert.match(compiled.html, /<ruby>typed<rt>annotation<\/rt><\/ruby>/u);
  assert.match(compiled.html, /alt="external-max"[^>]*style="[^"]*max-width:\s*30%/u);
  assert.match(compiled.html, /alt="external-force"[^>]*style="[^"]*width:\s*25%;[^"]*max-width:\s*100%/u);
  assert.match(compiled.html, /<code class="language-markdown">```ts/u);
  assert.doesNotMatch(compiled.html, /<script\b/u);
  assert.doesNotMatch(compiled.html, /<!--/u);
});

for (const feature of pipelineEquivalenceFeatures) {
  test(`feature ${feature.id} preserves all stages across Markdown and HTML`, async () => {
    const [markdown, html] = await Promise.all([
      compileFeatureSource(feature.markdownSource, "features/equivalence-markdown.md", feature.id),
      compileFeatureSource(feature.htmlSource, "features/equivalence-html.md", feature.id)
    ]);
    assert.ok(markdown.tokens.some((token) => token.kind === TokenKind.syntaxNode));
    assert.ok(html.tokens.some((token) => token.kind === TokenKind.syntaxNode));
    assert.deepEqual(html.document.ast, markdown.document.ast);
    assert.deepEqual(html.ir, markdown.ir);
    assert.deepEqual(projectVNodes(html.vnodes), projectVNodes(markdown.vnodes));
    assert.equal(html.html, markdown.html);
  });
}

test("negative features cover every documented rejection and escaping rule", () => {
  const covered = new Set(invalidFeatures.flatMap((feature) => feature.coverage));
  for (const syntax of requiredInvalidCoverage) {
    assert.ok(covered.has(syntax), `missing negative feature coverage: ${syntax}`);
  }
});

for (const feature of invalidFeatures) {
  test(`negative feature ${feature.id} enforces its boundary`, async () => {
    const tokens = scanMarkdown(feature.source);
    assert.deepEqual(tokens.map((token) => token.kind), feature.expected.tokenKinds);
    assert.deepEqual(
      syntaxTokens(tokens).map((token) => token.node.type),
      feature.expected.syntaxNodeTypes
    );
    if (feature.expected.htmlTreeTags !== undefined) {
      assert.deepEqual(flattenHtmlTokenTags(tokens), feature.expected.htmlTreeTags);
    }

    if (feature.stage === "ast-error") {
      assert.ok(feature.expected.error !== undefined);
      assert.throws(
        () => parseMarkdown(feature.source, feature.sourcePath, feature.slug),
        feature.expected.error
      );
      return;
    }

    const document = parseMarkdown(feature.source, feature.sourcePath, feature.slug);
    assert.deepEqual(
      document.ast.children.map((node) => node.type),
      feature.expected.astChildTypes
    );

    if (feature.stage === "ir-error") {
      assert.ok(feature.expected.error !== undefined);
      assert.throws(
        () => lowerAstToIr(document.ast, pipelineContext),
        feature.expected.error
      );
      return;
    }

    const compiled = await compileFeatureSource(feature.source, feature.sourcePath, feature.slug);
    assert.deepEqual(flattenIrTags(compiled.ir), feature.expected.irTags);
    assert.deepEqual(flattenVNodeTags(compiled.vnodes), feature.expected.vnodeTags);
    assert.equal(compiled.html, feature.expected.html);
  });
}

test("Remark treats four-character fences as an outer shell around inner fences", () => {
  const tildeSource = [
    "~~~~markdown",
    "```ts",
    "const typed: string = \"inner\";",
    "```",
    "~~~",
    "plain inner fence",
    "~~~",
    "~~~~"
  ].join("\n");
  const backtickSource = [
    "````markdown",
    "~~~ts",
    "const typed: string = \"inner\";",
    "~~~",
    "```",
    "plain inner fence",
    "```",
    "````"
  ].join("\n");

  const variants = [
    [tildeSource, [
      "```ts",
      "const typed: string = \"inner\";",
      "```",
      "~~~",
      "plain inner fence",
      "~~~"
    ].join("\n")],
    [backtickSource, [
      "~~~ts",
      "const typed: string = \"inner\";",
      "~~~",
      "```",
      "plain inner fence",
      "```"
    ].join("\n")]
  ] as const;

  for (const [source, expectedValue] of variants) {
    const syntax = syntaxTokens(scanMarkdown(source));
    assert.equal(syntax.length, 1);
    assert.deepEqual(syntax[0]?.node, {
      type: "code-block",
      language: "markdown",
      value: expectedValue
    });
  }
});

test("Markdown and DOM HTML forms preserve the same inline semantics at every stage", async () => {
  const markdown = parseMarkdown(inlineMarkdownSource, "features/inline.md", "inline");
  const html = parseMarkdown(inlineHtmlEquivalentSource, "features/inline-html.md", "inline-html");
  assert.deepEqual(html.ast, markdown.ast);

  const markdownIr = lowerAstToIr(markdown.ast, pipelineContext);
  const htmlIr = lowerAstToIr(html.ast, pipelineContext);
  assert.deepEqual(htmlIr, markdownIr);

  const markdownVNodes = generateVueNodes(markdownIr);
  const htmlVNodes = generateVueNodes(htmlIr);
  assert.deepEqual(projectVNodes(htmlVNodes), projectVNodes(markdownVNodes));
  assert.equal(
    await renderToString(h("div", null, htmlVNodes)),
    await renderToString(h("div", null, markdownVNodes))
  );
});

test("DOM HTML inside Markdown headings and table cells is normalized through the same whitelist", async () => {
  const document = parseMarkdown(
    inlineHtmlBoundarySource,
    "features/inline-html-boundary.md",
    "inline-html-boundary"
  );
  const ir = lowerAstToIr(document.ast, pipelineContext);
  const vnodes = generateVueNodes(ir);
  const html = await renderToString(h("div", null, vnodes));

  assert.equal(html, pipelineFeatures.find(
    (feature) => feature.id === "inline-html-dom-boundary"
  )?.expected.html);
  assert.deepEqual(document.ast.children.map((node) => node.type), ["heading", "table"]);
  assert.equal(
    document.ast.children[0]?.type === "heading"
      ? document.ast.children[0].children[1]?.type
      : null,
    "strong"
  );
  assert.equal(
    document.ast.children[1]?.type === "table"
      ? document.ast.children[1].rows[1]?.cells[0]?.children[0]?.type
      : null,
    "strong"
  );
});

interface CompiledFeatureSource {
  tokens: LexerToken[];
  document: ReturnType<typeof parseMarkdown>;
  ir: IrNode[];
  vnodes: VNode[];
  html: string;
}

async function compileFeatureSource(
  source: string,
  sourcePath: string,
  slug: string
): Promise<CompiledFeatureSource> {
  const tokens = scanMarkdown(source);
  const document = parseMarkdown(source, sourcePath, slug);
  const ir = lowerAstToIr(document.ast, pipelineContext);
  const vnodes = generateVueNodes(ir);
  const html = await renderToString(h("div", null, vnodes));
  return { tokens, document, ir, vnodes, html };
}

test("the nested HTML token is a tree before AST normalization", () => {
  const tokens = scanMarkdown(htmlDomSource);
  const htmlTokens = syntaxTokens(tokens).filter((token) => token.node.type === "html-block");
  assert.equal(htmlTokens.length, 1);
  const htmlToken = htmlTokens[0];
  assert.ok(htmlToken?.node.type === "html-block");
  if (htmlToken?.node.type !== "html-block") {
    return;
  }
  assert.ok(htmlToken.node.tree !== null);
  assert.ok(htmlToken.node.tree?.some((node) => node.type === "html-element" && node.name === "div"));
  assert.deepEqual(flattenHtmlTokenTags(tokens), pipelineFeatures.find(
    (feature) => feature.id === "html-dom-nesting"
  )?.expected.htmlTreeTags);
});

test("HTML comments are discarded at the token boundary", () => {
  const tokens = scanMarkdown("<!-- comment -->\n\nVisible<!-- inline --> text");
  assert.deepEqual(tokens.map((token) => token.kind), [TokenKind.syntaxNode, TokenKind.eof]);
  const paragraph = syntaxTokens(tokens)[0]?.node;
  assert.equal(paragraph?.type, "paragraph");
  if (paragraph?.type === "paragraph") {
    assert.equal(
      paragraph.children
        .filter((node): node is Extract<typeof node, { type: "text" }> => node.type === "text")
        .map((node) => node.value)
        .join(""),
      "Visible text"
    );
  }
});

function syntaxTokens(tokens: readonly LexerToken[]) {
  return tokens.filter((token) => token.kind === TokenKind.syntaxNode);
}

function flattenIrTags(nodes: readonly IrNode[]): string[] {
  return nodes.flatMap((node) => node.kind === "text"
    ? []
    : [node.tag, ...flattenIrTags(node.children)]);
}

interface VNodeShape {
  tag: string;
  props?: Record<string, unknown>;
  children: Array<VNodeShape | string>;
}

function projectVNodes(nodes: readonly VNode[]): VNodeShape[] {
  return nodes.map((node) => projectVNode(node));
}

function projectVNode(node: VNode): VNodeShape {
  assert.equal(typeof node.type, "string");
  const children = Array.isArray(node.children)
    ? node.children.map((child) => typeof child === "string"
      ? child
      : projectVNode(child as VNode))
    : [];
  return {
    tag: node.type as string,
    ...(node.props === null || node.props === undefined ? {} : { props: { ...node.props } }),
    children
  };
}

function projectIr(nodes: readonly IrNode[]): VNodeShape[] {
  return nodes.map((node) => {
    assert.equal(node.kind, "element");
    if (node.kind !== "element") {
      throw new Error("Expected element IR root");
    }
    return {
      tag: node.tag,
      ...(node.props === undefined ? {} : { props: { ...node.props } }),
      children: projectIrChildren(node.children)
    };
  });
}

function projectIrChildren(nodes: readonly IrNode[]): Array<VNodeShape | string> {
  return nodes.map((node) => node.kind === "text"
    ? node.value
    : {
      tag: node.tag,
      ...(node.props === undefined ? {} : { props: { ...node.props } }),
      children: projectIrChildren(node.children)
    });
}

function flattenVNodeTags(nodes: readonly VNode[]): string[] {
  return nodes.flatMap((node) => {
    assert.equal(typeof node.type, "string");
    const children = Array.isArray(node.children)
      ? node.children.filter((child): child is VNode => typeof child !== "string")
      : [];
    return [node.type as string, ...flattenVNodeTags(children)];
  });
}

function flattenHtmlTokenTags(tokens: readonly LexerToken[]): string[] {
  return syntaxTokens(tokens).flatMap((token) => {
    if (token.node.type === "html-block") {
      return flattenHtmlNodes(token.node.tree ?? []);
    }
    if (token.node.type === "paragraph") {
      return token.node.children.flatMap((node) => node.type === "html-container"
        ? flattenHtmlNodes(node.tree)
        : []);
    }
    return [];
  });
}

function flattenHtmlNodes(nodes: readonly ScannedHtmlTreeNode[]): string[] {
  return nodes.flatMap((node) => node.type === "html-element"
    ? [node.name, ...flattenHtmlNodes(node.children)]
    : []);
}
