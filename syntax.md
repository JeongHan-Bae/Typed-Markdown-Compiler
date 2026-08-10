# Markdown Syntax

This compiler accepts Markdown with YAML frontmatter and a small set of typed extensions. The parser converts the source into a normalized TypeScript AST before Vue renders the final static HTML.

## Frontmatter

Frontmatter is optional and must be enclosed by `---` lines:

~~~markdown
---
title: About the project
description: A short summary used by navigation and document metadata.
tags:
  - compiler
  - static-sites
date: 2026-08-10
indexed: 2
draft: false
---

Page content starts here.
~~~

Supported fields are:

- `title`: frontmatter wins first. If absent, the first level-one heading is used; if that is absent, the file name is used.
- `description`: frontmatter wins first and is used as the page summary. If absent, the first paragraph is used as the summary; if there is no paragraph, the summary is empty. The fallback is limited to 160 characters.
- `type`: `page` or `list`. The default is `page`.
- `source`: collection directory for a `list` page, such as `blogs/`.
- `date`: published date text for collection items.
- `tags`: a YAML string array rendered with collection items or article pages where applicable.
- `indexed`: optional numeric display order. Use it when pages or collection items need an explicit sequence, such as chronological or featured content. Lower numbers appear first, `0` is valid, and indexed entries appear before unindexed entries. Unindexed entries are sorted alphabetically by title; equal titles use the source path as a tie-breaker.
- `draft`: whether to publish the document. It defaults to `false`; set it to `true` to exclude the document from routes, collections, and generated HTML.

Unknown frontmatter fields are ignored.

## Pages And Routes

Every `.md` file under the configured content directory becomes a route unless it is a draft:

~~~text
content/index.md                  -> /
content/about.md                  -> /about/
content/guides/first-step.md      -> /guides/first-step/
content/guides/index.md           -> /guides/
~~~

The root `index.md` and the empty route are the same page. `index.md` inside a directory owns that directory route. Generated links are root-relative slash paths and include the configured repository base path when one is set.

Use `route:` targets for internal links. The route name uses colons instead of slashes:

~~~markdown
[Home](route:index)
[About](route:about)
[First step](route:guides:first-step)
~~~

`route:index`, `route:home`, and an empty route target resolve to the root page.

External links keep their normal Markdown targets. HTTPS links and mail links are emitted unchanged:

