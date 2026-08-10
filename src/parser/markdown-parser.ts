import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { parseDocument } from "yaml";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import {
  ASSET_PREFIX,
  DEFAULT_ORDERED_LIST_START,
  DESCRIPTION_ELLIPSIS,
  IMAGE_WIDTH_ATTRIBUTE_PATTERN,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGE_WIDTH_PERCENT,
  MAX_HEADING_DEPTH,
  MIN_IMAGE_WIDTH_PERCENT,
  MIN_HEADING_DEPTH,
  ROUTE_PREFIX
} from "../../constants/runtime.ts";
import type {
  AssetTarget,
  BlockNode,
  BreakNode,
  CodeBlockNode,
  ContentAlignment,
  ContentAlignmentNode,
  DeleteNode,
  EmphasisNode,
  HeadingDepth,
  HeadingNode,
  ImageNode,
  InlineCodeNode,
  InlineNode,
  LinkNode,
  ListItemNode,
  ListNode,
  PageMetadata,
  PageType,
  ParagraphNode,
  RootNode,
  RubyNode,
  SourceDocument,
  StrongNode,
  TableAlignment,
  TableCellNode,
  TableNode,
  TableRowNode,
  TextBlockNode,
  TextNode
} from "../ast/types.ts";

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  checked?: boolean | null;
  lang?: string | null;
  url?: string;
  title?: string | null;
  alt?: string;
  align?: Array<string | null>;
}

interface FrontmatterValues {
  title?: string;
  description?: string;
  type?: PageType;
  indexed?: number;
  source?: string;
  date?: string;
  tags?: string[];
  draft?: boolean;
}

interface FrontmatterResult {
  body: string;
  values: FrontmatterValues;
}

interface RubyMatch {
  node: RubyNode;
  nextIndex: number;
}

interface ImageSizing {
  property: "width" | "max-width";
  percent: number;
}

interface ImageSizingMatch {
  sizing: ImageSizing;
  nextIndex: number;
}

const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

export async function parseMarkdownFile(
  sourcePath: string,
  slug: string,
  displaySourcePath = sourcePath
): Promise<SourceDocument> {
  const source = await readFile(sourcePath, "utf8");
  return parseMarkdown(source, displaySourcePath, slug);
}

export function parseMarkdown(
  source: string,
  sourcePath: string,
  slug = slugFromPath(sourcePath)
): SourceDocument {
  const frontmatter = extractFrontmatter(source);
  const mdast = markdownProcessor.parse(frontmatter.body) as unknown as MarkdownNode;
  const parsedAst = convertRoot(mdast);
  const fallbackTitle = findDocumentTitle(parsedAst) ?? titleizeSlug(slug);
  const firstParagraph = findFirstParagraph(parsedAst);
  const metadata: PageMetadata = {
    title: frontmatter.values.title ?? fallbackTitle,
    description: frontmatter.values.description ?? firstParagraph ?? "",
    type: frontmatter.values.type ?? "page",
    indexed: frontmatter.values.indexed,
    listSource: frontmatter.values.source,
    date: frontmatter.values.date,
    tags: frontmatter.values.tags ?? [],
    draft: frontmatter.values.draft ?? false
  };

  return {
    sourcePath,
    slug,
    ast: appendListNode(removeDocumentTitleHeading(parsedAst), metadata),
    metadata
  };
}

function extractFrontmatter(source: string): FrontmatterResult {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { body: source, values: {} };
  }

  const closingIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (closingIndex < 0) {
    return { body: source, values: {} };
  }

  const endIndex = closingIndex + 1;
  const frontmatterSource = lines.slice(1, endIndex).join("\n");
  const parsed: unknown = parseDocument(frontmatterSource).toJS();
  return {
    body: lines.slice(endIndex + 1).join("\n"),
    values: readFrontmatterValues(parsed)
  };
}

function readFrontmatterValues(value: unknown): FrontmatterValues {
  if (!isRecord(value)) {
    return {};
  }

  return {
    title: readString(value.title),
    description: readString(value.description),
    type: readPageType(value.type),
    indexed: readNumber(value.indexed),
    source: readString(value.source),
    date: readString(value.date),
    tags: readStringArray(value.tags),
    draft: readBoolean(value.draft)
  };
}

function convertRoot(node: MarkdownNode): RootNode {
  const children = convertBlocks(node.children ?? []);
  return { type: "root", children };
}

