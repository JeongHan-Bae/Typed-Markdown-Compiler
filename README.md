# Typed Markdown Compiler

Want to make a personal blog or turn Markdown into a static website? This repository gives you both a ready-to-use template and the compiler that builds it.

Write Markdown files in `content/`, put images and other browser assets in `public/assets/`, and push your changes. The compiler generates the complete site in `dist/`, and the included GitHub Actions workflow can publish it to GitHub Pages. You do not need to write any HTML, create an HTML template, run a backend, or add a browser-side Markdown renderer.

The checked-in example looks like a personal blog because that is the easiest way to see the project working and is a recommended use case. The project itself is not a blog application: it is a general Markdown-to-static-HTML compiler that can also build documentation, portfolios, notes, and other content-driven sites.

## Start your own site

1. Select **Use this template** on GitHub and create your own repository.
2. Edit or replace the Markdown under `content/`, and place images under `public/assets/`.
3. Optionally fill in the safe values in the root `.env` file.
4. Commit and push to `main`.

After GitHub Pages is enabled for the `deploy` branch, every successful push rebuilds and updates your own static website. The workflow derives the owner and repository path from the repository running it, so a repository created from this template deploys as that user's site rather than as this example.

## Write Markdown, not HTML

The authoring format is mostly ordinary Markdown and GitHub Flavored Markdown. The compiler adds a small set of typed conventions for features a static site needs, especially internal `route:...` links, `asset:...` references, collections, frontmatter, and image sizing. [Markdown syntax](docs/syntax.md) explains each supported form with examples.

You can also give that syntax document to an AI assistant and ask it to create or edit pages for this compiler. The special forms are deliberately small and explicit; most article content remains familiar Markdown.

The layout, navigation, breadcrumbs, list pages, metadata, styling, and static HTML generation are already provided. You only author content and assets unless you intentionally want to customize the compiler or theme.

## What the compiler does

`typed-markdown-compiler` scans every published Markdown file, derives routes and navigation from paths and metadata, resolves collections and assets, and generates one static HTML route per document. Internally, source flows through lexer tokens, a normalized TypeScript AST, JSON-like IR, typed Vue VNodes, and Vue SSR before becoming HTML. This is a real typed compiler pipeline rather than a direct browser-side Markdown conversion.

Vue, Unified/Remark, Less, `dotenv`, and the compiler itself are build-time dependencies only. The deployed `dist/` contains static HTML, compiled CSS, and copied assets—no Vue runtime, Markdown parser, Node server, or application JavaScript.

The default document language is English, while multilingual Markdown content remains supported.

## Default input and example site

The default build reads these author-facing inputs:

- `content/` contains Markdown and frontmatter source files.
- `public/assets/` contains browser assets referenced by `asset:...` links and images.

It copies assets to `dist/assets/` and writes the complete deployable website to `dist/`. The current personal-blog example contains a home page, about page, field notes, and posts solely to demonstrate this compiler and template.

### Live example and URLs

The repository's GitHub Pages workflow publishes the generated `dist/` directory to the `deploy` branch. The default project-site URL for this repository, and the live example rendered from the checked-in `content/`, is:

