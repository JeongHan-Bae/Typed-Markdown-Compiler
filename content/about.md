---
title: About this template
description: The repository keeps content, compilation, and presentation in clear layers.
draft: false
---

# About this template

The project is designed for people who write Markdown and deploy a finished website. A build creates a normalized AST, resolves routes, renders typed Vue components with SSR, and writes static files.

| Concern | Location |
| --- | --- |
| Content | content/ |
| Routes and lists | content/**/*.md |
| AST and parser | src/ast/ and src/parser/ |
| Vue page templates | src/renderer/vue/templates.ts |
| Less styles | styles/ |
| Generated site | dist/ |

The parser keeps syntax extensible. For example, `ruby` becomes a typed AST node instead of arbitrary HTML.

A list item may also be the head of another list. This example does not mount that nested shape; the disposable runtime fixture verifies it separately.
