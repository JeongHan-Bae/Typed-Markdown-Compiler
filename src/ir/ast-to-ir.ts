import {
  COLLECTION_REFERENCE_WIDTH_PX,
  COLLECTION_TITLE_CHAR_WIDTH_RATIO,
  COLLECTION_TITLE_FONT_SIZE_PX,
  COLLECTION_TITLE_MAX_COLUMN_RATIO,
  COLLECTION_TITLE_SPACE_WIDTH_RATIO,
  COLLECTION_TITLE_WIDE_CHAR_WIDTH_RATIO,
  COLLECTION_TITLE_WIDTH_PADDING_PX,
  DEFAULT_ORDERED_LIST_START,
  FIRST_INDEX
} from "../../constants/runtime.ts";
import type {
  BlockNode,
  InlineNode,
  LinkTarget,
  RootNode,
  TableAlignment
} from "../ast/types.ts";
import { normalizeAssetName } from "../resolver/asset-resolver.ts";
import type { AstToIrContext, IrElementNode, IrNode, IrProps } from "./types.ts";

export function lowerAstToIr(ast: RootNode, context: AstToIrContext): IrNode[] {
  return ast.children.map((node) => lowerBlock(node, context));
}

function lowerBlock(node: BlockNode, context: AstToIrContext): IrElementNode {
  switch (node.type) {
    case "paragraph": {
      const paragraphClass = imageParagraphClass(node.children);
      return element(
        "p",
        paragraphClass === null ? undefined : { class: paragraphClass },
        lowerInlineChildren(node.children, context)
      );
    }
    case "heading":
      return element(`h${node.depth}`, undefined, lowerInlineChildren(node.children, context));
    case "list": {
      const tag = node.style === "ordered" ? "ol" : "ul";
      const props = node.style === "ordered"
        && node.start !== null
        && node.start !== DEFAULT_ORDERED_LIST_START
        ? { start: node.start }
        : undefined;
      return element(
        tag,
        props,
        node.items.map((item) => lowerListItem(item, context))
      );
    }
    case "blockquote":
      return element(
        "blockquote",
        undefined,
        node.children.map((child) => lowerBlock(child, context))
      );
    case "code-block":
      return element(
        "pre",
        undefined,
        [element(
          "code",
          node.language === null ? undefined : { class: `language-${node.language}` },
          [text(node.value)]
        )]
      );
    case "thematic-break":
      return element("hr", undefined, []);
    case "table":
      return lowerTable(node, context);
    case "content-alignment":
      return element(
        "div",
        { class: `content-alignment content-alignment--${node.alignment}` },
        node.children.map((child) => lowerBlock(child, context))
      );
    case "collection":
      return lowerCollectionNode(node.name, context);
    case "text-block":
      return element("div", { class: "text-block" }, [text(node.value)]);
  }
}

function imageParagraphClass(children: InlineNode[]): string | null {
  if (!children.some((child) => child.type === "image")) {
    return null;
  }

  const containsText = children.some((child) => {
    if (child.type === "image" || child.type === "break") {
      return false;
    }
    return child.type !== "text" || child.value.trim().length > 0;
  });
  return containsText ? "image-paragraph image-paragraph--mixed" : "image-paragraph";
}

function lowerListItem(
  item: Extract<BlockNode, { type: "list" }>["items"][number],
  context: AstToIrContext
): IrElementNode {
  const renderedChildren = item.children.map((child) => lowerBlock(child, context));
  if (item.checked !== null) {
    return element("li", { class: "task-item" }, [
      element("input", {
        class: "task-checkbox",
        type: "checkbox",
        disabled: true,
        checked: item.checked
      }, []),
      element("div", { class: "task-item__content" }, renderedChildren)
    ]);
  }
  return element("li", undefined, renderedChildren);
}

function lowerCollectionNode(name: string, context: AstToIrContext): IrElementNode {
  const collection = context.collections.get(name);
  if (collection === undefined) {
    throw new Error(`Unknown collection source: ${name}`);
  }

  if (collection.items.length === 0) {
    return element("p", { class: "empty-state" }, [
      text(`No items have been published in ${name} yet.`)
    ]);
  }

  const titleColumnWidth = calculateTitleColumnWidth(
    collection.items.map((item) => item.document.metadata.title)
  );
  const collectionStyle = [
    `--collection-title-width: ${titleColumnWidth}px`,
    `--collection-title-max-width: ${COLLECTION_TITLE_MAX_COLUMN_RATIO * 100}%`
  ].join("; ");

  const items = collection.items.map((item) => {
    const metadata = item.document.metadata;
    const tags = metadata.tags.length === FIRST_INDEX
      ? null
      : element(
        "span",
        { class: "collection-tags tag-list" },
        metadata.tags.map((tag) => element("span", { class: "tag" }, [text(tag)]))
      );
    const itemChildren: IrNode[] = [
      element("span", { class: "collection-title" }, [text(metadata.title)]),
      element("span", { class: "collection-description" }, [text(metadata.description)])
    ];
    if (metadata.date !== undefined) {
      itemChildren.push(element("time", { class: "collection-date", datetime: metadata.date }, [text(metadata.date)]));
    }
    if (tags !== null) {
      itemChildren.push(tags);
    }
    return element("li", undefined, [
      element("a", { href: context.routeHref(item.routeName) }, itemChildren)
    ]);
  });

  return element("div", { class: "collection-panel", style: collectionStyle }, [
    element("ul", { class: "collection-list" }, items)
  ]);
}

