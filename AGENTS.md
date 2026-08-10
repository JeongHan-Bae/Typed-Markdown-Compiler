# AGENTS.md

This repository is a typed, AST-first Markdown content compiler. Authors edit files in `content/`; the Node build pipeline scans every Markdown file, derives routes and navigation from its path and title, resolves declared lists, renders Vue 3 components with SSR, compiles Less, and writes a deployable static site to `dist/`.

The generated site must run without a server-side runtime or browser-side Markdown renderer.

## 1. Language, Architecture, And Technical Choices

### Required Stack

- TypeScript for all application, build, configuration, and test code. Do not add JavaScript source files or untyped scripting languages.
- Node.js for parsing, resolving, Less compilation, Vue SSR, and static output.
- Vue 3 and `@vue/server-renderer` at build time only.
- Unified/Remark for Markdown parsing and GitHub Flavored Markdown syntax.
- Less for the editable theme and stable Markdown rendering contract.
- UTF-8 for source, content, templates, and generated output. English is the default site language; multilingual content must remain possible.

### Architecture Style

The compiler keeps source content, normalized structure, route resolution, and final presentation separate:

```text
Markdown and frontmatter
  -> normalized TypeScript AST
  -> content and route resolver
  -> typed Vue VNodes
  -> Vue SSR during the Node build
  -> static HTML, CSS, and copied assets
```

Rules:

- Keep Markdown to normalized AST to HTML as separate stages. Do not replace the AST pipeline with a direct Markdown-to-HTML shortcut.
- Pass user content through typed Vue VNodes so Vue SSR escapes text and attributes. Raw HTML must never become the core extension mechanism.
- Prefer existing typed package APIs and explicit `unknown` validation over `any`.
- Keep the four generic Vue page components (`page`, `list`, `list-object`, and `list-object-list`) in `src/renderer/vue/templates.ts`.
- Keep styles in Less files under `styles/`.

### Build Inputs And Outputs

- Treat `CONTENT_DIRECTORY` and `PUBLIC_DIRECTORY` as build input overrides.
- Runtime tests must use disposable fixtures rather than the user-editable example `content/` and `public/` directories.
- `npm run build` writes the complete deployable site to `dist/`; never edit `dist/` by hand.
- The browser receives static HTML and CSS only. Do not ship a Vue runtime, client-side Markdown parser, client-side renderer, or backend dependency.
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
  github.ts                 GitHub SVG constants.
  runtime.ts                Runtime, AST, route, and image limits.
  site.ts                   Typed site defaults and environment resolution.
content/                    Author-managed Markdown input.
dev/
  compiler.sh               Type-check and static build entrypoint.
  launcher.sh               Local build and Vite preview entrypoint.
  rt-test.sh                Isolated runtime smoke test.
public/assets/              Browser-renderable source assets.
src/
  ast/                      Normalized AST and public domain types.
  parser/                   Markdown and frontmatter parsing.
  resolver/                 Content discovery, routes, collections, and assets.
  renderer/vue/             AST-to-VNode rendering and page components.
  renderer/template-renderer.ts
                            Vue SSR entrypoint.
  build.ts                  Less, asset copy, route render, and output orchestration.
styles/
  markdown.less             Stable Markdown and AST rendering contract.
  theme.less                Editable visual theme and site chrome.
  site.less                 Less import boundary.
test/                       Focused parser, renderer, configuration, and build tests.
CONTRIBUTING.md             Commit and pull request requirements.
.github/workflows/deploy.yml
                            GitHub Pages build and deploy workflow.
