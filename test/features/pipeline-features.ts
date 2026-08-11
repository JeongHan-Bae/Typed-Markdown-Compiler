import type { BlockNode, RootNode } from "../../src/ast/types.ts";
import type { IrNode } from "../../src/ir/types.ts";
import { TokenKind, type TokenKind as TokenKindValue } from "../../src/tokens/types.ts";
import {
  alignmentHtmlSource,
  blockHtmlEquivalentSource,
  blockMarkdownSource,
  frontmatterSource,
  headingHtmlSource,
  headingMarkdownSource,
  htmlAliasSource,
  htmlCommentsSource,
  htmlDomSource,
  htmlSplitNestedListSource,
  fencedCodeSource,
  imageHtmlSource,
  imageMarkdownSource,
  inlineHtmlEquivalentSource,
  inlineHtmlBoundarySource,
  inlineMarkdownSource,
  nestedBacktickFencedCodeSource,
  htmlAliasMarkdownSource,
  nestedFencedCodeSource,
  listFrontmatterSource
} from "./syntax-cases.ts";

export interface PipelineFeatureExpected {
  tokenKinds: readonly TokenKindValue[];
  syntaxNodeTypes: readonly string[];
  astChildTypes: readonly BlockNode["type"][];
  irTags: readonly string[];
  vnodeTags: readonly string[];
  html: string;
  ast?: RootNode;
  ir?: IrNode[];
  htmlTreeTags?: readonly string[];
}

export interface PipelineFeature {
  id: string;
  source: string;
  sourcePath: string;
  slug: string;
  coverage: readonly string[];
  expected: PipelineFeatureExpected;
}

export interface PipelineEquivalenceFeature {
  id: string;
  markdownSource: string;
  htmlSource: string;
  coverage: readonly string[];
}

const inlineAst: RootNode = {
  type: "root",
  children: [
    {
      type: "paragraph",
      children: [{ type: "text", value: "Intro." }]
    },
    {
      type: "paragraph",
      children: [
        {
          type: "strong",
          children: [
            { type: "text", value: "bold " },
            { type: "emphasis", children: [{ type: "text", value: "nested" }] }
          ]
        },
        { type: "text", value: " " },
        {
          type: "delete",
          children: [
            { type: "text", value: "gone " },
            { type: "strong", children: [{ type: "text", value: "inside" }] }
          ]
        },
        { type: "text", value: " " },
        { type: "inline-code", value: "literal <tag>" },
        { type: "text", value: " " },
        {
          type: "link",
          target: { type: "route", name: "index" },
          title: null,
          children: [{ type: "strong", children: [{ type: "text", value: "home" }] }]
        },
        { type: "text", value: " " },
        {
          type: "image",
          src: "https://example.com/a.png",
          alt: "remote",
          title: "remote"
        },
        { type: "break" },
        { type: "text", value: "next " },
        { type: "ruby", base: "typed", annotation: "annotation" },
        { type: "text", value: "." }
      ]
    }
  ]
};

const inlineIr: IrNode[] = [
  {
    kind: "element",
    tag: "p",
    children: [{ kind: "text", value: "Intro." }]
  },
  {
    kind: "element",
    tag: "p",
    props: { class: "image-paragraph image-paragraph--mixed" },
    children: [
      {
        kind: "element",
        tag: "strong",
        children: [
          { kind: "text", value: "bold " },
          {
            kind: "element",
            tag: "em",
            children: [{ kind: "text", value: "nested" }]
          }
        ]
      },
      { kind: "text", value: " " },
      {
        kind: "element",
        tag: "del",
        children: [
          { kind: "text", value: "gone " },
          {
            kind: "element",
            tag: "strong",
            children: [{ kind: "text", value: "inside" }]
          }
        ]
      },
      { kind: "text", value: " " },
      {
        kind: "element",
        tag: "code",
        children: [{ kind: "text", value: "literal <tag>" }]
      },
      { kind: "text", value: " " },
      {
        kind: "element",
        tag: "a",
        props: { href: "/" },
        children: [
          {
            kind: "element",
            tag: "strong",
            children: [{ kind: "text", value: "home" }]
          }
        ]
      },
      { kind: "text", value: " " },
      {
        kind: "element",
        tag: "img",
        props: {
          src: "https://example.com/a.png",
          alt: "remote",
          title: "remote"
        },
        children: []
      },
      { kind: "element", tag: "br", children: [] },
      { kind: "text", value: "next " },
      {
        kind: "element",
        tag: "ruby",
        children: [
          { kind: "text", value: "typed" },
          {
            kind: "element",
            tag: "rt",
            children: [{ kind: "text", value: "annotation" }]
          }
        ]
      },
      { kind: "text", value: "." }
    ]
  }
];