function calculateTitleColumnWidth(titles: string[]): number {
  const widestTitle = titles.reduce(
    (widest, title) => Math.max(widest, estimateTitleWidth(title)),
    FIRST_INDEX
  );
  const maximumColumnWidth = COLLECTION_REFERENCE_WIDTH_PX * COLLECTION_TITLE_MAX_COLUMN_RATIO;
  return Math.ceil(Math.min(maximumColumnWidth, widestTitle + COLLECTION_TITLE_WIDTH_PADDING_PX));
}

function estimateTitleWidth(title: string): number {
  return Array.from(title).reduce((width, character) => {
    const ratio = character === " "
      ? COLLECTION_TITLE_SPACE_WIDTH_RATIO
      : /[^\x00-\x7F]/u.test(character)
        ? COLLECTION_TITLE_WIDE_CHAR_WIDTH_RATIO
        : COLLECTION_TITLE_CHAR_WIDTH_RATIO;
    return width + COLLECTION_TITLE_FONT_SIZE_PX * ratio;
  }, FIRST_INDEX);
}

function lowerTable(
  table: Extract<BlockNode, { type: "table" }>,
  context: AstToIrContext
): IrElementNode {
  const [header, ...body] = table.rows;
  if (header === undefined) {
    return element("div", undefined, []);
  }

  const headerCells = header.cells.map((cell, index) => lowerTableCell(
    "th",
    cell,
    table.alignments[index],
    context
  ));
  const bodyRows = body.map((row) => element(
    "tr",
    undefined,
    row.cells.map((cell, index) => lowerTableCell(
      "td",
      cell,
      table.alignments[index],
      context
    ))
  ));

  return element("div", { class: "table-scroll" }, [
    element("table", undefined, [
      element("thead", undefined, [element("tr", undefined, headerCells)]),
      element("tbody", undefined, bodyRows)
    ])
  ]);
}

function lowerTableCell(
  tag: "th" | "td",
  cell: Extract<BlockNode, { type: "table" }>["rows"][number]["cells"][number],
  alignment: TableAlignment | undefined,
  context: AstToIrContext
): IrElementNode {
  return element(
    tag,
    alignment === undefined || alignment === null ? undefined : { align: alignment },
    lowerInlineChildren(cell.children, context)
  );
}

function lowerInlineChildren(nodes: InlineNode[], context: AstToIrContext): IrNode[] {
  return nodes.map((node) => lowerInline(node, context));
}

function lowerInline(node: InlineNode, context: AstToIrContext): IrNode {
  switch (node.type) {
    case "text":
      return text(node.value);
    case "emphasis":
      return element("em", undefined, lowerInlineChildren(node.children, context));
    case "strong":
      return element("strong", undefined, lowerInlineChildren(node.children, context));
    case "delete":
      return element("del", undefined, lowerInlineChildren(node.children, context));
    case "inline-code":
      return element("code", undefined, [text(node.value)]);
    case "link":
      return lowerLink(node.target, node.title, node.children, context);
    case "image": {
      const props: Record<string, string> = {
        src: sanitizeHref(resolveImageSource(node.src, context)),
        alt: node.alt
      };
      if (node.title !== null) {
        props.title = node.title;
      }
      if (node.forcedWidthPercent !== undefined) {
        props.style = `width: ${node.forcedWidthPercent}%; max-width: 100%`;
      } else if (node.maxWidthPercent !== undefined) {
        props.style = `max-width: ${node.maxWidthPercent}%`;
      }
      return element("img", props, []);
    }
    case "ruby":
      return element("ruby", undefined, [
        text(node.base),
        element("rt", undefined, [text(node.annotation)])
      ]);
    case "break":
      return element("br", undefined, []);
  }
}

function lowerLink(
  target: LinkTarget,
  title: string | null,
  children: InlineNode[],
  context: AstToIrContext
): IrElementNode {
  const href = target.type === "route"
    ? context.routeHref(target.name)
    : target.type === "asset"
      ? context.assetHref(normalizeAssetName(target.name))
      : target.type === "relative"
        ? context.relativeHref(target.href)
        : target.href;
  const props: Record<string, string> = { href: sanitizeHref(href) };
  if (title !== null) {
    props.title = title;
  }
  return element("a", props, lowerInlineChildren(children, context));
}

function resolveImageSource(
  source: string | { type: "asset"; name: string },
  context: AstToIrContext
): string {
  return typeof source === "string"
    ? source
    : context.assetHref(normalizeAssetName(source.name));
}

function sanitizeHref(href: string): string {
  if (/^(?:javascript|data|vbscript):/iu.test(href.trim())) {
    throw new Error(`Unsafe URL rejected by renderer: ${href}`);
  }
  return href;
}

function element(
  tag: string,
  props: IrProps | undefined,
  children: IrNode[]
): IrElementNode {
  return props === undefined
    ? { kind: "element", tag, children }
    : { kind: "element", tag, props, children };
}

function text(value: string): IrNode {
  return { kind: "text", value };
}
