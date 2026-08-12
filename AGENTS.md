# AGENTS.md

This repository is a typed, AST-first Markdown content compiler. Authors edit files in `content/`; the Node build pipeline scans every Markdown file, derives routes and navigation from its path and title, resolves declared lists, renders Vue 3 components with SSR, compiles Less, and writes a deployable static site to `dist/`.

The generated site must run without a server-side runtime or browser-side Markdown renderer.

## 1. Language, Architecture, And Technical Choices

### Required Stack

- TypeScript for all application, build, configuration, and test code. Do not add JavaScript source files or untyped scripting languages.
- Node.js for parsing, resolving, Less compilation, Vue SSR, and static output.
- Vue 3 and `@vue/server-renderer` at build time only.
- Unified/Remark for Markdown parsing and GitHub Flavored Markdown syntax.
- `remark-frontmatter` for YAML frontmatter recognition at the input boundary.
- `parse5` for DOM-tree parsing of raw HTML nodes that Unified/Remark identifies.
- Less for the editable theme and stable Markdown rendering contract.
- UTF-8 for source, content, templates, and generated output. English is the default site language; multilingual content must remain possible.

### Architecture Style

The compiler keeps source content, normalized structure, route resolution, and final presentation separate:

```text
Markdown and frontmatter
  -> LexerToken[]
  -> normalized TypeScript AST
  -> JSON-like IR
  -> typed Vue VNodes
  -> Vue SSR during the Node build
  -> static HTML, CSS, copied public files, and browser assets
```

Rules:

- Keep Markdown to LexerToken[] to normalized AST to JSON-like IR to Vue VNodes to HTML as separate stages. Do not replace the pipeline with a direct Markdown-to-HTML shortcut.
- Delegate Markdown, GFM, frontmatter, and code recognition to Unified/Remark in the scanner/parser adapter. When Unified/Remark identifies a raw HTML node, keep it on a separate HTML path and parse it directly into a DOM tree with `parse5`; never flatten that node to text and send it back through Markdown parsing. Convert the DOM tree into the local recursive HTML token tree, then apply the local whitelist normalizer. Keep the local token, normalized AST, IR, and code-generator contracts and middle-stage transformations in this repository.
- Keep token, AST, IR, and code-generator contracts in definition files separate from scanner, parser, lowering, and code-generator implementations. Implementation stages may consume the contracts; contracts must not import Vue or depend on implementation modules.
- Keep `docs/syntax.md` focused on authoring syntax and output behavior. Keep compiler stages, contracts, and repository structure in `docs/architecture.md`; keep setup and workflows in `docs/quickstart.md`.
- Pass user content through typed Vue VNodes so Vue SSR escapes text and attributes. Raw HTML must never become the core extension mechanism.
- Prefer existing typed package APIs and explicit `unknown` validation over `any`.
- Keep the four generic Vue page components (`page`, `list`, `list-object`, and `list-object-list`) in `src/renderer/vue/templates.ts`.
- Keep styles in Less files under `styles/`.

### Build Inputs And Outputs

- Treat `CONTENT_DIRECTORY`, `PUBLIC_DIRECTORY`, and `ASSET_DIRECTORY` as build input overrides. `ASSET_DIRECTORY` defaults to `PUBLIC_DIRECTORY/assets` and must remain a child of `PUBLIC_DIRECTORY`.
- The root `.env` may override only `SITE_TITLE`, `FOOTER_TEXT`, `CONTENT_DIRECTORY`, `PUBLIC_DIRECTORY`, and `ASSET_DIRECTORY` when their file values are non-empty. Empty allowed values leave process/default resolution unchanged.
- Do not load deployment identity, repository/base-path, server, environment-selector, or test-control values from `.env`; those values retain their existing process, GitHub Actions, Git, command-line, and default sources.
- Runtime tests must use disposable fixtures rather than the user-editable example `content/` and `public/` directories.
- `npm run build` writes the complete deployable site to `dist/`; never edit `dist/` by hand.
- The browser receives static HTML and CSS plus copied public files and assets. Do not ship a Vue runtime, client-side Markdown parser, client-side renderer, generated application JavaScript, or backend dependency.
- `VITE_BASE_PATH` changes the generated root-relative route and asset prefix for repository-scoped hosts such as GitHub Pages.
- The build also accepts `npm run build -- --base /repository-name/`; the command-line value takes precedence over `VITE_BASE_PATH`.
- If no explicit base is supplied but `GITHUB_REPOSITORY_NAME` or the standard `GITHUB_REPOSITORY=owner/name` environment value exists, the repository name is used as the base path.

### Local-First Development

