/**
 * JSON-like intermediate representation between the normalized Markdown AST
 * and a target code generator.
 *
 * IR deliberately contains no Vue types and no Markdown source tokens. It is
 * a small, serializable description of elements, attributes, text, and
 * children, so another generator could target a different output backend.
 */

import type { CollectionResult } from "../ast/types.ts";

export type IrPropValue = string | number | boolean;

export type IrProps = Readonly<Record<string, IrPropValue>>;

export interface IrTextNode {
  kind: "text";
  value: string;
}

export interface IrElementNode {
  kind: "element";
  tag: string;
  props?: IrProps;
  children: IrNode[];
}

export type IrNode = IrTextNode | IrElementNode;

export interface AstToIrContext {
  routeHref: (name: string) => string;
  relativeHref: (path: string) => string;
  assetHref: (name: string) => string;
  collections: ReadonlyMap<string, CollectionResult>;
}
