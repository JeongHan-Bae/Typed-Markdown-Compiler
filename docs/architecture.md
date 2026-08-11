# Compiler Architecture

This repository is a typed Markdown-to-static-site compiler. The compiler owns the data flow between source text, project tokens, normalized content, an intermediate representation, Vue VNodes, and final static HTML. Unified/Remark performs Markdown/GFM/frontmatter recognition at the input boundary, `parse5` parses Remark-identified raw HTML into a DOM tree, and Vue performs VNode/SSR work at the output boundary; the project's contracts and middle stages remain local.

## Input technology selection

The input boundary has two deliberately separate source recognizers:

- Unified/Remark recognizes Markdown, GFM, YAML frontmatter, fenced code, and the fact that a source region is raw HTML rather than Markdown.
- `parse5` parses only those raw HTML regions into a DOM-style tree. The scanner converts that tree into the recursive local HTML token payload; it does not flatten HTML to text and does not send HTML back through Remark as Markdown.
- HTML comment nodes are recognized by the same DOM parser and discarded before they reach the normalized AST; they never become visible text or output HTML.

The project chooses the DOM-tree route, not an XML route, because the supported authoring syntax is HTML-tag based (`div`, `img`, `ruby`, and the whitelisted inline/block tags). `parse5` is the single dedicated HTML parser dependency; all whitelist decisions and AST/IR normalization remain project-owned.

## Pipeline

```text
Markdown file
  -> Scanner
  -> LexerToken[]
  -> Parser
  -> SourceDocument { metadata, AST }
  -> Content and route resolver
  -> AST lowering
  -> JSON-like IR
  -> Vue Code Generator
  -> Vue VNodes
  -> Vue SSR
  -> dist/**/*.html, dist/assets/**, dist/routes.json
```

The resolver runs after parsing because routes, collections, and navigation depend on the complete set of published documents. It supplies route, asset, and collection context to AST lowering; it does not change the Markdown AST or generate HTML.

Directory indexes have path-owned collection semantics: `blogs/index.md` is implicitly the list head for `blogs/`, is a root-navigation route named `blogs`, and is excluded from collection items. The root `index.md` is different: it owns `/` but is not implicitly a list. An external list head may use either the matching route name (`blogs.md`) or a different one (`blog.md`), but either external head conflicts with `blogs/index.md` when both target `blogs/`. The parser rejects explicit `type: page` and explicit `source` on non-root directory indexes before route resolution.

## Stage contracts

| Stage | Definition | Implementation | Responsibility |
| --- | --- | --- | --- |
| Tokens | `src/tokens/types.ts` | `src/compiler/scanner.ts`, `src/compiler/remark-syntax.ts`, `src/compiler/html-tree.ts`, Unified/Remark, parse5 | Recursive project token envelope and source spans; raw HTML becomes a local DOM-derived token tree |
| AST | `src/ast/types.ts` | `src/parser/parser.ts` | Normalized Markdown structure and page metadata; consumes local Markdown tokens and HTML token trees |
| Resolver | `src/ast/types.ts` | `src/resolver/route-resolver.ts` | Routes, collections, navigation, and document relationships |
| IR | `src/ir/types.ts` | `src/ir/ast-to-ir.ts` | JSON-like target-neutral elements, properties, text, and children |
| Code Generator | `src/codegen/types.ts` | `src/codegen/vue-code-generator.ts` | IR to Vue VNodes |
| SSR | Vue runtime contract | `src/renderer/template-renderer.ts` | VNodes and page templates to static HTML |

Definition modules contain contracts only. Scanner, parser, lowering, and code-generator implementations import those contracts; the contract modules do not import Vue or implementation modules.

## Tokens

`LexerToken` is the scanner/parser boundary. A token carries a `kind`, original `lexeme`, and source `start`/`end` positions. `src/compiler/scanner.ts` delegates Markdown, GFM, YAML frontmatter, and code recognition to Unified/Remark. When Remark returns raw HTML, `src/compiler/html-tree.ts` uses `parse5` to build a DOM-style tree, and `src/compiler/remark-syntax.ts` translates that tree into the recursive local HTML payloads in `src/tokens/types.ts`.

The token payload is still local to this project; it is not a Remark AST and it is not the normalized AST:

```ts
{
  kind: "syntax-node",
  lexeme: "![Marker](https://example.com/marker.svg){max-width=30%}",
  node: {
    type: "paragraph",
    children: [
      {
        type: "image",
        url: "https://example.com/marker.svg",
        alt: "Marker",
        title: null,
        maxWidthPercent: 30
      }
    ]
  },
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 65, line: 1, column: 66 }
}
```

The token adapter does not emit HTML directly. Supported native HTML is retained as a recursive typed DOM-derived token tree and enters the same parser whitelist as the corresponding Markdown construct. Unknown HTML remains source text and is escaped at the VNode boundary.

## AST

The normalized AST is defined in `src/ast/types.ts`. It contains Markdown blocks (`ParagraphNode`, `HeadingNode`, `ListNode`, `TableNode`, and others), inline nodes (`LinkNode`, `ImageNode`, `StrongNode`, and others), and typed route/asset targets.

`src/parser/parser.ts` is responsible for:

- consuming the local token envelope produced from the external syntax tree;
- validating supported metadata with `unknown` checks;
- converting external syntax nodes and whitelisted HTML equivalents into normalized nodes;
- applying typed extensions such as alignment wrappers and image sizing;
- deriving title and description metadata;
- appending collection declarations for list pages.