- `dev/compiler.sh` type-checks and builds the static site.
- `dev/launcher.sh` compiles once and starts Vite against `dist/` for local preview.
- `dev/rt-test.sh` compiles disposable fixtures, starts Vite, checks every page and asset, and shuts Vite down.
- Do not keep empty directories with `.gitkeep`; create a directory only when it contains a real project asset or fixture.

## 2. Project Structure

Primary structure:

```text
constants/
  environment.ts            Dotenv parsing and the five-key user allowlist.
  github.ts                 GitHub SVG constants.
  runtime.ts                Runtime, AST, route, and image limits.
  site.ts                   Typed site defaults and environment resolution.
content/                    Author-managed Markdown input.
dev/
  compiler.sh               Type-check and static build entrypoint.
  launcher.sh               Local build and Vite preview entrypoint.
  rt-test.sh                Isolated full runtime test.
public/                     Public-file root.
  assets/                   Default browser-renderable source assets; ASSET_DIRECTORY may select another child.
docs/                       Architecture, authoring, and Markdown syntax documentation.
src/
  ast/                      Normalized AST and public domain types.
  tokens/                   Lexer token contracts and source spans.
  compiler/                  Unified/Remark syntax adapter, HTML DOM parser, and token boundary.
  parser/                   Local token/syntax adapter to normalized AST.
  ir/                       JSON-like IR contracts and AST lowering.
  codegen/                  Code generator contracts and Vue VNode generator.
  resolver/                 Content discovery, routes, collections, and assets.
  renderer/vue/             Static page chrome and page components.
  renderer/template-renderer.ts
                            Vue SSR entrypoint.
  build.ts                  Less, asset copy, route render, and output orchestration.
styles/
  markdown.less             Stable Markdown and AST rendering contract.
  theme.less                Editable visual theme and site chrome.
  site.less                 Less import boundary.
test/
  features/                 Syntax fixtures and expected cross-stage compiler behavior.
                            Static compiler-stage tests consume these fixtures.
                            Dynamic runtime fixtures and checks belong under `dev/`.
CONTRIBUTING.md             Commit and pull request requirements.
.github/workflows/deploy.yml
                            GitHub Pages build and deploy workflow.
```

### Content And Route Ownership

- `content/index.md` maps to the root route and is not implicitly a list; `index.md` inside a directory owns that directory route and is implicitly its list head.
- A top-level directory index such as `content/blogs/index.md` is implicitly a list head for `blogs/`, is a root-navigation route named `blogs`, and is not an item in the parent collection. Deeper indexes such as `blogs/series/index.md` implicitly list `blogs/series/`, own their nested route, and are collection heads, not items. Non-root directory indexes must not declare `type: page` or any explicit `source`.
- A document title comes from YAML `title`, its first level-one heading, or its file name in that order.
- Internal links use colon-separated logical route names such as `route:blog` and `route:blogs:series:first-step` until the resolver maps them to root-relative slash paths.
- The root `index` route also accepts the empty route name and `home` alias.
- For an external list head, declare `type: list` and `source: <directory>/`; the file name may give the collection the same user-facing root name or a different one. A non-root directory `index.md` is instead an implicit list head for its containing directory and can only use that directory's name. The page structure is inferred from the path and list declarations. Frontmatter does not select a page template.
- An external list page declared with `source: blogs/`—whether its file is `blogs.md` or `blog.md`—conflicts with `blogs/index.md` when that directory index is also present; one source directory has one canonical collection head. `indexed` ordering applies independently to root navigation and each direct collection-item level, while index heads are excluded from item lists.
- Content discovery is recursive and independent from collection declarations. Collection membership is direct-parent based: a route is mounted only into the collection whose source equals its containing directory. A nested collection may be declared by that directory's `index.md` or by an external `type: list` page whose `source` names the directory; without either head, nested routes still exist but are not mounted in a list.

### Generated Site And GitHub Pages

- Generated route and asset URLs begin with `/` and include the configured base path when one is supplied.
- GitHub Pages deployment publishes `dist/` to the `deploy` branch and adds `.nojekyll`.
- The workflow derives the repository name and GitHub identity from GitHub Actions environment/context values, not from the checkout's `.git` configuration.
- A successful GitHub avatar download is cached once under `dist/assets/github/<username>.<extension>` and reused by every generated page. If the build cannot download it, no avatar is rendered.

## 3. Content, Build, And Deployment Logic

### Project Intent

The project turns author-managed Markdown into a complete static site:

- Markdown and YAML frontmatter are scanned into lexer tokens and parsed into a normalized AST.
- The normalized AST is lowered into JSON-like IR before the Vue code generator creates VNodes.
- Recursive content discovery derives routes, navigation, and list relationships from paths and metadata.
- Assets are validated, copied, and emitted as root-relative URLs.
- Vue renders typed VNodes generated from IR during the build; the browser does not parse Markdown.
- Less compiles the editable theme and the stable Markdown rendering contract into one stylesheet.

