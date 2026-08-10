# Typed Markdown Compiler

This repository is a Vue 3 template for compiling Markdown into a static website. Every Markdown file is parsed into a normalized TypeScript AST before Vue SSR produces HTML. Vue, the Markdown parser, and the compiler are build-time dependencies; they are not shipped to the browser.

The default document language is English, while multilingual Markdown content remains supported.

## Start here

For the normal beginner workflow, clone the repository, edit the Markdown under `content/`, commit your changes, and push them to the `main` branch. GitHub Actions runs the tests and builds the site automatically; if the syntax or build fails, the workflow stops and does not deploy a broken site.

Markdown in `content/` is compiled into static HTML during the build. You can write your pages as Markdown without manually writing the generated HTML.

## Documentation

- [Quickstart](quickstart.md) covers installation, authoring, configuration, testing, and deployment.
- [Markdown syntax](syntax.md) defines frontmatter, routes, collections, assets, images, and supported blocks.
- [AGENTS.md](AGENTS.md) records the engineering rules and architecture boundaries.
- [CONTRIBUTING.md](CONTRIBUTING.md) defines commit and pull request requirements.

## Quick start

~~~bash
npm install
npm run check
npm test
npm run build
~~~

The generated site is written to dist/. Deploy that directory to GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static host. GitHub Pages deployment is configured in `.github/workflows/deploy.yml`; it supplies the repository-scoped base path automatically.

## Repository shape

- content/ contains the example Markdown site.
- public/assets/ contains browser-renderable source assets.
- src/ contains the parser, normalized AST, route resolver, Vue renderer, and build pipeline.
- styles/theme.less contains the editable colors, font families, font sizes, spacing, site chrome, and responsive theme rules.
- styles/markdown.less contains the stable Markdown and AST rendering contract. Leave it unchanged for ordinary theme customization.
- styles/site.less is the Less entrypoint that imports both layers.
- constants/ contains typed site and runtime values.
- dev/ contains compiler, launcher, and isolated runtime-test entrypoints.
- dist/ contains generated output and is never edited by hand.

## Commands

~~~bash
npm run check
npm test
npm run build
npm run dev
npm run rt-test
~~~

The default build reads content/ and public/. Set CONTENT_DIRECTORY and PUBLIC_DIRECTORY when a different site or fixture should be compiled. The runtime test uses dev/rt-test/fixtures/ so it remains independent from the example content.

## Customize the theme

Edit `styles/theme.less` when changing colors, fonts, font sizes, spacing, header and footer appearance, tables, or responsive layout. This Less theme source is compiled into CSS at build time (`dist/assets/site.css`).

`styles/markdown.less` is protected because it keeps paragraphs, lists, code, tables, images, Ruby, and task items rendering consistently from the normalized AST. Leave it unchanged for ordinary theme work; change it only when you understand the effect on every Markdown document. `styles/site.less` should remain the two-file import boundary.
