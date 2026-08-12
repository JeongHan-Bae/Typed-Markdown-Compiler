import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { parseDocument } from "yaml";
import {
  ASSET_PREFIX,
  DEFAULT_ORDERED_LIST_START,
  DESCRIPTION_ELLIPSIS,
  IMAGE_WIDTH_ATTRIBUTE_PATTERN,
  MAX_DESCRIPTION_LENGTH,
  MAX_HEADING_DEPTH,
  MAX_IMAGE_WIDTH_PERCENT,
  MIN_HEADING_DEPTH,
  MIN_IMAGE_WIDTH_PERCENT,
  ROUTE_PREFIX
} from "../../constants/runtime.ts";
import type {
  AssetTarget,
  BlockNode,
  ContentAlignment,
  HeadingDepth,
  HeadingNode,
  ImageNode,
  InlineNode,
  LinkNode,
  ListItemNode,
  ListNode,
  PageMetadata,
  PageType,
  ParagraphNode,
  RootNode,
  SourceDocument,
  TableAlignment,
  TableCellNode,
  TableNode,
  TableRowNode
} from "../ast/types.ts";
import { scanMarkdown } from "../compiler/scanner.ts";
import {
  parseHtmlFragment,
  parseHtmlTagAttributes,
  type HtmlElementNode,
  type HtmlNode,
  type HtmlTagAttributes
} from "../compiler/html-tree.ts";
import type {
  ScannedBlockNode,
  ScannedHtmlContainerNode,
  ScannedHtmlNode,
  ScannedHtmlTreeNode,
  ScannedInlineNode,
  SyntaxNodeToken,
  LexerToken
} from "../tokens/types.ts";

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

interface InlineParseResult {
  nodes: InlineNode[];
  nextIndex: number;
}

interface SyntaxEntry {
  node: ScannedBlockNode;
  raw: string;
}

/**
 * Parse through the project's token and AST contracts. Source recognition is
 * delegated to Unified/Remark by `scanMarkdown`; this layer only normalizes
 * the scanned syntax into the project's stable AST.
 */
export function parseMarkdown(
  source: string,
  sourcePath: string,
  slug = slugFromPath(sourcePath)
): SourceDocument {
  return parseMarkdownTokens(scanMarkdown(source), sourcePath, slug);
}

export async function parseMarkdownFile(
  sourcePath: string,
  slug: string,
  displaySourcePath = sourcePath
): Promise<SourceDocument> {
  const source = await readFile(sourcePath, "utf8");
  return parseMarkdown(source, displaySourcePath, slug);
}

export function parseMarkdownTokens(
  tokens: readonly LexerToken[],
  sourcePath: string,
  slug = slugFromPath(sourcePath)
): SourceDocument {
  const frontmatterSource = tokens
    .filter((token) => token.kind === "frontmatter-text")
    .map((token) => token.lexeme)
    .join("\n");
  const frontmatter = readFrontmatter(frontmatterSource.length === 0 ? null : frontmatterSource);
  const syntaxEntries = tokens
    .filter((token): token is SyntaxNodeToken => token.kind === "syntax-node")
    .map((token): SyntaxEntry => ({ node: token.node, raw: token.lexeme }));
  const parsedAst: RootNode = {
    type: "root",
    children: normalizeSyntaxEntries(syntaxEntries)
  };
  const directoryIndexSource = inferDirectoryIndexSource(sourcePath);
  if (directoryIndexSource !== null && frontmatter.type === "page") {
    throw new Error(`${sourcePath} is a directory index and is implicitly a list`);
  }
  if (directoryIndexSource !== null && frontmatter.source !== undefined) {
    throw new Error(`${sourcePath} must not declare source; its list source is ${directoryIndexSource}/`);
  }
  const fallbackTitle = findDocumentTitle(parsedAst) ?? titleizeSlug(slug);
  const firstParagraph = findFirstParagraph(parsedAst);
  const metadata: PageMetadata = {
    title: frontmatter.title ?? fallbackTitle,
    description: frontmatter.description ?? firstParagraph ?? "",
    type: frontmatter.type ?? (directoryIndexSource === null ? "page" : "list"),
    indexed: frontmatter.indexed,
    listSource: directoryIndexSource === null ? frontmatter.source : `${directoryIndexSource}/`,
    date: frontmatter.date,
    tags: frontmatter.tags ?? [],
    draft: frontmatter.draft ?? false
  };

  return {
    sourcePath,
    slug,
    ast: appendListNode(removeDocumentTitleHeading(parsedAst), metadata),
    metadata
  };
}