function convertBlocks(nodes: MarkdownNode[]): BlockNode[] {
  const children: BlockNode[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node === undefined) {
      continue;
    }

    const htmlHeading = node.type === "html" ? parseHtmlHeading(node.value) : null;
    if (htmlHeading !== null) {
      children.push(htmlHeading);
      continue;
    }

    const opening = parseAlignmentOpening(node.value);
    if (node.type === "html" && opening !== null) {
      const closingIndex = findAlignmentClosing(nodes, index + 1);
      if (closingIndex !== null) {
        const alignment: ContentAlignmentNode = {
          type: "content-alignment",
          alignment: opening,
          children: convertBlocks(nodes.slice(index + 1, closingIndex))
        };
        children.push(alignment);
        index = closingIndex;
        continue;
      }
    }

    const converted = convertBlock(node);
    if (converted !== null) {
      children.push(converted);
    }
  }

  return children;
}

function convertBlock(node: MarkdownNode): BlockNode | null {
  switch (node.type) {
    case "paragraph": {
      const paragraph: ParagraphNode = {
        type: "paragraph",
        children: convertInlineChildren(node.children ?? [])
      };
      return paragraph;
    }
    case "heading": {
      const depth = toHeadingDepth(node.depth);
      return {
        type: "heading",
        depth,
        children: convertInlineChildren(node.children ?? [])
      };
    }
    case "list": {
      const list: ListNode = {
        type: "list",
        style: node.ordered === true ? "ordered" : "unordered",
        start: node.ordered === true ? node.start ?? DEFAULT_ORDERED_LIST_START : null,
        items: (node.children ?? [])
          .map(convertListItem)
          .filter((item): item is ListItemNode => item !== null)
      };
      return list;
    }
    case "blockquote":
      return {
        type: "blockquote",
        children: convertBlocks(node.children ?? [])
      };
    case "code": {
      const codeBlock: CodeBlockNode = {
        type: "code-block",
        language: node.lang ?? null,
        value: node.value ?? ""
      };
      return codeBlock;
    }
    case "thematicBreak":
      return { type: "thematic-break" };
    case "table":
      return convertTable(node);
    case "html": {
      const textBlock: TextBlockNode = {
        type: "text-block",
        value: node.value ?? ""
      };
      return textBlock;
    }
    case "definition":
    case "yaml":
      return null;
    default:
      return fallbackBlock(node);
  }
}

function convertListItem(node: MarkdownNode): ListItemNode | null {
  if (node.type !== "listItem") {
    return null;
  }

  return {
    type: "list-item",
    children: convertBlocks(node.children ?? []),
    checked: node.checked ?? null
  };
}

function parseHtmlHeading(value: string | undefined): HeadingNode | null {
  if (value === undefined) {
    return null;
  }

  const match = /^<h([1-5])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>$/iu.exec(value.trim());
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }

  const innerRoot = markdownProcessor.parse(match[2]) as unknown as MarkdownNode;
  const paragraph = innerRoot.children?.[0];
  if (paragraph?.type !== "paragraph") {
    return null;
  }

  return {
    type: "heading",
    depth: Number(match[1]) as HeadingDepth,
    children: convertInlineChildren(paragraph.children ?? [])
  };
}

function findAlignmentClosing(nodes: MarkdownNode[], startIndex: number): number | null {
  for (let index = startIndex; index < nodes.length; index += 1) {
    if (nodes[index]?.type === "html" && nodes[index]?.value?.trim().toLowerCase() === "</div>") {
      return index;
    }
  }
  return null;
}

