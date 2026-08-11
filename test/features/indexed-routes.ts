import { TokenKind } from "../../src/tokens/types.ts";

export interface IndexedPipelineFeature {
  id: string;
  source: string;
  sourcePath: string;
  slug: string;
  indexed?: number;
  routeKind: "index" | "item";
  expected: {
    tokenKinds: readonly TokenKind[];
    syntaxNodeTypes: readonly string[];
    astChildTypes: readonly string[];
    irTags: readonly string[];
    vnodeTags: readonly string[];
    html: string;
  };
}

function pageSource(title: string, options: {
  indexed?: number;
  type?: "page" | "list";
  source?: string;
  body: string;
}): string {
  const frontmatter = [
    "---",
    `title: ${title}`,
    ...(options.indexed === undefined ? [] : [`indexed: ${options.indexed}`]),
    ...(options.type === undefined ? [] : [`type: ${options.type}`]),
    ...(options.source === undefined ? [] : [`source: ${options.source}`]),
    "---",
    ""
  ];
  return [...frontmatter, options.body].join("\n");
}

const plainFeature = (id: string, sourcePath: string, slug: string, title: string, body: string, indexed?: number): IndexedPipelineFeature => ({
  id,
  source: pageSource(title, { body, indexed }),
  sourcePath,
  slug,
  indexed,
  routeKind: sourcePath.endsWith("/index.md") || sourcePath === "index.md" ? "index" : "item",
  expected: {
    tokenKinds: [TokenKind.frontmatterStart, TokenKind.frontmatterText, TokenKind.frontmatterEnd, TokenKind.syntaxNode, TokenKind.eof],
    syntaxNodeTypes: ["paragraph"],
    astChildTypes: ["paragraph"],
    irTags: ["p"],
    vnodeTags: ["p"],
    html: `<div><p>${body}</p></div>`
  }
});

const listFeature = (id: string, sourcePath: string, slug: string, title: string, source: string, indexed?: number): IndexedPipelineFeature => ({
  id,
  source: pageSource(title, {
    body: "Collection head.",
    indexed,
    type: "list",
    source: sourcePath === "index.md" ? source : undefined
  }),
  sourcePath,
  slug,
  indexed,
  routeKind: "index",
  expected: {
    tokenKinds: [TokenKind.frontmatterStart, TokenKind.frontmatterText, TokenKind.frontmatterEnd, TokenKind.syntaxNode, TokenKind.eof],
    syntaxNodeTypes: ["paragraph"],
    astChildTypes: ["paragraph", "collection"],
    irTags: ["p", "p"],
    vnodeTags: ["p", "p"],
    html: `<div><p>Collection head.</p><p class="empty-state">No items have been published in ${source.replace(/\/$/u, "")} yet.</p></div>`
  }
});

const implicitListFeature = (id: string, sourcePath: string, title: string, source: string, indexed?: number): IndexedPipelineFeature => ({
  id,
  source: pageSource(title, { body: "Implicit collection head.", indexed }),
  sourcePath,
  slug: "index",
  indexed,
  routeKind: "index",
  expected: {
    tokenKinds: [TokenKind.frontmatterStart, TokenKind.frontmatterText, TokenKind.frontmatterEnd, TokenKind.syntaxNode, TokenKind.eof],
    syntaxNodeTypes: ["paragraph"],
    astChildTypes: ["paragraph", "collection"],
    irTags: ["p", "p"],
    vnodeTags: ["p", "p"],
    html: `<div><p>Implicit collection head.</p><p class="empty-state">No items have been published in ${source.replace(/\/$/u, "")} yet.</p></div>`
  }
});