function normalizeSyntaxEntries(entries: readonly SyntaxEntry[]): BlockNode[] {
  const result: BlockNode[] = [];
  let index = 0;
  while (index < entries.length) {
    const entry = entries[index];
    if (entry === undefined) {
      index += 1;
      continue;
    }

    const opening = entry.node.type === "html-block"
      ? parseHtmlTagAttributes(entry.node.value)
      : null;
    if (opening !== null && !opening.closing && !opening.selfClosing) {
      const closingIndex = findHtmlBlockEntryClosing(entries, index + 1, opening.name);
      if (closingIndex !== null) {
        const inner = entries.slice(index + 1, closingIndex);
        if (opening.name === "div") {
          const alignment = readContentAlignment(opening.attributes);
          if (alignment !== null) {
            result.push({
              type: "content-alignment",
              alignment,
              children: normalizeSyntaxEntries(inner)
            });
            index = closingIndex + 1;
            continue;
          }
        }
        if (/^h[1-5]$/u.test(opening.name)) {
          const heading: HeadingNode = {
            type: "heading",
            depth: Number(opening.name.slice(1)) as HeadingDepth,
            children: normalizeSyntaxInlineEntries(inner)
          };
          const alignment = readContentAlignment(opening.attributes);
          result.push(alignment === null
            ? heading
            : { type: "content-alignment", alignment, children: [heading] });
          index = closingIndex + 1;
          continue;
        }
        if (opening.name === "blockquote") {
          result.push({
            type: "blockquote",
            children: normalizeSyntaxEntries(inner)
          });
          index = closingIndex + 1;
          continue;
        }
        if (opening.name === "ul" || opening.name === "ol") {
          result.push(...normalizeHtmlEntryContainer(entries, index, closingIndex));
          index = closingIndex + 1;
          continue;
        }
        if (opening.name === "pre") {
          result.push(...normalizeHtmlEntryContainer(entries, index, closingIndex));
          index = closingIndex + 1;
          continue;
        }
        if (opening.name === "table") {
          result.push(...normalizeHtmlEntryContainer(entries, index, closingIndex));
          index = closingIndex + 1;
          continue;
        }
      }
    }

    result.push(...normalizeBlock(entry.node));
    index += 1;
  }
  return result;
}

function normalizeHtmlEntryContainer(
  entries: readonly SyntaxEntry[],
  openingIndex: number,
  closingIndex: number
): BlockNode[] {
  const source = entries
    .slice(openingIndex, closingIndex + 1)
    .map((entry) => entry.raw)
    .join("\n");
  const tree = parseHtmlFragment(source);
  if (tree === null) {
    return [{ type: "text-block", value: source }];
  }
  const blocks = normalizeHtmlTreeBlocks(tree);
  return blocks === null ? [{ type: "text-block", value: source }] : blocks;
}

function normalizeSyntaxInlineEntries(entries: readonly SyntaxEntry[]): InlineNode[] {
  return normalizeInlineNodes(entries.flatMap((entry) => {
    if (entry.node.type === "paragraph") {
      return entry.node.children;
    }
    return [];
  }));
}

function findHtmlBlockEntryClosing(
  entries: readonly SyntaxEntry[],
  startIndex: number,
  tagName: string
): number | null {
  let nested = 0;
  for (let index = startIndex; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry?.node.type !== "html-block") {
      continue;
    }
    const tag = parseHtmlTagAttributes(entry.node.value);
    if (tag === null || tag.name !== tagName) {
      continue;
    }
    if (tag.closing) {
      if (nested === 0) {
        return index;
      }
      nested -= 1;
    } else if (!tag.selfClosing) {
      nested += 1;
    }
  }
  return null;
}

