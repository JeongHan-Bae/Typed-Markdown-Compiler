import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type {
  PhrasingContent,
  RootContent
} from "mdast";
import { IMAGE_WIDTH_ATTRIBUTE_PATTERN } from "../../constants/runtime.ts";
import type {
  FrontmatterSyntaxNode,
  ScannedBlockNode,
  ScannedInlineNode,
  ScannedHtmlTreeNode,
  ScannedSyntaxNode,
  ScannedTableCellNode,
  ScannedTableRowNode
} from "../tokens/types.ts";
import { isHtmlComment, parseHtmlFragment, type HtmlNode } from "./html-tree.ts";

const markdownSyntaxProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"]);

export interface RemarkSyntaxItem {
  node: ScannedSyntaxNode;
  startOffset: number;
  endOffset: number;
  lexeme: string;
}

/**
 * Delegate Markdown and HTML recognition to Unified/Remark, then convert the
 * external syntax tree into the project's own source-syntax contract.
 */
export function scanRemarkSyntax(source: string): RemarkSyntaxItem[] {
  const root = markdownSyntaxProcessor.parse(source);
  return root.children.flatMap((node) => {
    const converted = convertTopLevelNode(node, source);
    if (converted === null) {
      return [];
    }
    const position = nodePosition(node);
    return [{
      node: converted,
      startOffset: position.start,
      endOffset: position.end,
      lexeme: source.slice(position.start, position.end)
    }];
  });
}

function convertTopLevelNode(node: RootContent, source: string): ScannedSyntaxNode | null {
  if (node.type === "yaml") {
    const frontmatter: FrontmatterSyntaxNode = {
      type: "frontmatter",
      value: node.value
    };
    return frontmatter;
  }
  return convertBlockNode(node, source);
}

function convertBlockNode(node: RootContent, source: string): ScannedBlockNode | null {
  switch (node.type) {
    case "paragraph":
      return {
        type: "paragraph",
        children: convertParagraphInlineNodes(node, source)
      };
    case "heading":
      return {
        type: "heading",
        depth: node.depth,
        children: convertInlineNodes(node.children, source)
      };
    case "list":
      return {
        type: "list",
        style: node.ordered ? "ordered" : "unordered",
        start: node.ordered ? node.start ?? 1 : null,
        items: node.children.map((item) => ({
          type: "list-item",
          children: item.children.flatMap((child) => {
            const converted = convertBlockNode(child, source);
            return converted === null ? [] : [converted];
          }),
          checked: item.checked ?? null
        }))
      };
    case "blockquote":
      return {
        type: "blockquote",
        children: node.children.flatMap((child) => {
          const converted = convertBlockNode(child, source);
          return converted === null ? [] : [converted];
        })
      };
    case "code":
      return {
        type: "code-block",
        language: node.lang ?? null,
        value: node.value
      };
    case "thematicBreak":
      return { type: "thematic-break" };
    case "table":
      return {
        type: "table",
        alignments: node.align ?? [],
        rows: node.children.map((row) => convertTableRow(row, source))
      };
    case "html":
      if (isHtmlComment(node.value)) {
        return null;
      }
      return {
        type: "html-block",
        value: node.value,
        tree: convertHtmlTree(parseHtmlFragment(node.value))
      };
    case "text":
      return {
        type: "paragraph",
        children: [{ type: "text", value: node.value }]
      };
    case "image":
      return {
        type: "paragraph",
        children: [convertImageNode(node)]
      };
    case "break":
      return {
        type: "paragraph",
        children: [{ type: "break" }]
      };
    default:
      return {
        type: "unsupported-block",
        value: rawNodeSource(node, source)
      };
  }
}

function convertParagraphInlineNodes(
  node: Extract<RootContent, { type: "paragraph" }>,
  source: string
): ScannedInlineNode[] {
  const raw = rawNodeSource(node, source);
  const tree = parseHtmlFragment(raw);
  if (tree !== null && tree.some((child) => child.type === "element")) {
    return [{
      type: "html-container",
      value: raw,
      tree: convertHtmlTree(tree) ?? []
    }];
  }
  return convertInlineNodes(node.children, source);
}

function convertHtmlTree(nodes: readonly HtmlNode[] | null): ScannedHtmlTreeNode[] | null {
  if (nodes === null) {
    return null;
  }
  return nodes.map((node): ScannedHtmlTreeNode => node.type === "text"
    ? { type: "html-text", value: node.value }
    : {
      type: "html-element",
      name: node.name,
      attributes: Object.fromEntries(node.attributes.entries()),
      children: convertHtmlTree(node.children) ?? []
    });
}

function convertTableRow(
  row: Extract<RootContent, { type: "tableRow" }>,
  source: string
): ScannedTableRowNode {
  return {
    type: "table-row",
    cells: row.children.map((cell): ScannedTableCellNode => ({
      type: "table-cell",
      children: convertInlineNodes(cell.children, source)
    }))
  };
}

function convertInlineNodes(
  nodes: readonly PhrasingContent[],
  source: string
): ScannedInlineNode[] {
  const result: ScannedInlineNode[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node === undefined) {
      continue;
    }
    const converted = convertInlineNode(node, source);
    if (converted === null) {
      continue;
    }

    if (converted.type === "image") {
      const sizing = nodes[index + 1];
      if (sizing?.type === "text") {
        const match = IMAGE_WIDTH_ATTRIBUTE_PATTERN.exec(sizing.value);
        const property = match?.groups?.property;
        const rawPercent = match?.groups?.value;
        if (
          (property === "width" || property === "max-width")
          && rawPercent !== undefined
        ) {
          if (property === "width") {
            converted.forcedWidthPercent = Number(rawPercent);
          } else {
            converted.maxWidthPercent = Number(rawPercent);
          }
          index += 1;
        }
      }
    }
    result.push(converted);
  }
  return result;
}

function convertInlineNode(
  node: PhrasingContent,
  source: string
): ScannedInlineNode | null {
  switch (node.type) {
    case "text":
      return { type: "text", value: node.value };
    case "emphasis":
      return { type: "emphasis", children: convertInlineNodes(node.children, source) };
    case "strong":
      return { type: "strong", children: convertInlineNodes(node.children, source) };
    case "delete":
      return { type: "delete", children: convertInlineNodes(node.children, source) };
    case "inlineCode":
      return { type: "inline-code", value: node.value };
    case "link":
      return {
        type: "link",
        url: node.url,
        title: node.title ?? null,
        children: convertInlineNodes(node.children, source)
      };
    case "image":
      return convertImageNode(node);
    case "html":
      if (isHtmlComment(node.value)) {
        return null;
      }
      return { type: "html", value: node.value };
    case "break":
      return { type: "break" };
    default:
      return { type: "text", value: rawNodeSource(node, source) };
  }
}

function convertImageNode(
  node: Extract<PhrasingContent, { type: "image" }>
): Extract<ScannedInlineNode, { type: "image" }> {
  return {
    type: "image",
    url: node.url,
    alt: node.alt ?? "",
    title: node.title ?? null
  };
}

function nodePosition(node: { position?: { start: { offset?: number }; end: { offset?: number } } }): {
  start: number;
  end: number;
} {
  return {
    start: node.position?.start.offset ?? 0,
    end: node.position?.end.offset ?? 0
  };
}

function rawNodeSource(node: { position?: { start: { offset?: number }; end: { offset?: number } }; type: string }, source: string): string {
  const position = nodePosition(node);
  return source.slice(position.start, position.end) || node.type;
}
