import { h, type VNode } from "vue";
import type { CodeGenerator } from "./types.ts";
import type { IrElementNode, IrNode } from "../ir/types.ts";

export type VueCodegenInput = readonly IrNode[];
export type VueCodegenOutput = VNode[];

export const vueCodeGenerator: CodeGenerator<VueCodegenInput, VueCodegenOutput> = {
  generate: generateVueNodes
};

/** Generate Vue VNodes from the JSON-like IR. */
export function generateVueNodes(nodes: VueCodegenInput): VNode[] {
  return nodes.map((node) => {
    const generated = generateVueNode(node);
    if (typeof generated === "string") {
      throw new Error("Root IR nodes must be elements when generating Vue content");
    }
    return generated;
  });
}

function generateVueNode(node: IrNode): VNode | string {
  if (node.kind === "text") {
    return node.value;
  }

  return generateVueElement(node);
}

function generateVueElement(node: IrElementNode): VNode {
  const props = node.props === undefined ? null : { ...node.props };
  const children = node.children.map(generateVueNode);
  return h(node.tag, props, children);
}
