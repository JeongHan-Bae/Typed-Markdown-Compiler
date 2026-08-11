---
title: Runtime syntax
description: A disposable page that exercises the documented syntax contract.
date: 2026-08-11
tags:
  - syntax
---

# Runtime syntax

<!-- top-level runtime comment -->

![Runtime marker](asset:icons/runtime-marker.svg)

Route checks: [root](route:index) and [nested leaf](route:entries:branch:leaf).<!-- inline runtime comment -->

## Markdown syntax

**strong** *emphasis* ~~deleted~~ `inline code` [root](route:index) ![external](https://example.com/external.png)

- unordered
  - nested unordered
- [x] task

1. ordered
2. second

> quote with **strong**

```ts
const dynamic: string = "typed";
```

~~~
plain dynamic code
~~~

| Syntax | Result |
| --- | :---: |
| Table | Static HTML |

---

<div style="text-align: center">
<!-- nested runtime comment -->
<h1>HTML H1</h1>
<h2>HTML H2</h2>
<h3>HTML H3</h3>
<h4>HTML H4</h4>
<h5>HTML H5</h5>
</div>

<div align="left"><p>Left aligned HTML</p></div>
<div align="right"><p>Right aligned HTML</p></div>

<blockquote><p>HTML quote <strong>strong</strong></p></blockquote>

<ul><li>HTML outer<ul><li>HTML inner</li></ul></li></ul>

<ol start="3"><li>HTML ordered</li></ol>

<pre><code class="language-ts">const html: string = "typed";</code></pre>

<table><thead><tr><th>Name</th><th align="center">Meaning</th></tr></thead><tbody><tr><td>DOM</td><td align="center">Tree</td></tr></tbody></table>

<p><strong>strong</strong> <b>bold</b> <em>emphasis</em> <i>italic</i> <del>deleted</del> <s>struck</s> <strike>strike</strike> <code>code</code> <tt>tt</tt> <a href="route:index">home</a><br><ruby>typed<rt>annotation</rt></ruby></p>

<img src="https://example.com/external.png" alt="external-max" style="max-width: 30vw">
<img src="https://example.com/external.png" alt="external-force" style="width: 25vw">

<hr>

<script>alert("escaped")</script>

~~~~markdown
```ts
const nested: string = "backtick";
```

~~~
plain nested code
~~~
~~~~

````markdown
~~~ts
const nestedBacktick: string = "tilde";
~~~

```
plain nested backtick code
```
````