~~~markdown
[GitHub](https://github.com/example)
[Email](mailto:author@example.com)
[RSS](/feed.xml)
~~~

Use a root-relative target such as `/feed.xml` for an RSS endpoint supplied by the static host. When a repository base path is configured, root-relative generated links receive that base prefix; HTTPS and `mailto:` links remain external links.

## Collections

Declare a list head with `type: list` and `source`:

~~~markdown
---
title: Field notes
type: list
source: blogs/
---

# Field notes

Posts published in this directory appear below this page.
~~~

Every published Markdown file below `blogs/` becomes an item. A list item may also declare its own `type: list` and `source`, so the same document can be a list object and the head of a nested list. The compiler infers the page structure from the path and these declarations.

Collection order is deterministic:

1. Documents with `indexed` come first in ascending numeric order.
2. Documents without `indexed` follow in alphabetical title order.
3. Source paths break ties between equal titles.

## Assets And Images

Put browser-renderable assets under `public/assets/` and address them relative to that directory:

~~~markdown
[Open the marker](asset:icons/marker.svg)
![Marker](asset:icons/marker.svg)
~~~

Supported image extensions are AVIF, GIF, JPEG, JPG, PNG, SVG, and WebP. Traversal paths and unsupported file types fail during rendering. The compiler copies assets into `dist/assets/` and emits root-relative URLs.

An image can declare either a maximum width or a forced width immediately after the image:

~~~markdown
![Capped marker](asset:icons/marker.svg){max-width=30%}
![Forced marker](asset:icons/marker.svg){width=25%}
~~~


Use at most one sizing declaration on an image. Without a declaration, the actual width is the smaller of the image's intrinsic width and the default `CONTENT_IMAGE_MAX_WIDTH_PERCENT` cap of 40% of the content column. The 40% value is only a maximum, so a smaller image stays at its intrinsic size.

With `max-width=30%`, the actual width is the smaller of the intrinsic width and 30% of the content column. With `width=25%`, the width is 25% of the content column regardless of the intrinsic image width; the explicit width overrides the default 40% cap and remains limited to 100% of the content column.

A paragraph containing only images is centered by default. To preserve ordinary Markdown authoring, wrap an image paragraph in a native alignment `div` when it must be left-, center-, or right-aligned:

~~~markdown
<div align="left">

![Left marker](asset:icons/marker.svg){max-width=30%}

</div>

<div align="right">

![Right marker](asset:icons/marker.svg){width=25%}

</div>
~~~

The supported wrapper forms are `<div align="left|center|right">` and the equivalent `style="text-align: ..."` form. Images mixed with paragraph text remain left-aligned unless wrapped. Images have vertical spacing so adjacent images and surrounding paragraphs do not touch.

The same alignment wrappers apply to ordinary text and headings:

~~~markdown
<div align="center">

Centered paragraph and heading.

</div>
~~~

## Markdown Blocks

The compiler supports the common Markdown and GitHub Flavored Markdown blocks used by the template:

~~~~markdown
# Heading

Paragraph with **strong**, *emphasis*, ~~deletion~~, and `inline code`.

- Unordered item
- Another item

1. Ordered item
2. Another item

> A block quote.

~~~ts
const value: string = "typed";
~~~

| Name | Meaning |
| --- | --- |
| AST | Normalized content tree |
| SSR | Build-time HTML rendering |
~~~~

Task list checkboxes and thematic breaks are also supported.

GitHub-Flavored Markdown tables become static HTML `<table>` elements with `<thead>` and `<tbody>` sections. Table borders, header colors, header background, font sizes, and cell spacing are editable through the table tokens in `styles/theme.less`; the selectors and rendering contract remain in `styles/markdown.less`.

Markdown headings and native `<h1>` through `<h5>` blocks are normalized to the same `HeadingNode` shape in the AST. The heading depth is preserved, so both forms render as the corresponding static heading element:

~~~markdown
# Markdown heading

<h2>Native HTML heading</h2>
~~~

## Ruby Annotations

Ruby is the one intentional inline HTML extension. It is converted into a typed AST node rather than passed through as arbitrary HTML:

~~~markdown
<ruby>typed<rt>annotation</rt></ruby>
~~~

Other raw HTML is escaped as text. The alignment `div` wrapper is converted into a typed AST node; it does not pass arbitrary HTML through to the generated site. Application JavaScript is not executed in the browser.

## GitHub Identity And Avatar

During local preview, the launcher examines the Git remote. Only a GitHub remote supplies a short `GITHUB_USERNAME`; the local Git display name supplies the site title. A non-GitHub remote leaves the username empty, so the GitHub action and avatar are omitted. In GitHub Actions, the build receives `GITHUB_USERNAME` and `GITHUB_USER_FULL_NAME` from the workflow environment instead of reading the checkout's `.git` configuration. Do not hardcode a clone-specific username, full name, repository name, or avatar path in application defaults or tests.

When the build has a valid GitHub username and successfully downloads the avatar, it stores one username-specific file under `dist/assets/github/`. Every generated page's navigation header references that same local asset. If the username changes, the asset path changes with it; if the download is unavailable, no avatar is rendered.

## Route And Asset Rules

- Internal route names use `route:` and colon-separated logical segments.
- Asset names use `asset:` and forward-slash paths under `public/assets/`.
- Generated route and asset URLs begin at `/`.
- Markdown is parsed during the Node build; the browser receives static HTML and CSS only.
