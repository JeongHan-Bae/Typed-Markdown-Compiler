import {
  parseFragment,
  type DefaultTreeAdapterTypes
} from "parse5";

/**
 * HTML is parsed only after Unified/Remark has identified a raw HTML node.
 * Markdown source never enters this parser. The resulting tree is local and
 * is converted into the project's token tree by `remark-syntax.ts`.
 */

export interface HtmlTagAttributes {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attributes: ReadonlyMap<string, string>;
}

export interface HtmlTextNode {
  type: "text";
  value: string;
}

export interface HtmlElementNode {
  type: "element";
  name: string;
  attributes: ReadonlyMap<string, string>;
  children: HtmlNode[];
}

export type HtmlNode = HtmlTextNode | HtmlElementNode;

type HtmlChildNode = DefaultTreeAdapterTypes.ChildNode;
type HtmlElement = DefaultTreeAdapterTypes.Element;

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

/** Parse a recognized raw HTML fragment with the DOM-style parse5 tree. */
export function parseHtmlFragment(source: string): HtmlNode[] | null {
  const fragment = parseFragment(source, { sourceCodeLocationInfo: true });
  const result: HtmlNode[] = [];
  for (const child of fragment.childNodes) {
    if (isCommentNode(child)) {
      continue;
    }
    const converted = convertHtmlChild(child);
    if (converted === null) {
      return null;
    }
    result.push(converted);
  }
  return result;
}

function convertHtmlChild(node: HtmlChildNode): HtmlNode | null {
  if (node.nodeName === "#text" && "value" in node) {
    return { type: "text", value: node.value };
  }
  if (node.nodeName === "#comment" || node.nodeName === "#documentType") {
    return null;
  }
  if (!isHtmlElement(node)) {
    return null;
  }

  const location = node.sourceCodeLocation;
  if (!VOID_ELEMENTS.has(node.tagName) && location?.endTag === undefined) {
    return null;
  }

  const children: HtmlNode[] = [];
  for (const child of node.childNodes) {
    if (isCommentNode(child)) {
      continue;
    }
    const converted = convertHtmlChild(child);
    if (converted === null) {
      return null;
    }
    children.push(converted);
  }
  return {
    type: "element",
    name: node.tagName.toLowerCase(),
    attributes: new Map(node.attrs.map((attribute) => [
      attribute.name.toLowerCase(),
      attribute.value
    ])),
    children
  };
}

/** Return whether a Remark HTML lexeme contains only HTML comments and whitespace. */
export function isHtmlComment(value: string): boolean {
  const fragment = parseFragment(value.trim());
  return fragment.childNodes.length > 0
    && fragment.childNodes.every((child) => (
      isCommentNode(child)
      || (child.nodeName === "#text" && "value" in child && child.value.trim().length === 0)
    ));
}

function isCommentNode(node: HtmlChildNode): node is DefaultTreeAdapterTypes.CommentNode {
  return node.nodeName === "#comment";
}

function isHtmlElement(node: HtmlChildNode): node is HtmlElement {
  return node.nodeName !== "#text"
    && node.nodeName !== "#comment"
    && node.nodeName !== "#documentType"
    && "tagName" in node
    && "attrs" in node
    && "childNodes" in node;
}

/** Parse one complete tag for Remark's block-boundary adapter. */
export function parseHtmlTagAttributes(value: string): HtmlTagAttributes | null {
  const source = value.trim();
  const closingMatch = /^<\s*\/\s*([A-Za-z][A-Za-z0-9:_-]*)\s*>$/u.exec(source);
  if (closingMatch?.[1] !== undefined) {
    const fragment = parseFragment(source);
    return fragment.childNodes.length === 0
      ? {
        name: closingMatch[1].toLowerCase(),
        closing: true,
        selfClosing: false,
        attributes: new Map()
      }
      : null;
  }

  const fragment = parseFragment(source, { sourceCodeLocationInfo: true });
  if (fragment.childNodes.length !== 1) {
    return null;
  }
  const child = fragment.childNodes[0];
  if (child === undefined || !isHtmlElement(child)) {
    return null;
  }
  const location = child.sourceCodeLocation;
  if (
    location?.startTag === undefined
    || location.startTag.startOffset !== 0
    || location.startTag.endOffset !== source.length
    || location.endTag !== undefined
  ) {
    return null;
  }
  return {
    name: child.tagName.toLowerCase(),
    closing: false,
    selfClosing: /\/\s*>$/u.test(source),
    attributes: new Map(child.attrs.map((attribute) => [
      attribute.name.toLowerCase(),
      attribute.value
    ]))
  };
}
