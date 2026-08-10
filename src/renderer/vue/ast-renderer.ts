import { h, type VNode, type VNodeChild } from "vue";
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
} from "../../../constants/runtime.ts";
import type {
  BlockNode,
  CollectionResult,
  InlineNode,
  LinkTarget,
  NavigationLink,
  RootNode,
  TableAlignment
} from "../../ast/types.ts";
import { normalizeAssetName } from "../../resolver/asset-resolver.ts";
import type { RouteResolver } from "../../resolver/route-resolver.ts";

export interface VueAstRenderContext {
  resolver: RouteResolver;
  collections: ReadonlyMap<string, CollectionResult>;
  assetHref: (name: string) => string;
}

export function renderAst(ast: RootNode, context: VueAstRenderContext): VNode[] {
  return ast.children.map((node) => renderBlock(node, context));
}

export function renderNavigationLinks(links: NavigationLink[]): VNode[] {
  return links.map((link) => h(
    "a",
    {
      class: link.current ? "nav-link is-current" : "nav-link",
      href: link.path,
      "aria-current": link.current ? "page" : undefined
    },
    link.label
  ));
}

export function renderBreadcrumbs(links: NavigationLink[]): VNode[] {
  const children: VNode[] = [];

  links.forEach((link, index) => {
    if (index > FIRST_INDEX) {
      children.push(h("span", { class: "breadcrumb-separator", "aria-hidden": "true" }, "/"));
    }

    if (link.current) {
      children.push(h("span", { "aria-current": "page" }, link.label));
      return;
    }

    children.push(h("a", { href: link.path }, link.label));
  });

  return children;
}

export function renderAdjacentLink(
  link: NavigationLink | null,
  direction: "previous" | "next"
): VNode | null {
  if (link === null) {
    return null;
  }

  const label = direction === "previous" ? "Previous" : "Next";
  return h(
    "a",
    {
      class: `adjacent-link adjacent-link--${direction}`,
      href: link.path
    },
    [
      h("span", null, label),
      h("strong", null, link.label)
    ]
  );
}

export function renderTags(tags: string[]): VNode | null {
  if (tags.length === 0) {
    return null;
  }

  return h(
    "span",
    { class: "tag-list" },
    tags.map((tag) => h("span", { class: "tag" }, tag))
  );
}

