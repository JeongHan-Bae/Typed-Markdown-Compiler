---
title: Why keep an AST in the middle
date: "2026-08-10"
indexed: 2
tags:
  - typescript
  - ast
---

# Why keep an AST in the middle

An intermediate tree gives route-aware links, collection indexes, and alternate renderers a stable place to work.

The current tree knows about paragraphs, headings, links, images, tables, code, and Ruby annotations. Route links remain typed targets until the resolver has a complete manifest.

<ruby>extensible<rt>typed</rt></ruby> does not have to mean unbounded `HTML` injection.