function normalizeBlock(node: ScannedBlockNode): BlockNode[] {
  switch (node.type) {
    case "paragraph":
      return [{ type: "paragraph", children: normalizeInlineNodes(node.children) }];
    case "heading":
      return [{
        type: "heading",
        depth: toHeadingDepth(node.depth),
        children: normalizeInlineNodes(node.children)
      }];
    case "list":
      return [{
        type: "list",
        style: node.style,
        start: node.style === "ordered" ? node.start : null,
        items: node.items.map(normalizeListItem)
      }];
    case "blockquote":
      return [{
        type: "blockquote",
        children: node.children.flatMap(normalizeBlock)
      }];
    case "code-block":
      return [{
        type: "code-block",
        language: node.language,
        value: node.value
      }];
    case "thematic-break":
      return [{ type: "thematic-break" }];
    case "table":
      return [{
        type: "table",
        alignments: node.alignments,
        rows: node.rows.map(normalizeTableRow)
      }];
    case "html-block":
      return normalizeHtmlBlock(node.value, node.tree);
    case "unsupported-block":
      return [{ type: "text-block", value: node.value }];
  }
}

function normalizeListItem(item: Extract<ScannedBlockNode, { type: "list" }>['items'][number]): ListItemNode {
  return {
    type: "list-item",
    children: item.children.flatMap(normalizeBlock),
    checked: item.checked
  };
}

function normalizeTableRow(row: Extract<ScannedBlockNode, { type: "table" }>['rows'][number]): TableRowNode {
  return {
    type: "table-row",
    cells: row.cells.map((cell): TableCellNode => ({
      type: "table-cell",
      children: normalizeInlineNodes(cell.children)
    }))
  };
}

function normalizeInlineNodes(nodes: readonly ScannedInlineNode[]): InlineNode[] {
  const result: InlineNode[] = [];
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index];
    if (node === undefined) {
      index += 1;
      continue;
    }

    if (node.type === "html-container") {
      const inline = normalizeHtmlTreeInlineChildren(localizeHtmlTree(node.tree));
      if (inline === null) {
        result.push({ type: "text", value: node.value });
      } else {
        result.push(...inline);
      }
      index += 1;
      continue;
    }

    if (node.type === "html") {
      const parsed = parseHtmlInlineAt(nodes, index);
      if (parsed !== null) {
        result.push(...parsed.nodes);
        index = parsed.nextIndex;
        continue;
      }
      result.push({ type: "text", value: node.value });
      index += 1;
      continue;
    }

    const normalized = normalizeInlineNode(node);
    if (normalized !== null) {
      if (normalized.type === "image") {
        const sizing = nodes[index + 1];
        if (sizing?.type === "text") {
          const match = IMAGE_WIDTH_ATTRIBUTE_PATTERN.exec(sizing.value);
          const property = match?.groups?.property;
          const rawPercent = match?.groups?.value;
          if (
            (property === "width" || property === "max-width")
            && rawPercent !== undefined
          ) {
            applyImageSizing(normalized, property, Number(rawPercent));
            index += 1;
          }
        }
      }
      result.push(normalized);
    }
    index += 1;
  }
  return result;
}

function normalizeInlineNode(
  node: Exclude<ScannedInlineNode, ScannedHtmlNode | ScannedHtmlContainerNode>
): InlineNode | null {
  switch (node.type) {
    case "text":
      return { type: "text", value: node.value };
    case "emphasis":
      return { type: "emphasis", children: normalizeInlineNodes(node.children) };
    case "strong":
      return { type: "strong", children: normalizeInlineNodes(node.children) };
    case "delete":
      return { type: "delete", children: normalizeInlineNodes(node.children) };
    case "inline-code":
      return { type: "inline-code", value: node.value };
    case "link": {
      const link: LinkNode = {
        type: "link",
        target: parseLinkTarget(node.url),
        title: node.title,
        children: normalizeInlineNodes(node.children)
      };
      return link;
    }
    case "image": {
      const image: ImageNode = {
        type: "image",
        src: parseImageSource(node.url),
        alt: node.alt,
        title: node.title
      };
      if (node.forcedWidthPercent !== undefined) {
        applyImageSizing(image, "width", node.forcedWidthPercent);
      }
      if (node.maxWidthPercent !== undefined) {
        applyImageSizing(image, "max-width", node.maxWidthPercent);
      }
      return image;
    }
    case "break":
      return { type: "break" };
  }
}

