# Quickstart

This repository turns Markdown content into a static Vue 3 website. Vue runs during the Node build through server-side rendering; the generated site contains HTML, CSS, and copied assets, not a browser application runtime.

Read [syntax.md](syntax.md) for the complete Markdown and frontmatter reference.

## Prerequisites

- Node.js 18.18 or newer
- npm

## Create a site

Clone the repository, install dependencies, and run the checks:

~~~bash
npm install
npm run check
npm test
~~~

The example site is authored in content/. Replace those files with your own pages when adopting the template. The compiler does not require the example titles, routes, or collection names.

The template defaults to English; content may use other languages.

## Add a page

Create a Markdown file anywhere under content/. The file path becomes the browser path:

~~~text
content/index.md                  -> /
content/about.md                  -> /about/
content/guides/first-step.md      -> /guides/first-step/
~~~

Use YAML frontmatter for page metadata:

~~~markdown
---
title: About the project
description: A short description for navigation and document metadata.
tags:
  - guide
---

# About the project

Write the page body here.
~~~

The title priority is frontmatter `title`, then the first level-one heading, then the file name. Frontmatter `description` is used as the page summary; if it is absent, the first paragraph is used as the summary. `draft` defaults to `false`; set it to `true` when a Markdown file should stay out of the generated site.

## Link pages

Use route names in Markdown instead of generated HTML filenames:

~~~markdown
[Home](route:index)
[About](route:about)
[Nested guide](route:guides:first-step)
~~~

Route names use colons for logical hierarchy. Generated links are root-relative slash paths, so the nested guide becomes /guides/first-step/. The empty route name and the home alias also resolve to the root page.

Normal Markdown links such as `https://...` and `mailto:...` remain external links. Root-relative links such as `/feed.xml` are suitable for RSS and receive the configured repository base path during a GitHub Pages build.

## Create a collection

A page can become the head of a collection by declaring a source directory:

~~~yaml
---
title: Field notes
type: list
source: blogs/
---
~~~

Every published Markdown file under blogs/ becomes a collection item. A collection item can also declare type: list and its own source directory, which creates a nested list. A nested route such as blogs/series/first-step.md has the logical name blogs:series:first-step.

Use indexed when order matters:

~~~yaml
indexed: 0
~~~

Indexed items sort by ascending number, including zero, and appear before items without `indexed`. Use it when a collection or top-level navigation needs a deliberate order. Items without `indexed` follow in alphabetical title order.

## Add an asset

Place browser-renderable images under public/assets/:

~~~text
public/assets/icons/marker.svg
~~~

Reference the asset with its path relative to the assets directory:

~~~markdown
[Open the marker](asset:icons/marker.svg)
![Marker](asset:icons/marker.svg)
![Marker with a maximum width](asset:icons/marker.svg){max-width=30%}
![Marker with a forced width](asset:icons/marker.svg){width=25%}
~~~

Supported image extensions are AVIF, GIF, JPEG, JPG, PNG, SVG, and WebP. Asset URLs are emitted as root-relative paths under /assets/. Traversal paths and unsupported file types are rejected. Use one sizing declaration per image. With no declaration, the rendered width is `min(intrinsic width, 40% of the content column)`, where 40% comes from `CONTENT_IMAGE_MAX_WIDTH_PERCENT`. `max-width=<percent>%` changes that cap, while `width=<percent>%` forces the declared percentage and overrides the default cap. Width declarations are limited to 0% through 100%. A paragraph containing only images is centered by default; use a native `<div align="left">`, `<div align="center">`, or `<div align="right">` wrapper to override that alignment. Images receive vertical spacing so adjacent images do not touch.

GitHub-Flavored Markdown tables render as static HTML tables. Customize their borders, header appearance, typography, and cell spacing with the table variables in `styles/theme.less`.

## Configure the site

Site values can be overridden during a build:

~~~bash
SITE_TITLE="Personal Blog" \
GITHUB_USERNAME="your-name" \
FOOTER_TEXT="Published from Markdown" \
npm run build
~~~

An empty `FOOTER_TEXT` uses the fixed template attribution. Set it to `null` or `nil` to remove the footer component and its top border entirely.

For a repository-scoped host such as GitHub Pages, set the base path to the repository name:

~~~bash
VITE_BASE_PATH="/repository-name/" npm run build
~~~

The same value can be passed as `npm run build -- --base /repository-name/`; the command-line value takes precedence. The GitHub Pages workflow supplies the repository name automatically, along with `GITHUB_USERNAME` and `GITHUB_USER_FULL_NAME`, so a cloned repository does not need hardcoded identity values.

The build input roots are configurable as well. This is useful for a separate site, a preview, or an isolated test fixture:

~~~bash
CONTENT_DIRECTORY=site-content \
PUBLIC_DIRECTORY=site-public \
npm run build
~~~

When `npm run dev` is used locally, the launcher inspects the Git remote. A GitHub remote supplies the short username and the local Git display name; a non-GitHub remote leaves the username empty and hides the GitHub action. For direct builds, provide the identity values through the environment instead of hardcoding them in the template.

## Change the template

- Change colors, font families, font sizes, spacing, site chrome, and responsive theme behavior in styles/theme.less.
- Keep styles/markdown.less unchanged during normal theme work; it is the stable Markdown and AST rendering contract.
- Keep styles/site.less as the import entrypoint for both Less layers.
- Change document structure in src/renderer/vue/templates.ts.
- Extend Markdown-to-AST conversion in src/parser/markdown-parser.ts.
- Add AST rendering behavior in src/renderer/vue/ast-renderer.ts.
- Add site and runtime integration values under constants/.
- Add focused tests under test/.

Keep the parser, normalized AST, Vue renderer, and static build as separate stages. Do not move Markdown parsing or application logic into the browser.

## Build and preview

Build the deployable site:

~~~bash
npm run build
~~~

The output is in dist/. It can be deployed to any static host.

## Deploy to GitHub Pages

Pushes to `main` run `.github/workflows/deploy.yml`. The workflow runs `npm test` and `npm run rt-test` before building, uses the current repository name as the base path, and publishes `dist/` to the `deploy` branch with a `.nojekyll` marker. If either test fails, the build and deployment steps do not run.

Start the local Vite preview after compiling:

~~~bash
npm run dev
~~~

Run the isolated runtime smoke test:

~~~bash
npm run rt-test
~~~

The runtime test uses disposable fixtures in dev/rt-test/fixtures/, checks every generated fixture page and its nested SVG asset, then stops Vite automatically. It does not read or modify the example content/.