function parseAlignmentOpening(value: string | undefined): ContentAlignment | null {
  if (value === undefined) {
    return null;
  }

  const normalizedValue = value.trim();
  const alignAttribute = /^<div\s+align\s*=\s*["']?(left|center|right)["']?\s*>$/iu.exec(normalizedValue);
  if (alignAttribute?.[1] !== undefined) {
    return alignAttribute[1].toLowerCase() as ContentAlignment;
  }

  const styleAttribute = /^<div\s+style\s*=\s*["']?\s*text-align\s*:\s*(left|center|right)\s*;?\s*["']?\s*>$/iu.exec(normalizedValue);
  if (styleAttribute?.[1] !== undefined) {
    return styleAttribute[1].toLowerCase() as ContentAlignment;
  }

  return null;
}

function convertTable(node: MarkdownNode): TableNode {
  const alignments: TableAlignment[] = (node.align ?? []).map((alignment) => {
    if (alignment === "left" || alignment === "center" || alignment === "right") {
      return alignment;
    }
    return null;
  });

  const rows: TableRowNode[] = (node.children ?? []).map((row) => ({
    type: "table-row",
    cells: (row.children ?? []).map((cell) => ({
      type: "table-cell",
      children: convertInlineChildren(cell.children ?? [])
    }))
  }));

  return { type: "table", alignments, rows };
}

function convertInlineChildren(nodes: MarkdownNode[]): InlineNode[] {
  const result: InlineNode[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node === undefined) {
      continue;
    }

    const ruby = consumeRuby(nodes, index);
    if (ruby !== null) {
      result.push(ruby.node);
      index = ruby.nextIndex;
      continue;
    }

    const converted = convertInline(node);
    if (converted === null) {
      continue;
    }

    if (converted.type !== "image") {
      result.push(converted);
      continue;
    }

    const sizing = consumeImageSizing(nodes, index);
    if (sizing === null) {
      result.push(converted);
      continue;
    }

    result.push(applyImageSizing(converted, sizing.sizing));
    index = sizing.nextIndex;
  }

  return result;
}

function convertInline(node: MarkdownNode): InlineNode | null {
  switch (node.type) {
    case "text":
    case "html":
      return textNode(node.value ?? "");
    case "emphasis": {
      const emphasis: EmphasisNode = {
        type: "emphasis",
        children: convertInlineChildren(node.children ?? [])
      };
      return emphasis;
    }
    case "strong": {
      const strong: StrongNode = {
        type: "strong",
        children: convertInlineChildren(node.children ?? [])
      };
      return strong;
    }
    case "delete": {
      const deleted: DeleteNode = {
        type: "delete",
        children: convertInlineChildren(node.children ?? [])
      };
      return deleted;
    }
    case "inlineCode": {
      const inlineCode: InlineCodeNode = {
        type: "inline-code",
        value: node.value ?? ""
      };
      return inlineCode;
    }
    case "link": {
      const url = node.url ?? "";
      const link: LinkNode = {
        type: "link",
        target: parseLinkTarget(url),
        title: node.title ?? null,
        children: convertInlineChildren(node.children ?? [])
      };
      return link;
    }
    case "image": {
      const image: ImageNode = {
        type: "image",
        src: parseImageSource(node.url ?? ""),
        alt: node.alt ?? "",
        title: node.title ?? null
      };
      return image;
    }
    case "break": {
      const lineBreak: BreakNode = { type: "break" };
      return lineBreak;
    }
    case "linkReference":
    case "imageReference":
      return textNode(plainText(node));
    default:
      return textNode(plainText(node));
  }
}

function consumeImageSizing(nodes: MarkdownNode[], imageIndex: number): ImageSizingMatch | null {
  const attribute = nodes[imageIndex + 1];
  if (attribute?.type !== "text" || attribute.value === undefined) {
    return null;
  }

  const match = IMAGE_WIDTH_ATTRIBUTE_PATTERN.exec(attribute.value);
  if (match === null) {
    return null;
  }

  const property = match.groups?.property;
  const rawValue = match.groups?.value;
  if ((property !== "width" && property !== "max-width") || rawValue === undefined) {
    return null;
  }

  const percent = Number(rawValue);
  if (
    !Number.isFinite(percent)
    || percent < MIN_IMAGE_WIDTH_PERCENT
    || percent > MAX_IMAGE_WIDTH_PERCENT
  ) {
    throw new Error(
      `Image ${property} must be between ${MIN_IMAGE_WIDTH_PERCENT}% and ${MAX_IMAGE_WIDTH_PERCENT}%`
    );
  }

  return {
    sizing: { property, percent },
    nextIndex: imageIndex + 1
  };
}

function applyImageSizing(image: ImageNode, sizing: ImageSizing): ImageNode {
  return sizing.property === "width"
    ? { ...image, forcedWidthPercent: sizing.percent }
    : { ...image, maxWidthPercent: sizing.percent };
}

function consumeRuby(nodes: MarkdownNode[], startIndex: number): RubyMatch | null {
  const opening = nodes[startIndex];
  if (opening === undefined || !isHtmlTag(opening.value, "ruby", false)) {
    return null;
  }

  let base = "";
  let annotation = "";
  let insideAnnotation = false;

  for (let index = startIndex + 1; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node === undefined) {
      continue;
    }

    if (node.type === "html" && isHtmlTag(node.value, "rt", false)) {
      insideAnnotation = true;
      continue;
    }
    if (node.type === "html" && isHtmlTag(node.value, "rt", true)) {
      insideAnnotation = false;
      continue;
    }
    if (node.type === "html" && isHtmlTag(node.value, "ruby", true)) {
      const trimmedBase = base.trim();
      const trimmedAnnotation = annotation.trim();
      if (trimmedBase.length === 0 || trimmedAnnotation.length === 0) {
        return null;
      }

      return {
        node: { type: "ruby", base: trimmedBase, annotation: trimmedAnnotation },
        nextIndex: index
      };
    }

    const value = plainText(node);
    if (insideAnnotation) {
      annotation += value;
    } else {
      base += value;
    }
  }

  return null;
}

