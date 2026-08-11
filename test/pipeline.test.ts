import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "@vue/server-renderer";
import { h } from "vue";
import { scanMarkdown } from "../src/compiler/scanner.ts";
import { TokenKind } from "../src/tokens/types.ts";
import { parseMarkdown, parseMarkdownTokens } from "../src/parser/parser.ts";
import { lowerAstToIr } from "../src/ir/ast-to-ir.ts";
import { generateVueNodes } from "../src/codegen/vue-code-generator.ts";

test("scans syntax into lexer tokens before parsing", () => {
  const tokens = scanMarkdown([
    "---",
    "title: Token fixture",
    "---",
    "",
    "# Heading",
    "",
    "Text with **strong** and [route](route:index).",
    "",
    "![marker](asset:icons/marker.svg){max-width=30%}"
  ].join("\n"));

  const kinds = tokens.map((token) => token.kind);
  assert.equal(kinds[0], TokenKind.frontmatterStart);
  assert.ok(kinds.includes(TokenKind.frontmatterText));
  assert.ok(kinds.includes(TokenKind.frontmatterEnd));
  assert.ok(kinds.includes(TokenKind.syntaxNode));
  const syntaxTokens = tokens.filter((token) => token.kind === TokenKind.syntaxNode);
  assert.ok(syntaxTokens.some((token) => token.node.type === "heading"));
  assert.ok(syntaxTokens.some((token) => token.node.type === "paragraph"));
  const imageParagraph = syntaxTokens.find(
    (token) => token.node.type === "paragraph"
      && token.node.children.some((child) => child.type === "image")
  );
  assert.equal(imageParagraph?.node.type, "paragraph");
  if (imageParagraph?.node.type === "paragraph") {
    const image = imageParagraph.node.children.find((child) => child.type === "image");
    assert.equal(image?.type, "image");
    assert.equal(image?.maxWidthPercent, 30);
  }
  assert.equal(kinds.at(-1), TokenKind.eof);
  assert.ok(tokens.every((token) => token.start.offset <= token.end.offset));
});

test("parses the scanner token stream into the same normalized AST entrypoint", () => {
  const source = "---\ntitle: Token fixture\n---\n\n# Heading\n\nA **typed** paragraph.";
  const fromSource = parseMarkdown(source, "fixture/token.md", "token");
  const fromTokens = parseMarkdownTokens(
    scanMarkdown(source),
    "fixture/token.md",
    "token"
  );
  assert.deepEqual(fromTokens, fromSource);
});

test("lowers AST into JSON-like IR and generates Vue nodes from that IR", async () => {
  const document = parseMarkdown(
    "# Pipeline\n\nHello **compiler** [home](route:index).",
    "fixture/pipeline.md",
    "pipeline"
  );
  const ir = lowerAstToIr(document.ast, {
    routeHref: (name) => name === "index" ? "/" : `/${name}/`,
    relativeHref: (path) => path,
    assetHref: (name) => `/assets/${name}`,
    collections: new Map()
  });

  assert.deepEqual(ir[0], {
    kind: "element",
    tag: "p",
    children: [
      { kind: "text", value: "Hello " },
      {
        kind: "element",
        tag: "strong",
        children: [{ kind: "text", value: "compiler" }]
      },
      { kind: "text", value: " " },
      {
        kind: "element",
        tag: "a",
        props: { href: "/" },
        children: [{ kind: "text", value: "home" }]
      },
      { kind: "text", value: "." }
    ]
  });

  const html = await renderToString(h("div", null, generateVueNodes(ir)));
  assert.match(html, /<strong>compiler<\/strong>/u);
  assert.match(html, /<a href="\/">home<\/a>/u);
});

test("uses the external syntax engine for angle brackets in text and code", () => {
  const document = parseMarkdown([
    "Text with 2 < 3 and 4 > 1.",
    "",
    "> A quote with 5 < 6 and 7 > 2.",
    "",
    "`inline 8 < 9 and 10 > 4`",
    "",
    "~~~ts",
    "if (left < right) return value > limit;",
    "~~~"
  ].join("\n"), "fixture/angles.md", "angles");

  assert.deepEqual(document.ast.children[0], {
    type: "paragraph",
    children: [{ type: "text", value: "Text with 2 < 3 and 4 > 1." }]
  });
  assert.deepEqual(document.ast.children[1], {
    type: "blockquote",
    children: [{
      type: "paragraph",
      children: [{ type: "text", value: "A quote with 5 < 6 and 7 > 2." }]
    }]
  });
  assert.deepEqual(document.ast.children[2], {
    type: "paragraph",
    children: [{ type: "inline-code", value: "inline 8 < 9 and 10 > 4" }]
  });
  assert.deepEqual(document.ast.children[3], {
    type: "code-block",
    language: "ts",
    value: "if (left < right) return value > limit;"
  });
});

test("normalizes whitelisted HTML equivalents to the same AST and IR", () => {
  const markdown = parseMarkdown(
    "**strong** *emphasis* ~~deleted~~ `code` [home](route:index)\n\n![External](https://example.com/image.png){max-width=30%}",
    "fixture/markdown.md",
    "markdown"
  );
  const html = parseMarkdown(
    "<strong>strong</strong> <em>emphasis</em> <del>deleted</del> <code>code</code> <a href=\"route:index\">home</a>\n\n<img src=\"https://example.com/image.png\" alt=\"External\" style=\"max-width: 30vw\">",
    "fixture/html.md",
    "html"
  );

  assert.deepEqual(html.ast, markdown.ast);
  const context = {
    routeHref: (name: string) => name === "index" ? "/" : `/${name}/`,
    relativeHref: (path: string) => path,
    assetHref: (name: string) => `/assets/${name}`,
    collections: new Map()
  };
  assert.deepEqual(lowerAstToIr(html.ast, context), lowerAstToIr(markdown.ast, context));
  assert.equal(
    (html.ast.children[1]?.type === "paragraph" ? html.ast.children[1].children[0]?.type : null),
    "image"
  );
});

test("keeps unsupported HTML and unsupported image units outside the whitelist", () => {
  const document = parseMarkdown(
    "<script>alert(1)</script>\n\n<img src=\"https://example.com/image.png\" width=\"25vh\">",
    "fixture/unsupported-html.md",
    "unsupported-html"
  );
  assert.deepEqual(document.ast.children.map((node) => node.type), ["text-block", "text-block"]);
  assert.match(
    document.ast.children[0]?.type === "text-block" ? document.ast.children[0].value : "",
    /<script>/u
  );
});