[https://jeonghan-bae.github.io/Typed-Markdown-Compiler/](https://jeonghan-bae.github.io/Typed-Markdown-Compiler/)

The current source-to-URL mapping is:

| Source | Generated route | Example deployment URL |
| --- | --- | --- |
| `content/index.md` | `/` | [`/Typed-Markdown-Compiler/`](https://jeonghan-bae.github.io/Typed-Markdown-Compiler/) |
| `content/about.md` | `/about/` | [`/about/`](https://jeonghan-bae.github.io/Typed-Markdown-Compiler/about/) |
| `content/blog.md` | `/blog/` | [`/blog/`](https://jeonghan-bae.github.io/Typed-Markdown-Compiler/blog/) |
| `content/blogs/hello-world.md` | `/blogs/hello-world/` | [`/blogs/hello-world/`](https://jeonghan-bae.github.io/Typed-Markdown-Compiler/blogs/hello-world/) |
| `content/blogs/typed-ast.md` | `/blogs/typed-ast/` | [`/blogs/typed-ast/`](https://jeonghan-bae.github.io/Typed-Markdown-Compiler/blogs/typed-ast/) |
| `public/assets/icons/syntax-marker.svg` | `/assets/icons/syntax-marker.svg` | [`/assets/icons/syntax-marker.svg`](https://jeonghan-bae.github.io/Typed-Markdown-Compiler/assets/icons/syntax-marker.svg) |

The local build uses `/` as its base by default. GitHub Pages sets the base to the repository name, so the same generated routes receive the `/Typed-Markdown-Compiler/` prefix. When this repository is used as a template, the workflow derives the prefix and the project-site URL from the new owner's repository name instead of relying on these example URLs.

For package metadata and lockfile references, the project name is `typed-markdown-compiler`.

## Documentation

- [Quickstart](docs/quickstart.md) covers installation, authoring, configuration, testing, and deployment.
- [Markdown syntax](docs/syntax.md) defines frontmatter, routes, collections, assets, images, and supported blocks.
- [Architecture](docs/architecture.md) defines the compiler stages, data contracts, and repository structure.
- [AGENTS.md](AGENTS.md) records the engineering rules and architecture boundaries.
- [CONTRIBUTING.md](CONTRIBUTING.md) defines commit and pull request requirements.

## Quick start

~~~bash
npm install
npm run check
npm run check:unused
npm test
npm run build
~~~

`npm run build` is the actual Markdown compilation: it reads the current `content/` and `public/assets/` inputs and writes the generated site to `dist/`. Deploy that directory to GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static host. GitHub Pages deployment is configured in `.github/workflows/deploy.yml`; it supplies the repository-scoped base path automatically.

## Configure with `.env`

The repository includes a root `.env` template containing only four user-facing configuration keys, all initially empty. For each of these four keys, a non-empty `.env` value wins; an empty value is ignored, so the compiler checks the same key in the process environment and then uses its existing resolution/default behavior. To customize a clone, replace only the values you need:

~~~dotenv
SITE_TITLE="My Markdown Site"
FOOTER_TEXT="Published from Markdown"
CONTENT_DIRECTORY="content"
PUBLIC_DIRECTORY="public"
~~~

The compiler parses the file with the `dotenv` library and resolves each exposed key in this order:

1. A non-empty value in `.env`.
2. The existing process environment.
3. The compiler's existing resolution and default behavior.

This priority list applies only to the four exposed keys. `VITE_BASE_PATH`, repository name, GitHub username/full name/actor, Host, Port, environment-file selectors, and test controls cannot be overridden by `.env`; the loader ignores those keys even if someone adds them manually. Their existing sources—such as process variables, GitHub Actions context, Git metadata, command-line arguments, and built-in defaults—remain unchanged.

The file itself is optional for other projects, and the existing environment-variable interface remains available. `ENV_FILE` selects a specific dotenv file and `ENV_DIRECTORY` selects a directory containing `.env`; these selectors are supplied by the shell or CI, not placed in the user-facing `.env`:

~~~bash
ENV_FILE="config/example.env" npm run build
ENV_DIRECTORY="config" npm run build
~~~

The same four allowed dotenv values are used by `npm run build`, the local launcher, Vite preview, and the GitHub Pages deployment build. Runtime tests use their own empty fixture file by default, and can explicitly select another environment file or directory with `RT_TEST_ENV_FILE` or `RT_TEST_ENV_DIRECTORY`. Test-only controls are never read from `.env`.

## Repository shape

- content/ contains the example Markdown site.
- public/assets/ contains browser-renderable source assets.
- src/ contains lexer token definitions and scanning, parsing, the normalized AST, JSON-like IR, Vue code generation, route resolution, and the build pipeline.
- styles/theme.less contains the editable colors, font families, font sizes, spacing, site chrome, and responsive theme rules.
- styles/markdown.less contains the stable Markdown and AST rendering contract. Leave it unchanged for ordinary theme customization.
- styles/site.less is the Less entrypoint that imports both layers.
- constants/ contains typed site and runtime values.
- dev/ contains compiler, launcher, and isolated runtime-test entrypoints.
- test/features/ contains the syntax contract fixtures and cross-stage static compiler tests; dynamic runtime fixtures remain under dev/.
- dist/ contains generated output and is never edited by hand.

## Commands

~~~bash
npm run check
npm run check:unused
npm test
npm run build
npm run dev
npm run rt-test
~~~

`npm run check` validates TypeScript types, while `npm run check:unused` additionally rejects unused TypeScript locals and parameters. `npm test` runs the static compiler-stage and build tests. `npm run build` compiles the current Markdown site from `content/` and `public/`; set `CONTENT_DIRECTORY` and `PUBLIC_DIRECTORY` when a different site should be compiled. `npm run rt-test` compiles disposable fixtures, serves the generated HTML, checks every page and asset over HTTP, and shuts the server down. Set `RT_TEST_ENV_FILE` or `RT_TEST_ENV_DIRECTORY` only when that dynamic test must exercise another dotenv file or root.

## Customize the theme

Edit `styles/theme.less` when changing colors, fonts, font sizes, spacing, header and footer appearance, tables, or responsive layout. This Less theme source is compiled into CSS at build time (`dist/assets/site.css`).

`styles/markdown.less` is protected because it keeps paragraphs, lists, code, tables, images, Ruby, and task items rendering consistently from the normalized AST. Leave it unchanged for ordinary theme work; change it only when you understand the effect on every Markdown document. `styles/site.less` should remain the two-file import boundary.