export const pipelineFeatures: readonly PipelineFeature[] = [
  {
    id: "markdown-inline-nesting",
    source: inlineMarkdownSource,
    sourcePath: "features/inline.md",
    slug: "inline",
    coverage: [
      "paragraph",
      "strong",
      "emphasis",
      "delete",
      "inline-code",
      "link-route",
      "image-external",
      "hard-break",
      "ruby",
      "inline-nesting"
    ],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph", "paragraph"],
      astChildTypes: ["paragraph", "paragraph"],
      irTags: ["p", "p", "strong", "em", "del", "strong", "code", "a", "strong", "img", "br", "ruby", "rt"],
      vnodeTags: ["p", "p", "strong", "em", "del", "strong", "code", "a", "strong", "img", "br", "ruby", "rt"],
      html: "<div><p>Intro.</p><p class=\"image-paragraph image-paragraph--mixed\"><strong>bold <em>nested</em></strong> <del>gone <strong>inside</strong></del> <code>literal &lt;tag&gt;</code> <a href=\"/\"><strong>home</strong></a> <img src=\"https://example.com/a.png\" alt=\"remote\" title=\"remote\"><br>next <ruby>typed<rt>annotation</rt></ruby>.</p></div>",
      ast: inlineAst,
      ir: inlineIr
    }
  },
  {
    id: "markdown-block-nesting",
    source: blockMarkdownSource,
    sourcePath: "features/blocks.md",
    slug: "blocks",
    coverage: [
      "heading",
      "unordered-list",
      "ordered-list",
      "nested-list",
      "task-list",
      "blockquote",
      "fenced-code",
      "table",
      "table-alignment",
      "thematic-break",
      "block-nesting"
    ],
    expected: {
      tokenKinds: [
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.eof
      ],
      syntaxNodeTypes: ["paragraph", "heading", "list", "blockquote", "code-block", "table", "thematic-break"],
      astChildTypes: ["paragraph", "heading", "list", "blockquote", "code-block", "table", "thematic-break"],
      irTags: ["p", "h2", "em", "ul", "li", "p", "ul", "li", "p", "ol", "li", "p", "li", "input", "div", "p", "blockquote", "p", "strong", "ul", "li", "p", "pre", "code", "div", "table", "thead", "tr", "th", "th", "tbody", "tr", "td", "td", "hr"],
      vnodeTags: ["p", "h2", "em", "ul", "li", "p", "ul", "li", "p", "ol", "li", "p", "li", "input", "div", "p", "blockquote", "p", "strong", "ul", "li", "p", "pre", "code", "div", "table", "thead", "tr", "th", "th", "tbody", "tr", "td", "td", "hr"],
      html: "<div><p>Intro.</p><h2>Heading <em>inline</em></h2><ul><li><p>outer</p><ul><li><p>inner</p><ol><li><p>deep</p></li></ol></li></ul></li><li class=\"task-item\"><input class=\"task-checkbox\" type=\"checkbox\" disabled checked><div class=\"task-item__content\"><p>task</p></div></li></ul><blockquote><p>quote <strong>strong</strong></p><ul><li><p>nested item</p></li></ul></blockquote><pre><code class=\"language-ts\">left &lt; right</code></pre><div class=\"table-scroll\"><table><thead><tr><th>Name</th><th align=\"center\">Meaning</th></tr></thead><tbody><tr><td>A</td><td align=\"center\">B</td></tr></tbody></table></div><hr></div>"
    }
  },
  {
    id: "inline-html-dom-boundary",
    source: inlineHtmlBoundarySource,
    sourcePath: "features/inline-html-boundary.md",
    slug: "inline-html-boundary",
    coverage: ["html-inline-heading", "html-inline-table", "html-inline-nesting"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["heading", "table"],
      astChildTypes: ["heading", "table"],
      irTags: ["h2", "strong", "em", "div", "table", "thead", "tr", "th", "th", "tbody", "tr", "td", "strong", "td", "code"],
      vnodeTags: ["h2", "strong", "em", "div", "table", "thead", "tr", "th", "th", "tbody", "tr", "td", "strong", "td", "code"],
      html: "<div><h2>Heading <strong>bold</strong> and <em>emphasis</em></h2><div class=\"table-scroll\"><table><thead><tr><th>Name</th><th>Meaning</th></tr></thead><tbody><tr><td><strong>cell</strong></td><td><code>value</code></td></tr></tbody></table></div></div>"
    }
  },
  {
    id: "html-dom-nesting",
    source: htmlDomSource,
    sourcePath: "features/html.md",
    slug: "html",
    coverage: [
      "html-dom-tree",
      "html-div-alignment",
      "html-h2",
      "html-blockquote",
      "html-ul",
      "html-ol",
      "html-ol-start",
      "html-li",
      "html-task-input",
      "html-pre-code",
      "html-table",
      "html-tr",
      "html-th",
      "html-td",
      "html-hr",
      "html-p",
      "html-strong",
      "html-b",
      "html-em",
      "html-i",
      "html-del",
      "html-s",
      "html-code",
      "html-a",
      "html-img",
      "html-br",
      "html-ruby",
      "html-nesting"
    ],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["content-alignment"],
      irTags: ["div", "h2", "em", "blockquote", "p", "strong", "ul", "li", "p", "ul", "li", "p", "ol", "li", "input", "div", "p", "pre", "code", "div", "table", "thead", "tr", "th", "th", "tbody", "tr", "td", "td", "hr", "p", "strong", "em", "del", "code", "a", "em", "img", "br", "ruby", "rt"],
      vnodeTags: ["div", "h2", "em", "blockquote", "p", "strong", "ul", "li", "p", "ul", "li", "p", "ol", "li", "input", "div", "p", "pre", "code", "div", "table", "thead", "tr", "th", "th", "tbody", "tr", "td", "td", "hr", "p", "strong", "em", "del", "code", "a", "em", "img", "br", "ruby", "rt"],
      html: "<div><div class=\"content-alignment content-alignment--center\"><h2>Heading <em>inline</em></h2><blockquote><p>Quote <strong>strong</strong></p><ul><li><p>outer</p><ul><li><p>inner</p></li></ul></li></ul></blockquote><ol start=\"3\"><li class=\"task-item\"><input class=\"task-checkbox\" type=\"checkbox\" disabled checked><div class=\"task-item__content\"><p>task</p></div></li></ol><pre><code class=\"language-ts\">left &lt; right</code></pre><div class=\"table-scroll\"><table><thead><tr><th>Name</th><th align=\"center\">Meaning</th></tr></thead><tbody><tr><td>A</td><td align=\"center\">B</td></tr></tbody></table></div><hr><p class=\"image-paragraph image-paragraph--mixed\"><strong>bold</strong> <em>emphasis</em> <del>gone</del> <code>literal &lt;tag&gt;</code> <a href=\"/\"><em>home</em></a> <img src=\"https://example.com/a.png\" alt=\"remote\" title=\"remote\"><br><ruby>typed<rt>annotation</rt></ruby></p></div></div>",
      htmlTreeTags: ["div", "h2", "em", "blockquote", "p", "b", "ul", "li", "ul", "li", "ol", "li", "input", "pre", "code", "table", "thead", "tr", "th", "th", "tbody", "tr", "td", "td", "hr", "p", "b", "i", "s", "code", "a", "em", "img", "br", "ruby", "rt"]
    }
  },
  {
    id: "html-split-nested-list",
    source: htmlSplitNestedListSource,
    sourcePath: "features/html-split-list.md",
    slug: "html-split-list",
    coverage: ["html-split-container", "html-nested-list"],
    expected: {
      tokenKinds: [
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.eof
      ],
      syntaxNodeTypes: ["html-block", "html-block", "html-block", "html-block", "html-block", "html-block", "html-block"],
      astChildTypes: ["list"],
      irTags: ["ul", "li", "p", "ul", "li", "p"],
      vnodeTags: ["ul", "li", "p", "ul", "li", "p"],
      html: "<div><ul><li><p>outer\n</p><ul><li><p>inner</p></li></ul></li></ul></div>"
    }
  },
  {
    id: "html-comments-ignored",
    source: htmlCommentsSource,
    sourcePath: "features/html-comments.md",
    slug: "html-comments",
    coverage: ["html-comment-ignored", "html-comment-nested"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph", "html-block"],
      astChildTypes: ["paragraph", "content-alignment"],
      irTags: ["p", "div", "p"],
      vnodeTags: ["p", "div", "p"],
      html: "<div><p>Visible text</p><div class=\"content-alignment content-alignment--center\"><p>Visible HTML</p></div></div>",
      htmlTreeTags: ["div", "p"]
    }
  },
  {
    id: "frontmatter-contract",
    source: frontmatterSource,
    sourcePath: "features/frontmatter.md",
    slug: "frontmatter",
    coverage: [
      "frontmatter-title",
      "frontmatter-description",
      "frontmatter-type",
      "frontmatter-date",
      "frontmatter-tags",
      "frontmatter-indexed-zero",
      "frontmatter-draft",
      "frontmatter-unknown-field"
    ],
    expected: {
      tokenKinds: [
        TokenKind.frontmatterStart,
        TokenKind.frontmatterText,
        TokenKind.frontmatterEnd,
        TokenKind.syntaxNode,
        TokenKind.eof
      ],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      irTags: ["p"],
      vnodeTags: ["p"],
      html: "<div><p>Content.</p></div>"
    }
  },
  {
    id: "headings-markdown",
    source: headingMarkdownSource,
    sourcePath: "features/headings-markdown.md",
    slug: "headings-markdown",
    coverage: ["html-h1", "html-h2", "html-h3", "html-h4", "html-h5"],
    expected: {
      tokenKinds: [
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.syntaxNode,
        TokenKind.eof
      ],
      syntaxNodeTypes: ["paragraph", "heading", "heading", "heading", "heading", "heading"],
      astChildTypes: ["paragraph", "heading", "heading", "heading", "heading", "heading"],
      irTags: ["p", "h1", "h2", "h3", "h4", "h5"],
      vnodeTags: ["p", "h1", "h2", "h3", "h4", "h5"],
      html: "<div><p>Intro.</p><h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5></div>"
    }
  },
  {
    id: "headings-html",
    source: headingHtmlSource,
    sourcePath: "features/headings-html.md",
    slug: "headings-html",
    coverage: ["html-h1", "html-h2", "html-h3", "html-h4", "html-h5"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["paragraph", "heading", "heading", "heading", "heading", "heading"],
      irTags: ["p", "h1", "h2", "h3", "h4", "h5"],
      vnodeTags: ["p", "h1", "h2", "h3", "h4", "h5"],
      html: "<div><p>Intro.</p><h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5></div>",
      htmlTreeTags: ["p", "h1", "h2", "h3", "h4", "h5"]
    }
  },
  {
    id: "images-markdown",
    source: imageMarkdownSource,
    sourcePath: "features/images-markdown.md",
    slug: "images-markdown",
    coverage: ["asset-link", "asset-image", "image-max-width", "image-forced-width"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.syntaxNode, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph", "paragraph", "paragraph"],
      astChildTypes: ["paragraph", "paragraph", "paragraph"],
      irTags: ["p", "a", "p", "img", "p", "img"],
      vnodeTags: ["p", "a", "p", "img", "p", "img"],
      html: "<div><p><a href=\"/assets/icons/test-marker.svg\">Marker</a></p><p class=\"image-paragraph\"><img src=\"/assets/icons/test-marker.svg\" alt=\"Capped\" style=\"max-width: 30%\"></p><p class=\"image-paragraph\"><img src=\"/assets/icons/test-marker.svg\" alt=\"Forced\" style=\"width: 25%; max-width: 100%\"></p></div>"
    }
  },
  {
    id: "images-html",
    source: imageHtmlSource,
    sourcePath: "features/images-html.md",
    slug: "images-html",
    coverage: ["asset-link", "asset-image", "image-max-width", "image-forced-width"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.syntaxNode, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block", "html-block", "html-block"],
      astChildTypes: ["paragraph", "paragraph", "paragraph"],
      irTags: ["p", "a", "p", "img", "p", "img"],
      vnodeTags: ["p", "a", "p", "img", "p", "img"],
      html: "<div><p><a href=\"/assets/icons/test-marker.svg\">Marker</a></p><p class=\"image-paragraph\"><img src=\"/assets/icons/test-marker.svg\" alt=\"Capped\" style=\"max-width: 30%\"></p><p class=\"image-paragraph\"><img src=\"/assets/icons/test-marker.svg\" alt=\"Forced\" style=\"width: 25%; max-width: 100%\"></p></div>",
      htmlTreeTags: ["p", "a", "img", "img"]
    }
  },
  {
    id: "alignment-html",
    source: alignmentHtmlSource,
    sourcePath: "features/alignment-html.md",
    slug: "alignment-html",
    coverage: ["html-div-alignment", "alignment-left", "alignment-center", "alignment-right"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["content-alignment", "content-alignment", "content-alignment"],
      irTags: ["div", "p", "div", "h2", "div", "p", "img"],
      vnodeTags: ["div", "p", "div", "h2", "div", "p", "img"],
      html: "<div><div class=\"content-alignment content-alignment--left\"><p>Left</p></div><div class=\"content-alignment content-alignment--center\"><h2>Center</h2></div><div class=\"content-alignment content-alignment--right\"><p class=\"image-paragraph\"><img src=\"/assets/icons/test-marker.svg\" alt=\"Right\"></p></div></div>",
      htmlTreeTags: ["div", "p", "div", "h2", "div", "img"]
    }
  },
  {
    id: "frontmatter-list",
    source: listFrontmatterSource,
    sourcePath: "features/list.md",
    slug: "list",
    coverage: ["frontmatter-source", "collection"],
    expected: {
      tokenKinds: [TokenKind.frontmatterStart, TokenKind.frontmatterText, TokenKind.frontmatterEnd, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["heading"],
      astChildTypes: ["collection"],
      irTags: ["p"],
      vnodeTags: ["p"],
      html: "<div><p class=\"empty-state\">No items have been published in blogs yet.</p></div>"
    }
  },
  {
    id: "html-inline-aliases",
    source: htmlAliasSource,
    sourcePath: "features/html-aliases.md",
    slug: "html-aliases",
    coverage: ["html-strong", "html-b", "html-em", "html-i", "html-del", "html-s", "html-strike", "html-code", "html-tt", "html-a", "html-br"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["paragraph"],
      irTags: ["p", "strong", "strong", "em", "em", "del", "del", "del", "code", "code", "a", "br"],
      vnodeTags: ["p", "strong", "strong", "em", "em", "del", "del", "del", "code", "code", "a", "br"],
      html: "<div><p><strong>strong</strong> <strong>bold</strong> <em>emphasis</em> <em>italic</em> <del>deleted</del> <del>struck</del> <del>strike</del> <code>code</code> <code>tt</code> <a href=\"/\">home</a><br></p></div>",
      htmlTreeTags: ["p", "strong", "b", "em", "i", "del", "s", "strike", "code", "tt", "a", "br"]
    }
  },
  {
    id: "fenced-code-variants",
    source: fencedCodeSource,
    sourcePath: "features/fenced-code.md",
    slug: "fenced-code",
    coverage: ["fenced-backtick-language", "fenced-tilde-no-language", "multiline-code", "bare-code"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["code-block", "code-block"],
      astChildTypes: ["code-block", "code-block"],
      irTags: ["pre", "code", "pre", "code"],
      vnodeTags: ["pre", "code", "pre", "code"],
      html: "<div><pre><code class=\"language-ts\">const marked: string = &quot;language&quot;;</code></pre><pre><code>plain &lt; text</code></pre></div>"
    }
  },
  {
    id: "fenced-code-four-character-outer",
    source: nestedFencedCodeSource,
    sourcePath: "features/fenced-code-four.md",
    slug: "fenced-code-four",
    coverage: ["fenced-four-character-outer", "fenced-inner-three-character"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["code-block"],
      astChildTypes: ["code-block"],
      irTags: ["pre", "code"],
      vnodeTags: ["pre", "code"],
      html: "<div><pre><code class=\"language-markdown\">```ts\nconst typed: string = &quot;language-marked&quot;;\n```\n~~~\nplain code without a language marker\n~~~</code></pre></div>"
    }
  },
  {
    id: "fenced-code-four-character-backtick-outer",
    source: nestedBacktickFencedCodeSource,
    sourcePath: "features/fenced-code-four-backtick.md",
    slug: "fenced-code-four-backtick",
    coverage: ["fenced-four-character-backtick-outer"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["code-block"],
      astChildTypes: ["code-block"],
      irTags: ["pre", "code"],
      vnodeTags: ["pre", "code"],
      html: "<div><pre><code class=\"language-markdown\">~~~ts\nconst typed: string = &quot;language-marked&quot;;\n~~~\n```\nplain code without a language marker\n```</code></pre></div>"
    }
  }
];