export const indexedPipelineFeatures: readonly IndexedPipelineFeature[] = [
  plainFeature("root-index-indexed-zero", "index.md", "index", "Root index", "Root body.", 0),
  listFeature("root-index-explicit-list", "index.md", "index", "Root collection", "blogs/"),
  listFeature("directory-index-indexed-one", "blogs/index.md", "index", "Blogs index", "blogs/", 1),
  implicitListFeature("directory-index-implicit-list", "blogs/implicit/index.md", "Implicit index", "blogs/implicit/", 3),
  plainFeature("collection-item-indexed-zero", "blogs/first.md", "first", "First item", "First body.", 0),
  plainFeature("collection-item-unindexed", "blogs/second.md", "second", "Second item", "Second body."),
  listFeature("nested-directory-index-indexed-two", "blogs/series/index.md", "index", "Series index", "blogs/series/", 2),
  plainFeature("nested-collection-item-indexed-zero", "blogs/series/first.md", "first", "Nested first", "Nested first body.", 0),
  plainFeature("nested-collection-item-unindexed", "blogs/series/second.md", "second", "Nested second", "Nested second body.")
];

export interface RouteLayoutFile {
  path: string;
  source: string;
}

export const canonicalIndexedRouteLayout: readonly RouteLayoutFile[] = [
  {
    path: "index.md",
    source: pageSource("Root", { indexed: 0, body: "Root route." })
  },
  {
    path: "about.md",
    source: pageSource("About", { body: "About route." })
  },
  {
    path: "blogs/index.md",
    source: pageSource("Blogs", { indexed: 1, body: "Blogs route." })
  },
  {
    path: "blogs/entry.md",
    source: pageSource("Entry", { indexed: 0, body: "Entry route." })
  },
  {
    path: "blogs/series/index.md",
    source: pageSource("Series", { indexed: 2, body: "Series route." })
  },
  {
    path: "blogs/series/first.md",
    source: pageSource("First", { indexed: 0, body: "First nested route." })
  },
  {
    path: "blogs/series/second.md",
    source: pageSource("Second", { body: "Second nested route." })
  }
];

export const externallyNamedCollectionLayout: readonly RouteLayoutFile[] = [
  {
    path: "index.md",
    source: pageSource("Root", { indexed: 0, body: "Root route." })
  },
  {
    path: "blog.md",
    source: pageSource("Blog", { type: "list", source: "blogs/", body: "Named collection route." })
  },
  {
    path: "blogs/entry.md",
    source: pageSource("Entry", { indexed: 0, body: "Collection item." })
  }
];

export const sameNamedCollectionLayout: readonly RouteLayoutFile[] = [
  {
    path: "index.md",
    source: pageSource("Root", { indexed: 0, body: "Root route." })
  },
  {
    path: "blogs.md",
    source: pageSource("Blogs", { type: "list", source: "blogs/", body: "Same-name collection route." })
  },
  {
    path: "blogs/entry.md",
    source: pageSource("Entry", { indexed: 0, body: "Collection item." })
  }
];

export const conflictingExternalAndDirectoryIndexLayout: readonly RouteLayoutFile[] = [
  {
    path: "blog.md",
    source: pageSource("Blog", { type: "list", source: "blogs/", body: "External collection head." })
  },
  {
    path: "blogs/index.md",
    source: pageSource("Blogs", { type: "list", body: "Directory collection head." })
  },
  {
    path: "blogs/entry.md",
    source: pageSource("Entry", { body: "Entry route." })
  }
];

export const invalidDirectoryIndexFeatures = [
  {
    id: "directory-index-explicit-page",
    sourcePath: "pages/index.md",
    source: pageSource("Pages", { type: "page", body: "Invalid page index." }),
    error: /directory index and is implicitly a list/u
  },
  {
    id: "directory-index-explicit-matching-source",
    sourcePath: "pages/index.md",
    source: pageSource("Pages", { type: "list", source: "pages/", body: "Redundant source." }),
    error: /must not declare source/u
  },
  {
    id: "directory-index-explicit-other-source",
    sourcePath: "pages/index.md",
    source: pageSource("Pages", { type: "list", source: "other/", body: "Wrong source." }),
    error: /must not declare source/u
  }
] as const;