### Frontmatter And Publication

- Supported page metadata is `title`, `description`, `type`, `source`, `date`, `tags`, `indexed`, and `draft`.
- `type` defaults to `page`; an explicit `type: list` page outside a non-root directory index requires `source`, while a non-root directory `index.md` is implicitly a list for its containing directory, may omit `type`, and must not declare `source`.
- `draft` defaults to `false`; `draft: true` excludes the document from routes, collections, and generated HTML.
- `indexed` is optional numeric display order. Indexed entries sort ascending, including `0`, before unindexed entries; unindexed entries sort alphabetically by title, then source path.
- Unknown frontmatter fields are ignored.

### Markdown And AST Rules

- Add or extend the normalized AST contract in `src/ast/types.ts` before changing parser behavior, and update the corresponding IR/code-generator contracts when the rendered shape changes.
- Convert token output into that node in `src/parser/parser.ts`.
- Lower the node into IR in `src/ir/ast-to-ir.ts`, then generate typed VNodes in `src/codegen/vue-code-generator.ts`.
- Treat `src/compiler/remark-syntax.ts` as the external source-recognition boundary; do not hand-parse Markdown delimiters or angle-bracket context in the local scanner.
- Treat a Remark raw HTML node as a separate DOM input. `parse5` produces the recursive HTML tree stored in the local token payload; the AST parser consumes that tree and never reparses its original HTML string as Markdown.
- Markdown headings and native `<h1>` through `<h5>` blocks must produce the same `HeadingNode` shape, preserving depth.
- Image-only paragraphs are centered by default. Images mixed with text remain left-aligned by default.
- Preserve native authoring alignment with `<div align="left|center|right">` or equivalent `text-align` style wrappers. Supported wrappers become typed content-alignment AST/VNodes; other raw HTML remains escaped.
- Image sizing declarations are typed Markdown extensions: `{max-width=30%}` changes the cap, while `{width=25%}` forces the rendered width. Whitelisted HTML images accept the corresponding numeric `vw` form (`max-width: 30vw` or `width: 25vw`) and normalize it to the same AST/IR semantics. Without a declaration, use the `CONTENT_IMAGE_MAX_WIDTH_PERCENT` default and intrinsic image size.
- Treat `asset:...` links and images as validated web-image references into `ASSET_DIRECTORY` (default `PUBLIC_DIRECTORY/assets`). Preserve nested asset names, reject traversal and unsupported extensions, and emit root-relative `/assets/...` URLs.
- Ordinary external image URLs such as `https://...` are allowed and remain external `src` values; unsafe URL schemes remain rejected by the IR boundary.
- HTML equivalents of supported Markdown constructs are a whitelist. Supported tags normalize to the same AST/IR semantics as Markdown; unsupported tags and image sizing units other than the supported HTML `%`/`vw` forms remain escaped text.
- The HTML whitelist includes alignment `div`, `h1` through `h5`, block containers, `img`, `ruby`/`rt`, `br`, `a`, and inline aliases `strong`/`b`, `em`/`i`, `del`/`s`/`strike`, and `code`/`tt`; HTML comments are discarded.
- Fenced code uses matching backticks or tildes of at least three characters. A four-character outer fence is the supported shell for literal inner three-character fences; language-marked and plain fences remain distinct AST/codegen cases.

### Identity, Attribution, And Footer

- Never hardcode a clone-specific user's GitHub username, full name, avatar path, repository name, or other changing identity into application defaults, generated content, workflow logic, or tests.
- The checked-in `content/index.md` is the template creator's own fixed Markdown example and may intentionally contain the creator's GitHub and email links; those values must not be reused as derived configuration or test fixtures.
- Local launcher identity may come from the local Git configuration for preview convenience. GitHub Actions identity must come from environment/context variables and must be passed into the build.
- `GITHUB_USERNAME` is the short GitHub login; `GITHUB_USER_FULL_NAME` supplies the display name used for the generated site title. The workflow may resolve the display name through GitHub's API.
- Intentional project attribution, such as the template creator's fixed `FOOTER_TEXT` default, is stable project metadata and may remain fixed.
- An empty `FOOTER_TEXT` uses the fixed default attribution. `FOOTER_TEXT=null` or `FOOTER_TEXT=nil` removes the complete footer component, including its top border.
- Keep tests independent from actual user-specific rendered content. Use the current repository's GitHub remote only when a valid GitHub identity is specifically under test.

### Asset And Image Behavior