function isHtmlTag(value: string | undefined, tag: string, closing: boolean): boolean {
  if (value === undefined) {
    return false;
  }

  const escapedTag = closing ? `</${tag}>` : `<${tag}>`;
  return value.trim().toLowerCase() === escapedTag;
}

function parseLinkTarget(url: string) {
  if (url.startsWith(ROUTE_PREFIX)) {
    const name = url.slice(ROUTE_PREFIX.length).trim();
    return { type: "route" as const, name };
  }

  if (url.startsWith(ASSET_PREFIX)) {
    return { type: "asset" as const, name: url.slice(ASSET_PREFIX.length).trim() };
  }

  if (/^(?:https?:|mailto:|tel:|ftp:)/iu.test(url)) {
    return { type: "external" as const, href: url };
  }

  return { type: "relative" as const, href: url };
}

function parseImageSource(url: string): string | AssetTarget {
  if (!url.startsWith(ASSET_PREFIX)) {
    return url;
  }
  return { type: "asset", name: url.slice(ASSET_PREFIX.length).trim() };
}

function fallbackBlock(node: MarkdownNode): BlockNode | null {
  const value = plainText(node);
  if (value.length === 0) {
    return null;
  }
  return { type: "text-block", value };
}

function textNode(value: string): TextNode {
  return { type: "text", value };
}

function plainText(node: MarkdownNode): string {
  if (node.value !== undefined) {
    return node.value;
  }
  return (node.children ?? []).map(plainText).join("");
}

function findDocumentTitle(ast: RootNode): string | null {
  const heading = ast.children.find((child): child is Extract<BlockNode, { type: "heading" }> => child.type === "heading");
  return heading === undefined ? null : inlineText(heading.children).trim() || null;
}

function findFirstParagraph(ast: RootNode): string | null {
  const paragraph = ast.children.find((child): child is ParagraphNode => child.type === "paragraph");
  if (paragraph === undefined) {
    return null;
  }

  const value = inlineText(paragraph.children).replace(/\s+/gu, " ").trim();
  const truncatedLength = MAX_DESCRIPTION_LENGTH - DESCRIPTION_ELLIPSIS.length;
  return value.length > MAX_DESCRIPTION_LENGTH
    ? `${value.slice(0, truncatedLength)}${DESCRIPTION_ELLIPSIS}`
    : value || null;
}

function removeDocumentTitleHeading(ast: RootNode): RootNode {
  const firstChild = ast.children[0];
  if (firstChild?.type !== "heading" || firstChild.depth !== 1) {
    return ast;
  }

  return { type: "root", children: ast.children.slice(1) };
}

function appendListNode(ast: RootNode, metadata: PageMetadata): RootNode {
  if (metadata.type !== "list") {
    return ast;
  }
  if (metadata.listSource === undefined || metadata.listSource.trim().length === 0) {
    throw new Error(`List page ${metadata.title} must declare a non-empty source`);
  }

  const collectionName = metadata.listSource
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/gu, "");
  return {
    type: "root",
    children: [...ast.children, { type: "collection", name: collectionName }]
  };
}

function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "inline-code":
        case "ruby":
          return node.type === "ruby" ? node.base : node.value;
        case "break":
          return " ";
        case "image":
          return node.alt;
        case "link":
        case "emphasis":
        case "strong":
        case "delete":
          return inlineText(node.children);
      }
    })
    .join("");
}

function slugFromPath(sourcePath: string): string {
  return basename(sourcePath, extname(sourcePath));
}

function titleizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function toHeadingDepth(depth: number | undefined): HeadingDepth {
  const safeDepth = Math.min(
    MAX_HEADING_DEPTH,
    Math.max(MIN_HEADING_DEPTH, depth ?? MIN_HEADING_DEPTH)
  );
  return safeDepth as HeadingDepth;
}

function readPageType(value: unknown): PageType | undefined {
  return value === "page" || value === "list" ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
