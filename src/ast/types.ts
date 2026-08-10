export type TemplateName = "page" | "list" | "list-object" | "list-object-list";

export type PageType = "page" | "list";

export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;

export type ContentAlignment = "left" | "center" | "right";

export type ListStyle = "ordered" | "unordered";

export type TableAlignment = "left" | "center" | "right" | null;

export interface SiteConfig {
  language: string;
  title: string;
  description: string;
  githubUsername: string;
  footerText: string | null;
  basePath: string;
  contentDirectory: string;
  styleEntry: string;
  publicDirectory: string;
}

export interface PageMetadata {
  title: string;
  description: string;
  type: PageType;
  indexed?: number;
  listSource?: string;
  date?: string;
  tags: string[];
  draft: boolean;
}

export interface SourceDocument {
  sourcePath: string;
  slug: string;
  metadata: PageMetadata;
  ast: RootNode;
}

export interface RootNode {
  type: "root";
  children: BlockNode[];
}

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | ListNode
  | BlockquoteNode
  | CodeBlockNode
  | ThematicBreakNode
  | TableNode
  | ContentAlignmentNode
  | CollectionNode
  | TextBlockNode;

export interface ParagraphNode {
  type: "paragraph";
  children: InlineNode[];
}

export interface HeadingNode {
  type: "heading";
  depth: HeadingDepth;
  children: InlineNode[];
}

export interface ListNode {
  type: "list";
  style: ListStyle;
  start: number | null;
  items: ListItemNode[];
}

export interface ListItemNode {
  type: "list-item";
  children: BlockNode[];
  checked: boolean | null;
}

export interface BlockquoteNode {
  type: "blockquote";
  children: BlockNode[];
}

export interface CodeBlockNode {
  type: "code-block";
  language: string | null;
  value: string;
}

export interface ThematicBreakNode {
  type: "thematic-break";
}

export interface TableNode {
  type: "table";
  alignments: TableAlignment[];
  rows: TableRowNode[];
}

export interface ContentAlignmentNode {
  type: "content-alignment";
  alignment: ContentAlignment;
  children: BlockNode[];
}

export interface TableRowNode {
  type: "table-row";
  cells: TableCellNode[];
}

export interface TableCellNode {
  type: "table-cell";
  children: InlineNode[];
}

export interface CollectionNode {
  type: "collection";
  name: string;
}

export interface TextBlockNode {
  type: "text-block";
  value: string;
}

export type InlineNode =
  | TextNode
  | EmphasisNode
  | StrongNode
  | DeleteNode
  | InlineCodeNode
  | LinkNode
  | ImageNode
  | RubyNode
  | BreakNode;

export interface TextNode {
  type: "text";
  value: string;
}

export interface EmphasisNode {
  type: "emphasis";
  children: InlineNode[];
}

export interface StrongNode {
  type: "strong";
  children: InlineNode[];
}

export interface DeleteNode {
  type: "delete";
  children: InlineNode[];
}

export interface InlineCodeNode {
  type: "inline-code";
  value: string;
}

export interface LinkNode {
  type: "link";
  target: LinkTarget;
  title: string | null;
  children: InlineNode[];
}

export type LinkTarget = RouteTarget | AssetTarget | ExternalTarget | RelativeTarget;

export interface RouteTarget {
  type: "route";
  name: string;
}

export interface AssetTarget {
  type: "asset";
  name: string;
}

export interface ExternalTarget {
  type: "external";
  href: string;
}

export interface RelativeTarget {
  type: "relative";
  href: string;
}

export interface ImageNode {
  type: "image";
  src: string | AssetTarget;
  alt: string;
  title: string | null;
  forcedWidthPercent?: number;
  maxWidthPercent?: number;
}

export interface RubyNode {
  type: "ruby";
  base: string;
  annotation: string;
}

export interface BreakNode {
  type: "break";
}

export interface RouteRecord {
  name: string;
  path: string;
  sourcePath: string;
  template: TemplateName;
  collection?: string;
  slug?: string;
  title: string;
  indexed?: number;
  aliases?: string[];
}

export interface CollectionItem {
  collection: string;
  slug: string;
  routeName: string;
  path: string;
  sourcePath: string;
  document: SourceDocument;
}

export interface CollectionResult {
  name: string;
  sourcePath: string;
  head: RouteRecord;
  items: CollectionItem[];
}

export interface NavigationLink {
  label: string;
  path: string;
  current: boolean;
}

export interface NavigationContext {
  currentPath: string;
  parent: NavigationLink | null;
  previous: NavigationLink | null;
  next: NavigationLink | null;
  breadcrumbs: NavigationLink[];
}

export interface RenderPageInput {
  route: RouteRecord;
  document: SourceDocument;
  navigation: NavigationContext;
  primaryNavigation: NavigationLink[];
  collection?: CollectionResult;
}
