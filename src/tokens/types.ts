/**
 * The project's token boundary around the external Markdown syntax engine.
 *
 * Unified/Remark owns source recognition. These tokens deliberately describe
 * the recognized source syntax, while the parser owns conversion into the
 * normalized domain AST in `src/ast/types.ts`.
 */

export const TokenKind = {
  frontmatterStart: "frontmatter-start",
  frontmatterText: "frontmatter-text",
  frontmatterEnd: "frontmatter-end",
  syntaxNode: "syntax-node",
  eof: "eof"
} as const;

export type TokenKind = typeof TokenKind[keyof typeof TokenKind];

export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

export interface TokenSpan {
  start: SourcePosition;
  end: SourcePosition;
}

export interface TokenBase<K extends TokenKind = TokenKind> extends TokenSpan {
  kind: K;
  lexeme: string;
}

export interface ScannedTextNode {
  type: "text";
  value: string;
}

export interface ScannedEmphasisNode {
  type: "emphasis";
  children: ScannedInlineNode[];
}

export interface ScannedStrongNode {
  type: "strong";
  children: ScannedInlineNode[];
}

export interface ScannedDeleteNode {
  type: "delete";
  children: ScannedInlineNode[];
}

export interface ScannedInlineCodeNode {
  type: "inline-code";
  value: string;
}

export interface ScannedLinkNode {
  type: "link";
  url: string;
  title: string | null;
  children: ScannedInlineNode[];
}

export interface ScannedImageNode {
  type: "image";
  url: string;
  alt: string;
  title: string | null;
  forcedWidthPercent?: number;
  maxWidthPercent?: number;
}

export interface ScannedHtmlNode {
  type: "html";
  value: string;
}

export interface ScannedHtmlContainerNode {
  type: "html-container";
  value: string;
  tree: ScannedHtmlTreeNode[];
}

export interface ScannedHtmlTextNode {
  type: "html-text";
  value: string;
}

export interface ScannedHtmlElementNode {
  type: "html-element";
  name: string;
  attributes: Readonly<Record<string, string>>;
  children: ScannedHtmlTreeNode[];
}

export type ScannedHtmlTreeNode = ScannedHtmlTextNode | ScannedHtmlElementNode;

export interface ScannedBreakNode {
  type: "break";
}

export type ScannedInlineNode =
  | ScannedTextNode
  | ScannedEmphasisNode
  | ScannedStrongNode
  | ScannedDeleteNode
  | ScannedInlineCodeNode
  | ScannedLinkNode
  | ScannedImageNode
  | ScannedHtmlNode
  | ScannedHtmlContainerNode
  | ScannedBreakNode;

export interface ScannedParagraphNode {
  type: "paragraph";
  children: ScannedInlineNode[];
}

export interface ScannedHeadingNode {
  type: "heading";
  depth: number;
  children: ScannedInlineNode[];
}

export interface ScannedListItemNode {
  type: "list-item";
  children: ScannedBlockNode[];
  checked: boolean | null;
}

export interface ScannedListNode {
  type: "list";
  style: "ordered" | "unordered";
  start: number | null;
  items: ScannedListItemNode[];
}

export interface ScannedBlockquoteNode {
  type: "blockquote";
  children: ScannedBlockNode[];
}

export interface ScannedCodeBlockNode {
  type: "code-block";
  language: string | null;
  value: string;
}

export interface ScannedThematicBreakNode {
  type: "thematic-break";
}

export interface ScannedTableCellNode {
  type: "table-cell";
  children: ScannedInlineNode[];
}

export interface ScannedTableRowNode {
  type: "table-row";
  cells: ScannedTableCellNode[];
}

export interface ScannedTableNode {
  type: "table";
  alignments: Array<"left" | "center" | "right" | null>;
  rows: ScannedTableRowNode[];
}

export interface ScannedHtmlBlockNode {
  type: "html-block";
  value: string;
  tree: ScannedHtmlTreeNode[] | null;
}

export interface ScannedUnsupportedBlockNode {
  type: "unsupported-block";
  value: string;
}

export type ScannedBlockNode =
  | ScannedParagraphNode
  | ScannedHeadingNode
  | ScannedListNode
  | ScannedBlockquoteNode
  | ScannedCodeBlockNode
  | ScannedThematicBreakNode
  | ScannedTableNode
  | ScannedHtmlBlockNode
  | ScannedUnsupportedBlockNode;

export interface FrontmatterSyntaxNode {
  type: "frontmatter";
  value: string;
}

export type ScannedSyntaxNode = ScannedBlockNode | FrontmatterSyntaxNode;

export interface SyntaxNodeToken extends TokenBase<typeof TokenKind.syntaxNode> {
  node: ScannedBlockNode;
}

export type LexerToken =
  | TokenBase<typeof TokenKind.frontmatterStart>
  | TokenBase<typeof TokenKind.frontmatterText>
  | TokenBase<typeof TokenKind.frontmatterEnd>
  | SyntaxNodeToken
  | TokenBase<typeof TokenKind.eof>;