export const pipelineEquivalenceFeatures: readonly PipelineEquivalenceFeature[] = [
  {
    id: "inline-markdown-html-equivalence",
    markdownSource: inlineMarkdownSource,
    htmlSource: inlineHtmlEquivalentSource,
    coverage: ["inline-nesting", "html-inline-equivalence"]
  },
  {
    id: "block-markdown-html-equivalence",
    markdownSource: blockMarkdownSource,
    htmlSource: blockHtmlEquivalentSource,
    coverage: ["block-nesting", "html-block-equivalence", "html-nesting"]
  },
  {
    id: "heading-markdown-html-equivalence",
    markdownSource: headingMarkdownSource,
    htmlSource: headingHtmlSource,
    coverage: ["html-h1", "html-h2", "html-h3", "html-h4", "html-h5"]
  },
  {
    id: "image-markdown-html-equivalence",
    markdownSource: imageMarkdownSource,
    htmlSource: imageHtmlSource,
    coverage: ["asset-image", "image-max-width", "image-forced-width", "html-image-equivalence"]
  },
  {
    id: "html-alias-markdown-equivalence",
    markdownSource: htmlAliasMarkdownSource,
    htmlSource: htmlAliasSource,
    coverage: ["html-alias-equivalence", "html-tt"]
  }
];