```

### Content And Route Ownership

- `content/index.md` maps to the root route; `index.md` inside a directory owns that directory route.
- A document title comes from YAML `title`, its first level-one heading, or its file name in that order.
- Internal links use colon-separated logical route names such as `route:blog` and `route:blogs:series:first-step` until the resolver maps them to root-relative slash paths.
- The root `index` route also accepts the empty route name and `home` alias.
- For a list, declare `type: list` and `source: <directory>/`; the page structure is inferred from the path and list declarations. Frontmatter does not select a page template.

### Generated Site And GitHub Pages

- Generated route and asset URLs begin with `/` and include the configured base path when one is supplied.
- GitHub Pages deployment publishes `dist/` to the `deploy` branch and adds `.nojekyll`.
- The workflow derives the repository name and GitHub identity from GitHub Actions environment/context values, not from the checkout's `.git` configuration.
- A successful GitHub avatar download is cached once under `dist/assets/github/<username>.<extension>` and reused by every generated page. If the build cannot download it, no avatar is rendered.

## 3. Content, Build, And Deployment Logic

### Project Intent

The project turns author-managed Markdown into a complete static site:

- Markdown and YAML frontmatter are parsed into a normalized AST.
- Recursive content discovery derives routes, navigation, and list relationships from paths and metadata.
- Assets are validated, copied, and emitted as root-relative URLs.
- Vue renders typed AST VNodes during the build; the browser does not parse Markdown.
- Less compiles the editable theme and the stable Markdown rendering contract into one stylesheet.

### Frontmatter And Publication

- Supported page metadata is `title`, `description`, `type`, `source`, `date`, `tags`, `indexed`, and `draft`.
- `type` defaults to `page`; `source` is required for a `list` page.
- `draft` defaults to `false`; `draft: true` excludes the document from routes, collections, and generated HTML.
- `indexed` is optional numeric display order. Indexed entries sort ascending, including `0`, before unindexed entries; unindexed entries sort alphabetically by title, then source path.
- Unknown frontmatter fields are ignored.

### Markdown And AST Rules

- Add or extend a normalized AST node in `src/ast/types.ts` before changing parser or renderer behavior.
- Convert parser output into that node in `src/parser/markdown-parser.ts`.
- Render the node as typed VNodes in `src/renderer/vue/ast-renderer.ts`.
- Markdown headings and native `<h1>` through `<h5>` blocks must produce the same `HeadingNode` shape, preserving depth.
- Image-only paragraphs are centered by default. Images mixed with text remain left-aligned by default.
- Preserve native authoring alignment with `<div align="left|center|right">` or equivalent `text-align` style wrappers. Supported wrappers become typed content-alignment AST/VNodes; other raw HTML remains escaped.
- Image sizing declarations are typed Markdown extensions: `{max-width=30%}` changes the cap, while `{width=25%}` forces the rendered width. Without a declaration, use the `CONTENT_IMAGE_MAX_WIDTH_PERCENT` default and intrinsic image size.
- Treat `asset:...` links and images as validated web-image references into `public/assets/`. Preserve nested asset names, reject traversal and unsupported extensions, and emit root-relative `/assets/...` URLs.

### Identity, Attribution, And Footer

- Never hardcode a clone-specific user's GitHub username, full name, avatar path, repository name, or other changing identity into application defaults, generated content, workflow logic, or tests.
- The checked-in `content/index.md` is the template creator's own fixed Markdown example and may intentionally contain the creator's GitHub and email links; those values must not be reused as derived configuration or test fixtures.
- Local launcher identity may come from the local Git configuration for preview convenience. GitHub Actions identity must come from environment/context variables and must be passed into the build.
- `GITHUB_USERNAME` is the short GitHub login; `GITHUB_USER_FULL_NAME` supplies the display name used for the generated site title. The workflow may resolve the display name through GitHub's API.
- Intentional project attribution, such as the template creator's fixed `FOOTER_TEXT` default, is stable project metadata and may remain fixed.
- An empty `FOOTER_TEXT` uses the fixed default attribution. `FOOTER_TEXT=null` or `FOOTER_TEXT=nil` removes the complete footer component, including its top border.
- Keep tests independent from actual user-specific rendered content. Use the current repository's GitHub remote only when a valid GitHub identity is specifically under test.

### Asset And Image Behavior

- Public assets are copied into `dist/assets/`; nested names and supported image extensions must be preserved.
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
- Keep Vue as a build-time SSR dependency; no client-side Vue runtime or application JavaScript may be emitted.
- Keep content rendering at the AST-to-VNode boundary. Do not inject raw Markdown or arbitrary raw HTML into templates.
- Header navigation, breadcrumbs, GitHub action, avatar, and optional footer belong to the static page chrome.

### Less And Theme Rules

- Treat `styles/markdown.less` as the stable Markdown and normalized-AST rendering contract. Do not change its selectors or ordinary rendering behavior for unrelated theme work.
- Treat `styles/theme.less` as the editable visual customization surface for colors, font families, font sizes, spacing, site chrome, avatar border, and responsive theme rules.
- Keep `styles/site.less` as the import boundary.
- Do not add browser-side style or behavior that requires a runtime Markdown renderer.

### Testing And Verification Rules

- Add a focused test under `test/` for each parser, AST, renderer, configuration, or build behavior change.
- Test runtime behavior with disposable fixtures through `CONTENT_DIRECTORY` and `PUBLIC_DIRECTORY` overrides.
- Keep test content and rendered-output assertions independent from clone-specific usernames, full names, avatars, and repository names.
- Before handoff, run the type checker, tests, static build, and runtime smoke test when the change affects build or rendering.
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
