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
    id: "unsafe-markdown-case-link",
    source: "[bad](JaVaScRiPt:alert(1))",
    sourcePath: "features/invalid-case-link.md",
    slug: "invalid-case-link",
    stage: "ir-error",
    coverage: ["unsafe-url-case"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe URL rejected by renderer: JaVaScRiPt:alert\(1\)/u
    }
  },
  {
    id: "unsafe-markdown-encoded-link",
    source: "[bad](%6a%61%76%61%73%63%72%69%70%74%3aalert(1))",
    sourcePath: "features/invalid-encoded-link.md",
    slug: "invalid-encoded-link",
    stage: "ir-error",
    coverage: ["unsafe-url-encoded"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe URL rejected by renderer: %6a%61%76%61%73%63%72%69%70%74%3aalert\(1\)/u
    }
  },
  {
    id: "unsafe-markdown-whitespace-link",
    source: "[bad](java%09script:alert(1))",
    sourcePath: "features/invalid-whitespace-link.md",
    slug: "invalid-whitespace-link",
    stage: "ir-error",
    coverage: ["unsafe-url-whitespace"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe URL rejected by renderer: java%09script:alert\(1\)/u
    }
  },
  {
    id: "unsafe-markdown-data-link",
    source: "[bad](data:text/plain,blocked)",
    sourcePath: "features/invalid-data-link.md",
    slug: "invalid-data-link",
    stage: "ir-error",
    coverage: ["unsafe-data-url-scheme"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe URL rejected by renderer: data:text\/plain,blocked/u
    }
  },
  {
    id: "unsafe-markdown-vbscript-link",
    source: "[bad](vbscript:msgbox(1))",
    sourcePath: "features/invalid-vbscript-link.md",
    slug: "invalid-vbscript-link",
    stage: "ir-error",
    coverage: ["unsafe-vbscript-url-scheme"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe URL rejected by renderer: vbscript:msgbox\(1\)/u
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
    id: "unsafe-html-data-link",
    source: '<a href="DaTa:text/plain,blocked">bad</a>',
    sourcePath: "features/invalid-html-data-link.md",
    slug: "invalid-html-data-link",
    stage: "ir-error",
    coverage: ["unsafe-html-data-url-scheme"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      htmlTreeTags: ["a"],
      error: /Unsafe URL rejected by renderer: DaTa:text\/plain,blocked/u
    }
  },
  {
    id: "unsafe-html-vbscript-image",
    source: '<img src="VBScript:msgbox(1)" alt="bad">',
    sourcePath: "features/invalid-html-vbscript-image.md",
    slug: "invalid-html-vbscript-image",
    stage: "ir-error",
    coverage: ["unsafe-html-vbscript-url-scheme"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["paragraph"],
      htmlTreeTags: ["img"],
      error: /Unsafe URL rejected by renderer: VBScript:msgbox\(1\)/u
    }
  },
  {
    id: "unsafe-html-whitespace-link",
    source: '<a href="java&#x09;script:alert(1)">bad</a>',
    sourcePath: "features/invalid-html-whitespace-link.md",
    slug: "invalid-html-whitespace-link",
    stage: "ir-error",
    coverage: ["unsafe-html-url-whitespace"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      htmlTreeTags: ["a"],
      error: /Unsafe URL rejected by renderer: java\s+script:alert\(1\)/u
    }
  },
  {
    id: "unsafe-html-encoded-image",
    source: '<img src="VB%09SCRIPT%3Aalert(1)" alt="bad">',
    sourcePath: "features/invalid-html-encoded-image.md",
    slug: "invalid-html-encoded-image",
    stage: "ir-error",
    coverage: ["unsafe-html-url-encoded"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["html-block"],
      astChildTypes: ["paragraph"],
      htmlTreeTags: ["img"],
      error: /Unsafe URL rejected by renderer: VB%09SCRIPT%3Aalert\(1\)/u
    }
  },
  {
    id: "unknown-markdown-link-scheme",
    source: "[bad](custom:payload)",
    sourcePath: "features/invalid-unknown-link.md",
    slug: "invalid-unknown-link",
    stage: "ir-error",
    coverage: ["unknown-url-scheme"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe URL rejected by renderer: custom:payload/u
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
    id: "asset-public-root-xml",
    source: "[bad](asset:feed.xml)",
    sourcePath: "features/invalid-public-root-asset.md",
    slug: "invalid-public-root-asset",
    stage: "ir-error",
    coverage: ["asset-public-root-file"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsupported asset type: feed\.xml/u
    }
  },
  {
    id: "asset-public-root-absolute-prefix",
    source: "[bad](asset:/feed.xml)",
    sourcePath: "features/invalid-absolute-public-asset.md",
    slug: "invalid-absolute-public-asset",
    stage: "ir-error",
    coverage: ["asset-public-root-prefix"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsafe asset path rejected: \/feed\.xml/u
    }
  },
  {
    id: "asset-public-root-directory-prefix",
    source: "[bad](asset:public/feed.xml)",
    sourcePath: "features/invalid-public-directory-asset.md",
    slug: "invalid-public-directory-asset",
    stage: "ir-error",
    coverage: ["asset-public-directory-prefix"],
    expected: {
      tokenKinds: [TokenKind.syntaxNode, TokenKind.eof],
      syntaxNodeTypes: ["paragraph"],
      astChildTypes: ["paragraph"],
      error: /Unsupported asset type: public\/feed\.xml/u
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
  "unsafe-url-case",
  "unsafe-url-encoded",
  "unsafe-url-whitespace",
  "unsafe-data-url-scheme",
  "unsafe-vbscript-url-scheme",
  "unsafe-html-link-scheme",
  "unsafe-html-data-url-scheme",
  "unsafe-html-vbscript-url-scheme",
  "unsafe-html-url-whitespace",
  "unsafe-html-url-encoded",
  "unsafe-html-image-scheme",
  "unknown-url-scheme",
  "asset-path-traversal",
  "asset-unsupported-extension",
  "asset-public-root-file",
  "asset-public-root-prefix",
  "asset-public-directory-prefix",
  "markdown-image-invalid-range",
  "malformed-frontmatter",
  "list-source-required"
] as const;