export const requiredCoverage = [
  "paragraph",
  "heading",
  "strong",
  "emphasis",
  "delete",
  "inline-code",
  "ruby",
  "link-route",
  "asset-link",
  "asset-image",
  "image-external",
  "image-max-width",
  "image-forced-width",
  "hard-break",
  "unordered-list",
  "ordered-list",
  "nested-list",
  "task-list",
  "blockquote",
  "fenced-code",
  "fenced-backtick-language",
  "fenced-tilde-no-language",
  "multiline-code",
  "bare-code",
  "fenced-four-character-outer",
  "fenced-four-character-backtick-outer",
  "fenced-inner-three-character",
  "table",
  "thematic-break",
  "frontmatter-title",
  "frontmatter-description",
  "frontmatter-type",
  "frontmatter-source",
  "frontmatter-date",
  "frontmatter-tags",
  "frontmatter-indexed-zero",
  "frontmatter-draft",
  "frontmatter-unknown-field",
  "collection",
  "table-alignment",
  "html-dom-tree",
  "html-div-alignment",
  "alignment-left",
  "alignment-center",
  "alignment-right",
  "html-h1",
  "html-h2",
  "html-h3",
  "html-h4",
  "html-h5",
  "html-blockquote",
  "html-ul",
  "html-ol",
  "html-ol-start",
  "html-li",
  "html-task-input",
  "html-pre-code",
  "html-table",
  "html-tr",
  "html-th",
  "html-td",
  "html-hr",
  "html-p",
  "html-strong",
  "html-b",
  "html-em",
  "html-i",
  "html-del",
  "html-s",
  "html-strike",
  "html-code",
  "html-tt",
  "html-a",
  "html-img",
  "html-br",
  "html-ruby",
  "html-inline-equivalence",
  "html-block-equivalence",
  "html-image-equivalence",
  "html-alias-equivalence",
  "inline-nesting",
  "block-nesting",
  "html-nesting",
  "html-inline-heading",
  "html-inline-table",
  "html-inline-nesting",
  "html-comment-ignored",
  "html-comment-nested",
  "html-split-container",
  "html-nested-list"
] as const;