- Public-root files retain their relative paths under `dist/`; configured browser assets are copied into `dist/assets/`, preserving nested names and supported image extensions.
- A standalone image is centered and receives vertical spacing so adjacent images do not touch.
- A wrapper may force an image or text block left, center, or right without introducing a custom image-only alignment attribute.
- The GitHub avatar frame has a fixed square size and transparent background; the downloaded image must fit inside the frame and must not change its dimensions.

### Build Order And Deployment

- The deployment workflow must run `npm test` and `npm run rt-test` before `npm run build`.
- The build must consume `VITE_BASE_PATH`, `--base`, repository name, and identity values from the current process environment/arguments rather than reading `.git` for CI identity.
- A push to `main` or a manually dispatched workflow builds the site and force-publishes `dist/` to the `deploy` branch.
- Deployment must use the repository's `GITHUB_TOKEN`; do not add personal tokens or user-specific repository URLs.

## 4. Syntax, Template, And Style Rules

### TypeScript Rules

- Use strict TypeScript types and explicit `unknown` validation.
- Keep application, build, configuration, and test code typed.
- Put site, runtime, and visual integration constants in typed files under `constants/`. Keep `const.ts` as a compatibility export only.
- Do not introduce magic values when an existing typed constant or a named constant file is appropriate.

### Vue Template Rules

- Keep the four generic Vue page components in `src/renderer/vue/templates.ts`.
- Keep Vue as a build-time SSR dependency; no client-side Vue runtime or application JavaScript may be generated.
- Keep content rendering at the AST-to-IR-to-VNode boundaries. Do not inject raw Markdown or arbitrary raw HTML into templates.
- Header navigation, breadcrumbs, GitHub action, avatar, and optional footer belong to the static page chrome.

### Less And Theme Rules

- Treat `styles/markdown.less` as the stable Markdown and normalized-AST rendering contract. Do not change its selectors or ordinary rendering behavior for unrelated theme work.
- Treat `styles/theme.less` as the editable visual customization surface for colors, font families, font sizes, spacing, site chrome, avatar border, and responsive theme rules.
- Keep `styles/site.less` as the import boundary.
- Do not add browser-side style or behavior that requires a runtime Markdown renderer.

### Testing And Verification Rules

- Add a focused test under `test/` for each parser, AST, renderer, configuration, or build behavior change.
- Keep cross-stage syntax fixtures in `test/features/`; static compiler-stage tests consume them. Each feature should assert the token tree, normalized AST, JSON-like IR, Vue VNode projection, and SSR HTML expected for the same source; include each documented syntax object in isolation and in mixed/nested outer-and-inner Markdown/HTML combinations, plus negative features for rejected or escaped input. `test/features/indexed-routes.ts` also covers root indexes, directory indexes, indexed zero, mixed indexed/unindexed items, nested indexes, same-name and different-name external list heads, and the conflicting external-head layout. Dynamic site tests and disposable runtime fixtures belong under `dev/`; `dev/rt-test/fixtures/content/syntax.md` and `dev/rt-test.sh` must exercise the documented positive syntax in an actual generated page, while the draft fixture must prove excluded routes stay unavailable.
- Treat `docs/syntax.md` as a tested contract. Whenever syntax is added or changed, update the matching `test/features/` source and expected data, then update or add the focused test that proves the behavior. A syntax description may remain in `docs/syntax.md` only when its feature data exists and the test passes.
- A failing syntax test is evidence that the implementation or its expected semantic output is incomplete. Do not delete tests, remove coverage, weaken assertions, skip cases, or otherwise hide a failure to make the suite pass; fix the implementation or correct the expected data to match the intentional contract.
- Test runtime behavior with disposable fixtures through `CONTENT_DIRECTORY`, `PUBLIC_DIRECTORY`, and `ASSET_DIRECTORY` overrides.
- Keep test content and rendered-output assertions independent from clone-specific usernames, full names, avatars, and repository names.
- Before handoff, run the type checker, tests, static build, and full runtime test when the change affects build or rendering.
- Inspect generated HTML for escaped content, resolved links, UTF-8 preservation, correct Vue SSR output, correct base-path prefixes, and absence of browser JavaScript.

### Development Priorities

1. Correct static output and route/asset resolution.
2. Portable cloning, environment-driven identity, and repository-scoped deployment.
3. AST and type safety.
4. Stable authoring behavior and Markdown compatibility.
5. Clear, editable theme and site chrome.

### Contribution Workflow

- Before writing commit messages or pull requests, read `CONTRIBUTING.md`.
- Commit messages and pull request descriptions must follow `CONTRIBUTING.md`.
- Pull request checks must include the relevant TypeScript, Vue, CSS, storage, architecture, and presentation rules from this `AGENTS.md`.
- If a change updates architecture, persistence boundaries, fixed-canvas behavior, data shape, language handling, or contribution rules, update this `AGENTS.md` in the same change.
