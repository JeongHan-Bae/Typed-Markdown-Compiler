---
title: Build from Markdown
indexed: 0
description: A calm, typed pipeline from Markdown content to deployable static HTML.
---

# Build from Markdown

This site is produced in one Node build. Authors work in the content directory, while the compiler parses Markdown, resolves routes, renders Vue templates, and copies static assets.

The normalized AST keeps content structure separate from the final HTML presentation.

Read the [field notes](route:blog), learn [about this template](route:about), or return to the [home page](route:index).

Visit my [GitHub profile](https://github.com/JeongHan-Bae) or [send me an email](mailto:mastropseudo@gmail.com).

## Basic syntax

Markdown supports **strong text**, *emphasis*, ~~deleted text~~, and `inline code`.

- Unordered list items are supported.
- A second item can contain a [route link](route:about).

1. Ordered list items are supported.
2. Their start value is preserved.

> Block quotes are rendered as typed block nodes.

~~~ts
const routeName: string = "blogs:hello-world";
~~~

| Syntax | Result |
| --- | --- |
| Heading | Structured heading node |
| Image | Validated asset node |
| Route | Root-relative link |

- [x] Parse source into a normalized AST.
- [ ] Render the AST during the Node build.

---

Ruby annotations are typed inline extensions: <ruby>typed<rt>annotation</rt></ruby>.

## Image layout examples

Each example below is a syntax marker image in its own paragraph. A standalone image is centered by default and has space around it. Images mixed with text keep the normal left alignment.

### Default image — intrinsic size, centered

This is the default syntax marker. It uses the intrinsic image size and the default content-column cap.

![Syntax marker, default size, centered](asset:icons/syntax-marker.svg)

### Maximum width — 24%, left-aligned

This syntax marker uses `max-width=24%` and is placed in a normal left-aligned `div` wrapper.

<div align="left">

![Syntax marker, max-width 24%, left-aligned](asset:icons/syntax-marker.svg){max-width=24%}

</div>

### Forced width — 18%, right-aligned

This syntax marker uses `width=18%`, forcing its rendered width, and is placed in a right-aligned `div` wrapper.

<div align="right">

![Syntax marker, width 18%, right-aligned](asset:icons/syntax-marker.svg){width=18%}

</div>

This example keeps the sample collection flat. Nested collections are supported and are covered by the isolated runtime fixture.