The AST has no Vue imports and no generated HTML strings. Unsupported raw HTML becomes escaped text data, except for the explicitly recognized typed extensions.

## IR

The IR is a recursive, JSON-like object. It is intentionally smaller than the AST and independent from Vue:

```ts
type IrNode =
  | { kind: "text"; value: string }
  | {
      kind: "element";
      tag: string;
      props?: Record<string, string | number | boolean>;
      children: IrNode[];
    };
```

`src/ir/ast-to-ir.ts` lowers normalized AST nodes into this shape. It resolves internal route links and validated assets using resolver context, but it does not call Vue's `h()` and does not create VNodes. Because the IR is target-neutral, another code generator can consume it without changing the scanner, parser, or AST.

## Vue Code Generator and templates

`src/codegen/vue-code-generator.ts` implements the `CodeGenerator<Input, Output>` contract from `src/codegen/types.ts`. Its input is only IR and its output is typed Vue VNodes. Vue escaping therefore occurs at the final typed-node boundary; Markdown source and arbitrary raw HTML never reach the browser.

`src/renderer/vue/templates.ts` owns the four generic page templates: `page`, `list`, `list-object`, and `list-object-list`. It lowers the document AST to IR, calls `vueCodeGenerator.generate()`, and places the generated content VNodes inside the static page shell. `src/renderer/vue/page-chrome.ts` contains navigation, breadcrumbs, article navigation, and tag chrome.

`src/renderer/template-renderer.ts` calls `@vue/server-renderer` during the Node build. The generated browser output contains HTML and CSS only; Vue, Remark, the parser, and the compiler are not shipped to the browser.

## Build and output ownership

`src/build.ts` owns the final build orchestration:

1. remove and recreate `dist/`;
2. discover and parse Markdown documents;
3. resolve routes, collections, and navigation;
4. compile Less into `dist/assets/site.css`;
5. copy validated public assets;
6. cache the optional GitHub avatar;
7. lower and generate every route's content through the pipeline;
8. render page templates to route `index.html` files;
9. write `dist/routes.json`.

The browser receives root-relative links and assets, with the configured base path applied by the resolver. `dist/` is generated output and must not be edited by hand.

## Repository layout

The following is the architecture-focused view of `jh_cp tree . --git-view`; the root is intentionally represented by `.` so the repository can be renamed without changing this document. Compiler-owned `src/` directories are expanded separately so stage ownership and boundaries remain visible. Authoring examples, public assets, disposable runtime fixtures, and test feature data are summarized because they are inputs and verification data rather than compiler architecture:

`content/` is the checked-in example authoring input. The default build reads it, while a real site can replace it through `CONTENT_DIRECTORY`; it is not compiler implementation code. The disposable runtime-test examples live under `dev/rt-test/fixtures/`. The compile flow is in `dev/`, and automatic deployment is defined in `.github/workflows/deploy.yml`.

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml
├── constants/
│   ├── github.ts
│   ├── runtime.ts
│   └── site.ts
├── content/                  Checked-in example authoring input.
├── dev/
│   ├── compiler.sh
│   ├── launcher.sh
│   ├── rt-test.sh            Dynamic build/HTTP smoke-test entrypoint.
│   └── rt-test/fixtures/     Disposable dynamic-test content and assets.
├── docs/                     Architecture, authoring, and syntax contracts.
├── public/                   Browser-renderable source assets.
├── src/
│   ├── ast/
│   │   └── types.ts
│   ├── codegen/
│   │   ├── types.ts
│   │   └── vue-code-generator.ts
│   ├── compiler/
│   │   ├── html-tree.ts
│   │   ├── remark-syntax.ts
│   │   └── scanner.ts
│   ├── ir/
│   │   ├── ast-to-ir.ts
│   │   └── types.ts
│   ├── parser/
│   │   └── parser.ts
│   ├── plugins/
│   │   └── github-follow-link.ts
│   ├── renderer/
│   │   ├── vue/
│   │   │   ├── page-chrome.ts
│   │   │   └── templates.ts
│   │   └── template-renderer.ts
│   ├── resolver/
│   │   ├── asset-resolver.ts
│   │   └── route-resolver.ts
│   ├── tokens/
│   │   └── types.ts
│   └── build.ts
├── styles/
│   ├── markdown.less
│   ├── site.less
│   └── theme.less
├── test/                     Static compiler/build tests and feature data.
├── .gitattributes
├── .gitignore
├── AGENTS.md
├── config.ts
├── const.ts
├── CONTRIBUTING.md
├── LICENSE
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

The abbreviated operational directories still have explicit ownership:

- `content/` is checked-in example input and can be replaced with `CONTENT_DIRECTORY`.
- `public/` is checked-in browser asset input and can be replaced with `PUBLIC_DIRECTORY`.
- `dev/rt-test/fixtures/` is disposable dynamic-test input; `dev/rt-test.sh` builds it, starts Vite, checks HTTP output, and stops the server.
- `test/features/` contains static syntax contracts; `test/feature-pipeline.test.ts` checks their Tokens, AST, IR, VNode, and SSR HTML stages, including comment removal. `dev/rt-test/fixtures/content/syntax.md` and the `/syntax` assertions in `dev/rt-test.sh` exercise the same documented positive syntax through the generated site; `draft.md` is checked as a 404.

The exact operational tree is intentionally not expanded here; it is not a stage boundary.

Use [Quickstart](quickstart.md) for author and build workflows and [Markdown syntax](syntax.md) for source syntax. This document is the place for stage boundaries and compiler architecture. The tree root is intentionally `.` so the repository can be renamed later.