function normalizeHtmlBlock(
  value: string,
  scannedTree: readonly ScannedHtmlTreeNode[] | null
): BlockNode[] {
  if (scannedTree === null) {
    return [{ type: "text-block", value }];
  }
  const normalizedTree = normalizeHtmlTreeBlocks(localizeHtmlTree(scannedTree));
  return normalizedTree === null
    ? [{ type: "text-block", value }]
    : normalizedTree;
}

function localizeHtmlTree(nodes: readonly ScannedHtmlTreeNode[]): HtmlNode[] {
  return nodes.map((node): HtmlNode => node.type === "html-text"
    ? { type: "text", value: node.value }
    : {
      type: "element",
      name: node.name,
      attributes: new Map(Object.entries(node.attributes)),
      children: localizeHtmlTree(node.children)
    });
}

function normalizeHtmlTreeBlocks(nodes: readonly HtmlNode[]): BlockNode[] | null {
  const result: BlockNode[] = [];
  let inlineNodes: HtmlNode[] = [];

  const flushInline = (): boolean => {
    if (inlineNodes.length === 0) {
      return true;
    }
    if (inlineNodes.every((node) => node.type === "text" && node.value.trim().length === 0)) {
      inlineNodes = [];
      return true;
    }
    const inline = normalizeHtmlTreeInlineChildren(inlineNodes);
    if (inline === null) {
      return false;
    }
    if (inline.length > 0) {
      result.push({ type: "paragraph", children: inline });
    }
    inlineNodes = [];
    return true;
  };

  for (const node of nodes) {
    if (node.type === "element" && isHtmlBlockElement(node.name)) {
      if (!flushInline()) {
        return null;
      }
      const block = normalizeHtmlTreeBlock(node);
      if (block === null) {
        return null;
      }
      result.push(...block);
      continue;
    }
    inlineNodes.push(node);
  }

  return flushInline() ? result : null;
}

function isHtmlBlockElement(name: string): boolean {
  return name === "div"
    || name === "p"
    || /^h[1-5]$/u.test(name)
    || name === "blockquote"
    || name === "ul"
    || name === "ol"
    || name === "pre"
    || name === "table"
    || name === "hr";
}

function normalizeHtmlTreeBlock(node: HtmlElementNode): BlockNode[] | null {
  const tag = htmlElementTag(node);
  if (node.name === "div") {
    const alignment = readContentAlignment(node.attributes);
    if (alignment === null) {
      return null;
    }
    const children = normalizeHtmlTreeBlocks(node.children);
    return children === null
      ? null
      : [{ type: "content-alignment", alignment, children }];
  }

  if (/^h[1-5]$/u.test(node.name)) {
    const children = normalizeHtmlTreeInlineChildren(node.children);
    return children === null
      ? null
      : [{
        type: "heading",
        depth: Number(node.name.slice(1)) as HeadingDepth,
        children
      }];
  }

  if (node.name === "p") {
    const children = normalizeHtmlTreeInlineChildren(node.children);
    return children === null ? null : [{ type: "paragraph", children }];
  }

  if (node.name === "blockquote") {
    const children = normalizeHtmlTreeBlocks(node.children);
    return children === null ? null : [{ type: "blockquote", children }];
  }

  if (node.name === "ul" || node.name === "ol") {
    const list = normalizeHtmlTreeList(node);
    return list === null ? null : [list];
  }

  if (node.name === "pre") {
    const code = normalizeHtmlTreeCodeBlock(node);
    return code === null ? null : [code];
  }

  if (node.name === "table") {
    const table = normalizeHtmlTreeTable(node);
    return table === null ? null : [table];
  }

  if (node.name === "hr") {
    return node.children.length === 0 ? [{ type: "thematic-break" }] : null;
  }

  if (node.name === "img") {
    const image = normalizeHtmlImage(tag);
    return image === null ? null : [{ type: "paragraph", children: [image] }];
  }

  return null;
}

