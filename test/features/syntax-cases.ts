export const inlineMarkdownSource = [
  "Intro.",
  "",
  "**bold *nested*** ~~gone **inside**~~ `literal <tag>` [**home**](route:index) ![remote](https://example.com/a.png \"remote\")  ",
  "next <ruby>typed<rt>annotation</rt></ruby>."
].join("\n");

export const blockMarkdownSource = [
  "Intro.",
  "",
  "## Heading *inline*",
  "",
  "- outer",
  "  - inner",
  "    1. deep",
  "- [x] task",
  "",
  "> quote **strong**",
  ">",
  "> - nested item",
  "",
  "~~~ts",
  "left < right",
  "~~~",
  "",
  "| Name | Meaning |",
  "| --- | :---: |",
  "| A | B |",
  "",
  "---"
].join("\n");

export const blockHtmlEquivalentSource = [
  "<p>Intro.</p>",
  "<h2>Heading <em>inline</em></h2>",
  "<ul><li><p>outer</p><ul><li><p>inner</p><ol><li><p>deep</p></li></ol></li></ul></li><li><input type=\"checkbox\" checked><p>task</p></li></ul>",
  "<blockquote><p>quote <strong>strong</strong></p><ul><li><p>nested item</p></li></ul></blockquote>",
  "<pre><code class=\"language-ts\">left &lt; right</code></pre>",
  "<table><thead><tr><th>Name</th><th align=\"center\">Meaning</th></tr></thead><tbody><tr><td>A</td><td align=\"center\">B</td></tr></tbody></table>",
  "<hr>"
].join("\n");

export const htmlDomSource = [
  '<div align="center">',
  "<h2>Heading <em>inline</em></h2>",
  "<blockquote><p>Quote <b>strong</b></p><ul><li>outer<ul><li>inner</li></ul></li></ul></blockquote>",
  '<ol start="3"><li><input type="checkbox" checked>task</li></ol>',
  '<pre><code class="language-ts">left &lt; right</code></pre>',
  '<table><thead><tr><th>Name</th><th align="center">Meaning</th></tr></thead><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
  "<hr>",
  '<p><b>bold</b> <i>emphasis</i> <s>gone</s> <code>literal &lt;tag&gt;</code> <a href="route:index"><em>home</em></a> <img src="https://example.com/a.png" alt="remote" title="remote"><br><ruby>typed<rt>annotation</rt></ruby></p>',
  "</div>"
].join("\n");

export const htmlSplitNestedListSource = [
  "<ul>",
  "",
  "<li>outer",
  "",
  "<ul>",
  "",
  "<li>inner</li>",
  "",
  "</ul>",
  "",
  "</li>",
  "",
  "</ul>"
].join("\n");

export const htmlCommentsSource = [
  "<!-- top-level comment -->",
  "Visible<!-- inline comment --> text",
  "",
  '<div align="center"><!-- nested comment --><p>Visible HTML</p></div>'
].join("\n");

export const inlineHtmlEquivalentSource = [
  "Intro.",
  "",
  '<strong>bold <em>nested</em></strong> <del>gone <strong>inside</strong></del> <code>literal &lt;tag&gt;</code> <a href="route:index"><strong>home</strong></a> <img src="https://example.com/a.png" alt="remote" title="remote"><br>next <ruby>typed<rt>annotation</rt></ruby>.'
].join("\n");

export const inlineHtmlBoundarySource = [
  "## Heading <strong>bold</strong> and <em>emphasis</em>",
  "",
  "| Name | Meaning |",
  "| --- | --- |",
  "| <b>cell</b> | <tt>value</tt> |"
].join("\n");

export const frontmatterSource = [
  "---",
  "title: Feature page",
  "description: Feature description",
  "type: page",
  "date: 2026-08-11",
  "tags:",
  "  - compiler",
  "  - feature",
  "indexed: 0",
  "draft: false",
  "unknown: ignored",
  "---",
  "",
  "Content."
].join("\n");

export const headingMarkdownSource = [
  "Intro.",
  "",
  "# H1",
  "",
  "## H2",
  "",
  "### H3",
  "",
  "#### H4",
  "",
  "##### H5"
].join("\n");

export const headingHtmlSource = [
  "<p>Intro.</p>",
  "<h1>H1</h1>",
  "<h2>H2</h2>",
  "<h3>H3</h3>",
  "<h4>H4</h4>",
  "<h5>H5</h5>"
].join("\n");

export const imageMarkdownSource = [
  "[Marker](asset:icons/test-marker.svg)",
  "",
  "![Capped](asset:icons/test-marker.svg){max-width=30%}",
  "",
  "![Forced](asset:icons/test-marker.svg){width=25%}"
].join("\n");

export const imageHtmlSource = [
  '<p><a href="asset:icons/test-marker.svg">Marker</a></p>',
  "",
  '<img src="asset:icons/test-marker.svg" alt="Capped" style="max-width: 30vw">',
  "",
  '<img src="asset:icons/test-marker.svg" alt="Forced" width="25vw">'
].join("\n");

export const alignmentHtmlSource = [
  '<div align="left"><p>Left</p></div>',
  '<div style="text-align: center"><h2>Center</h2></div>',
  '<div align="right"><img src="asset:icons/test-marker.svg" alt="Right"></div>'
].join("\n");

export const htmlAliasSource = '<p><strong>strong</strong> <b>bold</b> <em>emphasis</em> <i>italic</i> <del>deleted</del> <s>struck</s> <strike>strike</strike> <code>code</code> <tt>tt</tt> <a href="route:index">home</a><br></p>';

export const htmlAliasMarkdownSource = '**strong** **bold** *emphasis* *italic* ~~deleted~~ ~~struck~~ ~~strike~~ `code` `tt` [home](route:index)<br>';

export const fencedCodeSource = [
  "```ts",
  "const marked: string = \"language\";",
  "```",
  "",
  "~~~",
  "plain < text",
  "~~~"
].join("\n");

export const nestedFencedCodeSource = [
  "~~~~markdown",
  "```ts",
  "const typed: string = \"language-marked\";",
  "```",
  "~~~",
  "plain code without a language marker",
  "~~~",
  "~~~~"
].join("\n");

export const nestedBacktickFencedCodeSource = [
  "````markdown",
  "~~~ts",
  "const typed: string = \"language-marked\";",
  "~~~",
  "```",
  "plain code without a language marker",
  "```",
  "````"
].join("\n");

export const listFrontmatterSource = [
  "---",
  "title: Collection",
  "type: list",
  "source: blogs/",
  "---",
  "",
  "# Collection"
].join("\n");
