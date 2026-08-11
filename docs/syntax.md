# Markdown Syntax

This compiler accepts Markdown with YAML frontmatter and a small set of typed extensions. Each syntax form below describes the source form it accepts and the static HTML behavior it produces.

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
- `type`: `page` or `list`. The default is `page`; a non-root directory `index.md` is implicitly a `list` for its containing directory. The root `index.md` is not implicitly a list.
- `source`: collection directory for a `list` page, such as `blogs/`. A `list` page outside a non-root directory index must declare it; a non-root directory index must not declare it.
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

The root `index.md` and the empty route are the same ordinary root page unless the root page explicitly declares a list source. `index.md` inside a directory owns that directory route and is implicitly the list head for that directory. Generated links are root-relative slash paths and include the configured repository base path when one is set.

An `index.md` under a top-level directory is a root navigation entry, not a child item. For example, `blogs/index.md` owns `/blogs/` and can be reached from the root navigation; `blogs/series/index.md` owns `/blogs/series/` and remains a nested route.

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

Every published Markdown file below `blogs/` other than directory index heads becomes an item. A list item may also declare its own `type: list` and `source`, so the same document can be a list object and the head of a nested list. The compiler infers the page structure from the path and these declarations.

An external list head may use the same user-facing root name as its source directory (`blogs.md` with `source: blogs/`) or a different name (`blog.md` with `source: blogs/`).

Choose exactly one collection-head form for a source directory. These are separate alternatives:

External head with the same user-facing root name:

~~~text
blogs.md  (type: list, source: blogs/) -> /blogs/
~~~

External head with a different user-facing root name:

~~~text
blog.md   (type: list, source: blogs/) -> /blog/
~~~

Directory-owned head with the directory's own root name:

~~~text
blogs/index.md  (implicit list of blogs/) -> /blogs/
~~~

Any external list-head form and `blogs/index.md` conflict when they target `blogs/`; choose one. A non-root directory `index.md` is already a list head for its own directory, so it must not declare `type: page` or any explicit `source` (including `source: blogs/`). The directory-index form is the canonical route for that directory, appears in the root navigation when it is top-level, and is never inserted as its own collection item. The same rule applies at nested levels, such as `blogs/series/index.md`, which implicitly lists `blogs/series/`.

Collection order is deterministic:

1. Documents with `indexed` come first in ascending numeric order.
2. Documents without `indexed` follow in alphabetical title order.
3. Source paths break ties between equal titles.

`indexed: 0` is valid for a root page, a directory index, or a collection item. Ordering is applied independently at each level: root navigation sorts its own route entries, while each collection sorts its direct items. Directory index pages are heads and are excluded from their parent collection's item list.

## Assets And Images

Put browser-renderable assets under `public/assets/` and address them relative to that directory:

~~~markdown
[Open the marker](asset:icons/marker.svg)
![Marker](asset:icons/marker.svg)
~~~

Supported image extensions are AVIF, GIF, JPEG, JPG, PNG, SVG, and WebP. Traversal paths and unsupported file types fail during compilation. The compiler copies assets into `dist/assets/` and emits root-relative URLs.

Images may also use an external URL. The URL is kept as the rendered `src` and the browser attempts to load it:

~~~markdown
![Remote marker](https://example.com/marker.svg)
~~~

Unsafe URL schemes cause compilation to fail and are never emitted.

An image can declare either a maximum width or a forced width immediately after the image:

~~~markdown
![Capped marker](asset:icons/marker.svg){max-width=30%}
![Forced marker](asset:icons/marker.svg){width=25%}
~~~

The equivalent whitelisted HTML image form uses a numeric `width` or `max-width` attribute, or the same declaration in `style`. In HTML, the numeric value that corresponds to the Markdown percentage uses the `vw` unit:

~~~html
<img src="https://example.com/marker.svg" alt="Capped marker" style="max-width: 30vw">
<img src="asset:icons/marker.svg" alt="Forced marker" width="25vw">
~~~

For this whitelist, HTML image sizing accepts numeric `%` or `vw` values; a Markdown `{max-width=30%}` and HTML `max-width: 30vw` normalize to the same semantic size, as do `{width=25%}` and HTML `width: 25vw`. Values such as `25px` or `25vh` are rejected rather than interpreted as image sizing.

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
| Heading | Static heading element |
| Image | Static image element |
~~~~

Fenced code may use backticks or tildes. A language marker produces a
multi-line code block with a `language-*` class; without a language marker the
content remains a plain code block with no language class:

~~~~markdown
```ts
const typed: string = "language-marked";
```

~~~
plain code without a language marker
~~~
~~~~

Fence markers use at least three matching backticks or tildes. When a code
example contains a three-character fence, wrap the whole example in a
four-character fence and close it with the matching four-character marker.
The inner three-character markers then remain literal code content.

Task list checkboxes and thematic breaks are also supported.

GitHub-Flavored Markdown tables become static HTML `<table>` elements with `<thead>` and `<tbody>` sections. Table borders, header colors, header background, font sizes, and cell spacing are editable through the table variables in `styles/theme.less`; the selectors and rendering contract remain in `styles/markdown.less`.

Markdown headings and native `<h1>` through `<h5>` blocks render as the corresponding static heading element, preserving their depth. Native headings and alignment wrappers can be composed, and the resulting rendered semantics are the same as their Markdown equivalents:

~~~markdown
# Markdown heading

<h2>Native HTML heading</h2>

<div align="center"><h2>Centered native heading</h2></div>
~~~

## Whitelisted HTML Equivalents

HTML is accepted only when its tag represents a Markdown behavior already supported by this compiler. The following inline forms normalize to the same behavior as Markdown:

~~~html
<strong>strong</strong>       <!-- **strong** -->
<b>bold</b>                   <!-- **bold** -->
<em>emphasis</em>             <!-- *emphasis* -->
<i>italic</i>                 <!-- *italic* -->
<del>deleted</del>            <!-- ~~deleted~~ -->
<s>struck</s>                 <!-- ~~struck~~ -->
<strike>strike</strike>       <!-- ~~strike~~ -->
<code>inline code</code>      <!-- `inline code` -->
<tt>inline code</tt>          <!-- `inline code` -->
<a href="route:index">home</a> <!-- [home](route:index) -->
<br>                          <!-- hard line break -->
<img src="https://example.com/a.png" alt="image">
~~~

The block equivalents are `<p>`, `<h1>` through `<h5>`, `<blockquote>`, `<ul>`, `<ol>`, `<li>`, `<pre><code>`, `<table>` with rows/cells, `<hr>`, and the supported alignment `<div>`. Their attributes are interpreted only when they map to an existing Markdown meaning, such as `ol start`, `code class="language-*"`, table alignment, or percentage image sizing. The inline aliases `<b>`, `<i>`, `<s>`, and `<strike>` normalize to the same semantics as their Markdown forms.

`<tt>` is also whitelisted as an inline-code equivalent of `<code>` and
Markdown backtick code. `<div>`, `<img>`, and `<ruby>` produce the same
supported semantic and static HTML behavior as their corresponding extensions;
an image's supported percentage sizing follows the same rules as the Markdown
image extension.

## Ruby Annotations

Ruby is a whitelisted inline HTML extension. It renders as a `<ruby>` element with an `<rt>` annotation:

~~~markdown
<ruby>typed<rt>annotation</rt></ruby>
~~~

Other raw HTML is escaped as text. Whitelisted tags produce the same supported rendering behavior as Markdown; arbitrary HTML is never passed through to the generated site. Application JavaScript is not executed in the browser.

HTML comments such as `<!-- author note -->` are ignored and do not appear in the generated HTML.

## Rejected And Escaped Forms

Unsupported HTML is rendered as text rather than interpreted:

~~~html
<script>alert("escaped")</script>
<iframe src="https://example.com">frame</iframe>
~~~

The generated content contains escaped text such as `&lt;script&gt;...` and no executable HTML element. Unsafe `javascript:` and similar URL schemes fail compilation. Asset traversal, unsupported asset extensions, image widths outside `0%`–`100%`, duplicate image sizing declarations, and unsupported image sizing units such as `25px` or `25vh` also fail compilation. A non-root directory index cannot declare `type: page` or an explicit `source`.