function normalizeHtmlTreeInlineChildren(nodes: readonly HtmlNode[]): InlineNode[] | null {
  const result: InlineNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      result.push(...normalizeHtmlTextInline(node.value));
      continue;
    }
    const normalized = normalizeHtmlTreeInlineElement(node);
    if (normalized === null) {
      return null;
    }
    result.push(...normalized);
  }
  return result;
}

function normalizeHtmlTextInline(value: string): InlineNode[] {
  if (value.length === 0) {
    return [];
  }
  if (!/[\\*_~`[\]!]/u.test(value)) {
    return [{ type: "text", value }];
  }
  const syntax = scanMarkdown(value)
    .filter((token): token is SyntaxNodeToken => token.kind === "syntax-node");
  if (syntax.length === 1 && syntax[0]?.node.type === "paragraph") {
    return normalizeInlineNodes(syntax[0].node.children);
  }
  return [{ type: "text", value }];
}

function normalizeHtmlTreeInlineElement(node: HtmlElementNode): InlineNode[] | null {
  const tag = htmlElementTag(node);
  if (node.name === "br") {
    return node.children.length === 0 ? [{ type: "break" }] : null;
  }
  if (node.name === "img") {
    const image = normalizeHtmlImage(tag);
    return image === null ? null : [image];
  }
  if (node.name === "ruby") {
    const annotation = node.children.find(
      (child): child is HtmlElementNode => child.type === "element" && child.name === "rt"
    );
    if (annotation === undefined) {
      return null;
    }
    const base = htmlTreeTextContent(node.children.filter((child) => child !== annotation)).trim();
    const annotationText = htmlTreeTextContent(annotation.children).trim();
    return base.length === 0 || annotationText.length === 0
      ? null
      : [{ type: "ruby", base, annotation: annotationText }];
  }

  if (node.name === "code" || node.name === "tt") {
    return [{ type: "inline-code", value: htmlTreeTextContent(node.children) }];
  }

  const children = normalizeHtmlTreeInlineChildren(node.children);
  if (children === null) {
    return null;
  }
  if (node.name === "p") {
    return children;
  }
  if (node.name === "strong" || node.name === "b") {
    return [{ type: "strong", children }];
  }
  if (node.name === "em" || node.name === "i") {
    return [{ type: "emphasis", children }];
  }
  if (node.name === "del" || node.name === "s" || node.name === "strike") {
    return [{ type: "delete", children }];
  }
  if (node.name === "a") {
    const href = node.attributes.get("href");
    return href === undefined
      ? null
      : [{
        type: "link",
        target: parseLinkTarget(href),
        title: node.attributes.get("title") ?? null,
        children
      }];
  }
  return null;
}

function normalizeHtmlTreeList(node: HtmlElementNode): ListNode | null {
  const items: ListItemNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && child.value.trim().length === 0) {
      continue;
    }
    if (child.type !== "element" || child.name !== "li") {
      return null;
    }
    const item = normalizeHtmlTreeListItem(child);
    if (item === null) {
      return null;
    }
    items.push(item);
  }
  if (items.length === 0) {
    return null;
  }
  return {
    type: "list",
    style: node.name === "ol" ? "ordered" : "unordered",
    start: node.name === "ol" ? parseHtmlListStart(node.attributes.get("start")) : null,
    items
  };
}

function normalizeHtmlTreeListItem(node: HtmlElementNode): ListItemNode | null {
  let checked: boolean | null = null;
  const content = node.children.filter((child) => {
    if (child.type !== "element" || child.name !== "input") {
      return true;
    }
    if (child.attributes.get("type")?.toLowerCase() !== "checkbox") {
      return true;
    }
    checked = child.attributes.has("checked");
    return false;
  });
  const children = normalizeHtmlTreeBlocks(content);
  if (children === null) {
    return null;
  }
  return { type: "list-item", children, checked };
}

function normalizeHtmlTreeCodeBlock(
  node: HtmlElementNode
): Extract<BlockNode, { type: "code-block" }> | null {
  for (const child of node.children) {
    if (child.type === "text" && child.value.trim().length === 0) {
      continue;
    }
    if (child.type !== "element" || child.name !== "code") {
      return null;
    }
  }
  const code = node.children.find(
    (child): child is HtmlElementNode => child.type === "element" && child.name === "code"
  );
  const className = code?.attributes.get("class") ?? "";
  const language = /(?:^|\s)language-([^\s]+)/iu.exec(className)?.[1] ?? null;
  const value = htmlTreeTextContent(code?.children ?? node.children)
    .replace(/^\r?\n/u, "")
    .replace(/\r?\n$/u, "");
  return { type: "code-block", language, value };
}

function normalizeHtmlTreeTable(node: HtmlElementNode): TableNode | null {
  const rows = collectHtmlTableRows(node.children);
  if (rows === null || rows.length === 0) {
    return null;
  }
  const alignments: TableAlignment[] = [];
  const normalizedRows: TableRowNode[] = [];
  for (const row of rows) {
    const cells: TableCellNode[] = [];
    for (const child of row.children) {
      if (child.type === "text" && child.value.trim().length === 0) {
        continue;
      }
      if (child.type !== "element" || (child.name !== "th" && child.name !== "td")) {
        return null;
      }
      const alignment = readContentAlignment(child.attributes);
      const column = cells.length;
      if (alignments[column] === undefined || alignment !== null) {
        alignments[column] = alignment;
      }
      const inline = normalizeHtmlTreeInlineChildren(child.children);
      if (inline === null) {
        return null;
      }
      cells.push({ type: "table-cell", children: inline });
    }
    if (cells.length === 0) {
      return null;
    }
    normalizedRows.push({ type: "table-row", cells });
  }
  return { type: "table", alignments, rows: normalizedRows };
}

function collectHtmlTableRows(nodes: readonly HtmlNode[]): HtmlElementNode[] | null {
  const rows: HtmlElementNode[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      if (node.value.trim().length > 0) {
        return null;
      }
      continue;
    }
    if (node.name === "tr") {
      rows.push(node);
    } else if (node.name === "thead" || node.name === "tbody" || node.name === "tfoot") {
      const nested = collectHtmlTableRows(node.children);
      if (nested === null) {
        return null;
      }
      rows.push(...nested);
    } else {
      return null;
    }
  }
  return rows;
}

function htmlElementTag(node: HtmlElementNode): HtmlTagAttributes {
  return {
    name: node.name,
    closing: false,
    selfClosing: node.children.length === 0,
    attributes: node.attributes
  };
}

function htmlTreeTextContent(nodes: readonly HtmlNode[]): string {
  return nodes.map((node) => node.type === "text"
    ? node.value
    : htmlTreeTextContent(node.children)).join("");
}

function parseHtmlInlineAt(
  nodes: readonly ScannedInlineNode[],
  startIndex: number
): InlineParseResult | null {
  const openingNode = nodes[startIndex];
  if (openingNode?.type !== "html") {
    return null;
  }

  const directTree = parseHtmlFragment(openingNode.value);
  if (directTree?.length === 1 && directTree[0]?.type === "element") {
    const normalized = normalizeHtmlTreeInlineElement(directTree[0]);
    if (normalized === null) {
      return null;
    }
    return consumeInlineImageSizing(normalized, nodes, startIndex + 1);
  }

  const opening = parseHtmlTagAttributes(openingNode.value);
  if (opening === null || opening.closing) {
    return null;
  }

  if (opening.name === "br") {
    return { nodes: [{ type: "break" }], nextIndex: startIndex + 1 };
  }
  if (opening.name === "img") {
    const image = normalizeHtmlImage(opening);
    if (image === null) {
      return null;
    }
    return consumeInlineImageSizing([image], nodes, startIndex + 1);
  }

  const closingIndex = findHtmlClosing(nodes, startIndex + 1, opening.name);
  if (closingIndex === null) {
    return null;
  }
  const source = nodes
    .slice(startIndex, closingIndex + 1)
    .map((node) => inlineSyntaxToRawText([node]))
    .join("");
  const tree = parseHtmlFragment(source);
  if (tree?.length !== 1 || tree[0]?.type !== "element") {
    return null;
  }
  const normalized = normalizeHtmlTreeInlineElement(tree[0]);
  if (normalized === null) {
    return null;
  }
  return {
    nodes: normalized,
    nextIndex: closingIndex + 1
  };
}

function consumeInlineImageSizing(
  nodes: readonly InlineNode[],
  sourceNodes: readonly ScannedInlineNode[],
  nextIndex: number
): InlineParseResult {
  const image = nodes.length === 1 && nodes[0]?.type === "image" ? nodes[0] : null;
  if (image === null) {
    return { nodes: [...nodes], nextIndex };
  }
  const sizing = sourceNodes[nextIndex];
  if (sizing?.type !== "text") {
    return { nodes: [...nodes], nextIndex };
  }
  const match = IMAGE_WIDTH_ATTRIBUTE_PATTERN.exec(sizing.value);
  const property = match?.groups?.property;
  const rawPercent = match?.groups?.value;
  if (
    (property !== "width" && property !== "max-width")
    || rawPercent === undefined
  ) {
    return { nodes: [...nodes], nextIndex };
  }
  applyImageSizing(image, property, Number(rawPercent));
  return { nodes: [...nodes], nextIndex: nextIndex + 1 };
}

function findHtmlClosing(
  nodes: readonly ScannedInlineNode[],
  startIndex: number,
  name: string
): number | null {
  let nested = 0;
  for (let index = startIndex; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node?.type !== "html") {
      continue;
    }
    const tag = parseHtmlTagAttributes(node.value);
    if (tag === null || tag.name !== name) {
      continue;
    }
    if (tag.closing) {
      if (nested === 0) {
        return index;
      }
      nested -= 1;
    } else if (!tag.selfClosing) {
      nested += 1;
    }
  }
  return null;
}

function normalizeHtmlImage(tag: HtmlTagAttributes): ImageNode | null {
  const source = tag.attributes.get("src");
  if (source === undefined) {
    return null;
  }
  const image: ImageNode = {
    type: "image",
    src: parseImageSource(source),
    alt: tag.attributes.get("alt") ?? "",
    title: tag.attributes.get("title") ?? null
  };
  const sizing = readHtmlImageSizing(tag.attributes);
  if (sizing === false) {
    return null;
  }
  if (sizing !== null) {
    applyImageSizing(image, sizing.property, sizing.percent);
  }
  return image;
}

function applyImageSizing(
  image: ImageNode,
  property: "width" | "max-width",
  percent: number
): void {
  validateImagePercent(property, percent);
  if (property === "width") {
    image.forcedWidthPercent = percent;
  } else {
    image.maxWidthPercent = percent;
  }
}

function readHtmlImageSizing(
  attributes: ReadonlyMap<string, string>
): { property: "width" | "max-width"; percent: number } | null | false {
  const declarations: { property: "width" | "max-width"; percent: number }[] = [];
  for (const property of ["width", "max-width"] as const) {
    const value = attributes.get(property);
    if (value !== undefined) {
      const percent = readHtmlImageWidth(value);
      if (percent === null) {
        return false;
      }
      declarations.push({ property, percent });
    }
  }
  const style = attributes.get("style") ?? "";
  for (const declaration of style.split(";")) {
    const match = /^\s*(width|max-width)\s*:\s*(.*?)\s*$/iu.exec(declaration);
    if (match?.[1] === undefined || match[2] === undefined || match[2].length === 0) {
      continue;
    }
    const percent = readHtmlImageWidth(match[2]);
    if (percent === null) {
      return false;
    }
    declarations.push({
      property: match[1].toLowerCase() as "width" | "max-width",
      percent
    });
  }
  return declarations.length > 1 ? false : declarations[0] ?? null;
}

function readHtmlImageWidth(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(?:%|vw)$/iu.exec(value.trim());
  return match?.[1] === undefined ? null : Number(match[1]);
}

function parseHtmlListStart(value: string | undefined): number {
  const parsed = value === undefined ? NaN : Number(value.trim());
  return Number.isInteger(parsed) ? parsed : DEFAULT_ORDERED_LIST_START;
}

function readContentAlignment(attributes: ReadonlyMap<string, string>): ContentAlignment | null {
  const align = attributes.get("align")?.trim().toLowerCase();
  if (align === "left" || align === "center" || align === "right") {
    return align;
  }
  const style = attributes.get("style") ?? "";
  const match = /(?:^|;)\s*text-align\s*:\s*(left|center|right)\s*(?:;|$)/iu.exec(style);
  return match?.[1] === undefined
    ? null
    : match[1].toLowerCase() as ContentAlignment;
}

function inlineSyntaxToRawText(nodes: readonly ScannedInlineNode[]): string {
  return nodes.map((node) => {
    if (node.type === "text") {
      return node.value;
    }
    if (node.type === "inline-code") {
      return node.value;
    }
    if (node.type === "html") {
      return node.value;
    }
    if (node.type === "html-container") {
      return htmlTreeTextContent(localizeHtmlTree(node.tree));
    }
    if (node.type === "image") {
      return node.alt;
    }
    if (node.type === "break") {
      return "\n";
    }
    if (node.type === "link" || node.type === "emphasis" || node.type === "strong" || node.type === "delete") {
      return inlineSyntaxToRawText(node.children);
    }
    return "";
  }).join("");
}

function parseLinkTarget(url: string) {
  if (url.startsWith(ROUTE_PREFIX)) {
    return { type: "route" as const, name: url.slice(ROUTE_PREFIX.length).trim() };
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
  return url.startsWith(ASSET_PREFIX)
    ? { type: "asset", name: url.slice(ASSET_PREFIX.length).trim() }
    : url;
}

function validateImagePercent(property: "width" | "max-width", percent: number): void {
  if (
    !Number.isFinite(percent)
    || percent < MIN_IMAGE_WIDTH_PERCENT
    || percent > MAX_IMAGE_WIDTH_PERCENT
  ) {
    throw new Error(
      `Image ${property} must be between ${MIN_IMAGE_WIDTH_PERCENT}% and ${MAX_IMAGE_WIDTH_PERCENT}%`
    );
  }
}

function toHeadingDepth(depth: number): HeadingDepth {
  return Math.min(MAX_HEADING_DEPTH, Math.max(MIN_HEADING_DEPTH, depth)) as HeadingDepth;
}

function findDocumentTitle(ast: RootNode): string | null {
  const heading = ast.children.find(
    (child): child is HeadingNode => child.type === "heading" && child.depth === 1
  );
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
  const first = ast.children[0];
  return first?.type === "heading" && first.depth === 1
    ? { type: "root", children: ast.children.slice(1) }
    : ast;
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
  return nodes.map((node) => {
    switch (node.type) {
      case "text":
      case "inline-code":
        return node.value;
      case "ruby":
        return node.base;
      case "break":
        return " ";
      case "image":
        return node.alt;
      default:
        return inlineText(node.children);
    }
  }).join("");
}

function readFrontmatter(source: string | null): FrontmatterValues {
  if (source === null) {
    return {};
  }
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    const firstError = document.errors[0];
    throw new Error(`Invalid YAML frontmatter: ${firstError?.message ?? "unknown error"}`);
  }
  const parsed: unknown = document.toJS();
  if (!isRecord(parsed)) {
    return {};
  }
  return {
    title: readString(parsed.title),
    description: readString(parsed.description),
    type: readPageType(parsed.type),
    indexed: readNumber(parsed.indexed),
    source: readString(parsed.source),
    date: readString(parsed.date),
    tags: readStringArray(parsed.tags),
    draft: readBoolean(parsed.draft)
  };
}

function slugFromPath(sourcePath: string): string {
  return basename(sourcePath, extname(sourcePath));
}

function inferDirectoryIndexSource(sourcePath: string): string | null {
  if (sourcePath === "index.md" || !sourcePath.endsWith("/index.md")) {
    return null;
  }
  return sourcePath.slice(0, -"/index.md".length);
}

function titleizeSlug(slug: string): string {
  return slug.replace(/[-_]+/gu, " ").replace(/\b\w/gu, (character) => character.toUpperCase());
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
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string")
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
