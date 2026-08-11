import { TokenKind, type TokenKind as TokenKindValue } from "../../src/tokens/types.ts";

export type InvalidFeatureStage = "escaped" | "ast-error" | "ir-error";

export interface InvalidFeature {
  id: string;
  source: string;
  sourcePath: string;
  slug: string;
  stage: InvalidFeatureStage;
  coverage: readonly string[];
  expected: {
    tokenKinds: readonly TokenKindValue[];
    syntaxNodeTypes: readonly string[];
    astChildTypes?: readonly string[];
    irTags?: readonly string[];
    vnodeTags?: readonly string[];
    html?: string;
    htmlTreeTags?: readonly string[];
    error?: RegExp;
  };
}

export const invalidFeatures: readonly InvalidFeature[] = [
  {
    id: "unsupported-script",
    source: "<script>alert(1)</script>",
    sourcePath: "features/invalid-script.md",
    slug: "invalid-script",
    stage: "escaped",
    coverage: ["html-unsupported-escaped", "html-script-blacklist"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["text-block"],
      irTags: ["div"],
      vnodeTags: ["div"],
      html: "<div><div class=\"text-block\">&lt;script&gt;alert(1)&lt;/script&gt;</div></div>",
      htmlTreeTags: ["script"]
    }
  },
  {
    id: "unsupported-script-nested",
    source: '<div align="center"><script>alert(1)</script></div>',
    sourcePath: "features/invalid-script-nested.md",
    slug: "invalid-script-nested",
    stage: "escaped",
    coverage: ["html-unsupported-nested", "html-script-blacklist"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["text-block"],
      irTags: ["div"],
      vnodeTags: ["div"],
      html: "<div><div class=\"text-block\">&lt;div align=\&quot;center\&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;/div&gt;</div></div>",
      htmlTreeTags: ["div", "script"]
    }
  },
  {
    id: "unsupported-iframe",
    source: '<iframe src="https://example.com">frame</iframe>',
    sourcePath: "features/invalid-iframe.md",
    slug: "invalid-iframe",
    stage: "escaped",
    coverage: ["html-unsupported-escaped", "html-iframe-blacklist"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["text-block"],
      irTags: ["div"],
      vnodeTags: ["div"],
      html: "<div><div class=\"text-block\">&lt;iframe src=\&quot;https://example.com\&quot;&gt;frame&lt;/iframe&gt;</div></div>",
      htmlTreeTags: ["iframe"]
    }
  },
  {
    id: "unsupported-html-image-unit",
    source: '<img src="https://example.com/a.png" alt="bad" width="25vh">',
    sourcePath: "features/invalid-image-unit.md",
    slug: "invalid-image-unit",
    stage: "escaped",
    coverage: ["html-image-invalid-unit", "html-unsupported-escaped"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["text-block"],
      irTags: ["div"],
      vnodeTags: ["div"],
      html: "<div><div class=\"text-block\">&lt;img src=\&quot;https://example.com/a.png\&quot; alt=\&quot;bad\&quot; width=\&quot;25vh\&quot;&gt;</div></div>",
      htmlTreeTags: ["img"]
    }
  },
  {
    id: "unsupported-html-image-px-unit",
    source: '<img src="https://example.com/a.png" alt="bad" width="25px">',
    sourcePath: "features/invalid-image-px-unit.md",
    slug: "invalid-image-px-unit",
    stage: "escaped",
    coverage: ["html-image-invalid-unit", "html-unsupported-escaped"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["text-block"],
      irTags: ["div"],
      vnodeTags: ["div"],
      html: "<div><div class=\"text-block\">&lt;img src=\&quot;https://example.com/a.png\&quot; alt=\&quot;bad\&quot; width=\&quot;25px\&quot;&gt;</div></div>",
      htmlTreeTags: ["img"]
    }
  },
  {
    id: "duplicate-html-image-sizing",
    source: '<img src="https://example.com/a.png" alt="bad" width="25%" style="max-width: 30%">',
    sourcePath: "features/invalid-image-sizing.md",
    slug: "invalid-image-sizing",
    stage: "escaped",
    coverage: ["html-image-duplicate-sizing", "html-unsupported-escaped"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["text-block"],
      irTags: ["div"],
      vnodeTags: ["div"],
      html: "<div><div class=\"text-block\">&lt;img src=\&quot;https://example.com/a.png\&quot; alt=\&quot;bad\&quot; width=\&quot;25%\&quot; style=\&quot;max-width: 30%\&quot;&gt;</div></div>",
      htmlTreeTags: ["img"]
    }
  },
  {
    id: "invalid-html-list-child",
    source: "<ul><p>bad</p></ul>",
    sourcePath: "features/invalid-list.md",
    slug: "invalid-list",
    stage: "escaped",
    coverage: ["html-invalid-nesting", "html-unsupported-escaped"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["text-block"],
      irTags: ["div"],
      vnodeTags: ["div"],
      html: "<div><div class=\"text-block\">&lt;ul&gt;&lt;p&gt;bad&lt;/p&gt;&lt;/ul&gt;</div></div>",
      htmlTreeTags: ["ul", "p"]
    }
  },
  {
    id: "unsafe-markdown-link",
    source: "[bad](javascript:alert(1))",
    sourcePath: "features/invalid-link.md",
    slug: "invalid-link",
    stage: "ir-error",
    coverage: ["unsafe-link-scheme"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe URL rejected by renderer: javascript:alert\(1\)/u
    }
  },
  {
    id: "unsafe-html-link",
    source: '<a href="javascript:alert(1)">bad</a>',
    sourcePath: "features/invalid-html-link.md",
    slug: "invalid-html-link",
    stage: "ir-error",
    coverage: ["unsafe-html-link-scheme"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      htmlTreeTags: ["a"],
      error: /Unsafe URL rejected by renderer: javascript:alert\(1\)/u
    }
  },
  {
    id: "unsafe-html-image",
    source: '<img src="javascript:alert(1)" alt="bad">',
    sourcePath: "features/invalid-html-image.md",
    slug: "invalid-html-image",
    stage: "ir-error",
    coverage: ["unsafe-html-image-scheme"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["paragraph"],
      htmlTreeTags: ["img"],
      error: /Unsafe URL rejected by renderer: javascript:alert\(1\)/u
    }
  },
  {
    id: "asset-path-traversal",
    source: "![bad](asset:../secret.svg)",
    sourcePath: "features/invalid-asset-path.md",
    slug: "invalid-asset-path",
    stage: "ir-error",
    coverage: ["asset-path-traversal"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe asset path rejected: \.\.\/secret\.svg/u
    }
  },
  {
    id: "asset-unsupported-extension",
    source: "![bad](asset:icons/secret.txt)",
    sourcePath: "features/invalid-asset-extension.md",
    slug: "invalid-asset-extension",
    stage: "ir-error",
    coverage: ["asset-unsupported-extension"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsupported asset type: icons\/secret\.txt/u
    }
  },
  {
    id: "markdown-image-width-out-of-range",
    source: "![bad](https://example.com/a.png){width=101%}",
    sourcePath: "features/invalid-image-width.md",
    slug: "invalid-image-width",
    stage: "ast-error",
    coverage: ["markdown-image-invalid-range"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      error: /Image width must be between 0% and 100%/u
    }
  },
  {
    id: "malformed-frontmatter",
    source: "---\ntitle: [\n---\n\nBody.",
    sourcePath: "features/invalid-frontmatter.md",
    slug: "invalid-frontmatter",
    stage: "ast-error",
    coverage: ["malformed-frontmatter"],
    expected: {
      tokenKinds: [TokenKind.frontmatterStart, TokenKind.frontmatterText, TokenKind.frontmatterEnd, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      error: /YAML|unexpected|flow sequence/iu
    }
  },
  {
    id: "list-page-without-source",
    source: "---\ntitle: Missing source\ntype: list\n---\n\nBody.",
    sourcePath: "features/invalid-list-frontmatter.md",
    slug: "invalid-list-frontmatter",
    stage: "ast-error",
    coverage: ["list-source-required"],
    expected: {
      tokenKinds: [TokenKind.frontmatterStart, TokenKind.frontmatterText, TokenKind.frontmatterEnd, TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      error: /must declare a non-empty source/u
    }
  }
];

export const requiredInvalidCoverage = [
  "html-unsupported-escaped",
  "html-script-blacklist",
  "html-unsupported-nested",
  "html-iframe-blacklist",
  "html-image-invalid-unit",
  "html-image-duplicate-sizing",
  "html-invalid-nesting",
  "unsafe-link-scheme",
  "unsafe-html-link-scheme",
  "unsafe-html-image-scheme",
  "asset-path-traversal",
  "asset-unsupported-extension",
  "markdown-image-invalid-range",
  "malformed-frontmatter",
  "list-source-required"
] as const;
