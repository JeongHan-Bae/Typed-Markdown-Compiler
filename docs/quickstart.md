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
npm run check:unused
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

Every published Markdown file under blogs/ other than directory index heads becomes a collection item. A collection item can also declare type: list and its own source directory, which creates a nested list. A nested route such as blogs/series/first-step.md has the logical name blogs:series:first-step.

An external list head may use the same user-facing root name as its source directory (`blogs.md` with `source: blogs/`) or a different name (`blog.md` with `source: blogs/`).

For a directory-owned collection head, use `blogs/index.md` (a directory index is implicitly a list of `blogs/`). It owns `/blogs/`, appears in root navigation when `blogs/` is top-level, and is not itself a collection item. A directory index can only use the directory's own root name. Do not set `type: page` or an explicit `source` on that index, and do not also create an external list head with `source: blogs/`; those heads conflict.

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
FOOTER_TEXT="Published from Markdown" \
npm run build
~~~

The repository includes a root `.env` file containing only four user-facing keys, all set to an empty string. The compiler parses it with the `dotenv` library. For these four keys only, a non-empty file value takes precedence over the same process variable. An empty file value does nothing, so the process variable and then the compiler's existing resolution/default behavior remain available.

~~~dotenv
SITE_TITLE="My Markdown Site"
FOOTER_TEXT="Published from Markdown"
CONTENT_DIRECTORY="content"
PUBLIC_DIRECTORY="public"
~~~

The root `.env` is loaded by the build, local launcher, Vite preview, and GitHub Pages build. The four-key priority above does not apply to protected pipeline values. `VITE_BASE_PATH`, repository name, GitHub identity, Host/Port, environment-file selectors, and runtime-test controls cannot be overridden by `.env`; adding those keys to the file has no effect. They retain their existing process, GitHub Actions, Git, command-line, and default sources.

Use `ENV_FILE` to select a specific dotenv file or `ENV_DIRECTORY` to select a directory containing `.env`; supply these selectors from the shell or CI, not from `.env` itself:

~~~bash
ENV_FILE="config/example.env" npm run build
ENV_DIRECTORY="config" npm run build
~~~

For the runtime smoke test, `RT_TEST_ENV_FILE` and `RT_TEST_ENV_DIRECTORY` select the environment file or directory used by the disposable compilation. If neither is supplied, the test selects `dev/rt-test/fixtures/env/empty.env`, so a user's root `.env` cannot redirect the disposable fixture build. Test-only settings remain script/CI inputs, not user `.env` settings.

The repository's configuration fixture can be exercised dynamically with explicit expected values:

~~~bash
RT_TEST_ENV_FILE="dev/rt-test/fixtures/env/override.env" \
RT_TEST_EXPECTED_SITE_TITLE="Dotenv fixture site" \
RT_TEST_EXPECTED_FOOTER_TEXT="Dotenv fixture footer" \
npm run rt-test
~~~

An empty `FOOTER_TEXT` uses the fixed template attribution. Set it to `null` or `nil` to remove the footer component and its top border entirely.

For a repository-scoped host such as GitHub Pages, set the base path to the repository name:

~~~bash
VITE_BASE_PATH="/repository-name/" npm run build
~~~

The same value can be passed as `npm run build -- --base /repository-name/`; the command-line value takes precedence. For GitHub Pages, leave this unset: the workflow supplies the repository name automatically, along with `GITHUB_USERNAME` and `GITHUB_USER_FULL_NAME`, so the current repository remains the source of truth for deployment identity and base paths.

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
- Read [Architecture](architecture.md) before changing compiler stages or their boundaries.
- Add site and runtime integration values under constants/.
- Add focused tests under test/.

The compiler boundaries and data contracts are documented in [Architecture](architecture.md). Markdown parsing and application logic stay in the Node build; they are not moved into the browser.

## Build and preview

Build the deployable site:

~~~bash
npm run build
~~~

The output is in dist/. It can be deployed to any static host.

## Deploy to GitHub Pages

Pushes to `main` run `.github/workflows/deploy.yml`. The workflow runs the unused-code check, `npm test`, and `npm run rt-test` before compiling the current Markdown with `npm run build`. It uses the current repository name as the base path and publishes `dist/` to the `deploy` branch with a `.nojekyll` marker. If a check fails, deployment does not run.

Start the local Vite preview after compiling:

~~~bash
npm run dev
~~~

Run the isolated runtime smoke test:

~~~bash
npm run rt-test
~~~

The runtime test uses disposable fixtures in dev/rt-test/fixtures/, checks every generated fixture page and its nested SVG asset, exercises the documented syntax page, verifies that the draft fixture is not routable, and then stops Vite automatically. It does not read or modify the example content/.