function renderBlock(node: BlockNode, context: VueAstRenderContext): VNode {
  switch (node.type) {
    case "paragraph": {
      const paragraphClass = imageParagraphClass(node.children);
      return h(
        "p",
        paragraphClass === null ? null : { class: paragraphClass },
        renderInlineChildren(node.children, context)
      );
    }
    case "heading":
      return h(`h${node.depth}`, null, renderInlineChildren(node.children, context));
    case "list": {
      const tag = node.style === "ordered" ? "ol" : "ul";
      const props = node.style === "ordered" && node.start !== null && node.start !== DEFAULT_ORDERED_LIST_START
        ? { start: node.start }
        : null;
      return h(
        tag,
        props,
        node.items.map((item) => renderListItem(item, context))
      );
    }
    case "blockquote":
      return h(
        "blockquote",
        null,
        node.children.flatMap((child) => [renderBlock(child, context)])
      );
    case "code-block": {
      const props = node.language === null
        ? null
        : { class: `language-${node.language}` };
      return h("pre", null, [h("code", props, node.value)]);
    }
    case "thematic-break":
      return h("hr");
    case "table":
      return renderTable(node, context);
    case "content-alignment":
      return h(
        "div",
        { class: `content-alignment content-alignment--${node.alignment}` },
        node.children.map((child) => renderBlock(child, context))
      );
    case "collection":
      return renderCollectionNode(node.name, context);
    case "text-block":
      return h("div", { class: "text-block" }, node.value);
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

function renderListItem(
  item: Extract<BlockNode, { type: "list" }>["items"][number],
  context: VueAstRenderContext
): VNode {
  const renderedChildren = item.children.map((child) => renderBlock(child, context));
  if (item.checked !== null) {
    return h("li", { class: "task-item" }, [
      h("input", {
      class: "task-checkbox",
      type: "checkbox",
      disabled: true,
      checked: item.checked
      }),
      h("div", { class: "task-item__content" }, renderedChildren)
    ]);
  }
  return h("li", null, renderedChildren);
}

function renderCollectionNode(
  name: string,
  context: VueAstRenderContext
): VNode {
  const collection = context.collections.get(name);
  if (collection === undefined) {
    throw new Error(`Unknown collection source: ${name}`);
  }

  if (collection.items.length === 0) {
    return h("p", { class: "empty-state" }, `No items have been published in ${name} yet.`);
  }

  const titleColumnWidth = calculateTitleColumnWidth(collection.items.map((item) => item.document.metadata.title));
  const collectionStyle = [
    `--collection-title-width: ${titleColumnWidth}px`,
    `--collection-title-max-width: ${COLLECTION_TITLE_MAX_COLUMN_RATIO * 100}%`
  ].join("; ");

  const items = collection.items.map((item) => {
    const metadata = item.document.metadata;
    const tags = metadata.tags.length === FIRST_INDEX
      ? null
      : h(
        "span",
        { class: "collection-tags tag-list" },
        metadata.tags.map((tag) => h("span", { class: "tag" }, tag))
      );

    return h("li", null, [
      h("a", { href: context.resolver.href(item.routeName) }, [
        h("span", { class: "collection-title" }, metadata.title),
        h("span", { class: "collection-description" }, metadata.description),
        metadata.date === undefined
          ? null
          : h("time", { class: "collection-date", datetime: metadata.date }, metadata.date),
        tags
      ])
    ]);
  });

  return h("div", { class: "collection-panel", style: collectionStyle }, [
    h("ul", { class: "collection-list" }, items)
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

function renderTable(
  table: Extract<BlockNode, { type: "table" }>,
  context: VueAstRenderContext
): VNode {
  const [header, ...body] = table.rows;
  if (header === undefined) {
    return h("div");
  }

  const headerCells = header.cells.map((cell, index) => renderTableCell(
    "th",
    cell,
    table.alignments[index],
    context
  ));
  const bodyRows = body.map((row) => h(
    "tr",
    null,
    row.cells.map((cell, index) => renderTableCell(
      "td",
      cell,
      table.alignments[index],
      context
    ))
  ));

  return h("div", { class: "table-scroll" }, [
    h("table", null, [
      h("thead", null, [h("tr", null, headerCells)]),
      h("tbody", null, bodyRows)
    ])
  ]);
}

function renderTableCell(
  tag: "th" | "td",
  cell: Extract<BlockNode, { type: "table" }>["rows"][number]["cells"][number],
  alignment: TableAlignment | undefined,
  context: VueAstRenderContext
): VNode {
  return h(
    tag,
    alignment === undefined || alignment === null ? null : { align: alignment },
    renderInlineChildren(cell.children, context)
  );
}

function renderInlineChildren(
  nodes: InlineNode[],
  context: VueAstRenderContext
): VNodeChild[] {
  return nodes.map((node) => renderInline(node, context));
}

function renderInline(node: InlineNode, context: VueAstRenderContext): VNodeChild {
  switch (node.type) {
    case "text":
      return node.value;
    case "emphasis":
      return h("em", null, renderInlineChildren(node.children, context));
    case "strong":
      return h("strong", null, renderInlineChildren(node.children, context));
    case "delete":
      return h("del", null, renderInlineChildren(node.children, context));
    case "inline-code":
      return h("code", null, node.value);
    case "link":
      return renderLink(node.target, node.title, node.children, context);
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
      return h("img", props);
    }
    case "ruby":
      return h("ruby", null, [
        node.base,
        h("rt", null, node.annotation)
      ]);
    case "break":
      return h("br");
  }
}

function renderLink(
  target: LinkTarget,
  title: string | null,
  children: InlineNode[],
  context: VueAstRenderContext
): VNode {
  const href = target.type === "route"
    ? context.resolver.href(target.name)
    : target.type === "asset"
      ? context.assetHref(normalizeAssetName(target.name))
    : target.type === "relative"
      ? context.resolver.hrefForRelative(target.href)
      : target.href;
  const props: Record<string, string> = {
    href: sanitizeHref(href)
  };
  if (title !== null) {
    props.title = title;
  }
  return h("a", props, renderInlineChildren(children, context));
}

function resolveImageSource(
  source: string | { type: "asset"; name: string },
  context: VueAstRenderContext
): string {
  return typeof source === "string"
    ? source
    : context.assetHref(normalizeAssetName(source.name));
}

export function sanitizeHref(href: string): string {
  if (/^(?:javascript|data|vbscript):/iu.test(href.trim())) {
    throw new Error(`Unsafe URL rejected by renderer: ${href}`);
  }
  return href;
}
