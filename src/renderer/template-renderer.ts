import { renderToString } from "@vue/server-renderer";
import { h } from "vue";
import type {
  CollectionResult,
  RenderPageInput,
  SiteConfig,
  TemplateName
} from "../ast/types.ts";
import type { RouteResolver } from "../resolver/route-resolver.ts";
import {
  ListObjectListTemplate,
  ListObjectTemplate,
  ListTemplate,
  PageTemplate,
  type TemplateComponent,
  type TemplateProps
} from "./vue/templates.ts";

const templates: Record<TemplateName, TemplateComponent> = {
  page: PageTemplate,
  list: ListTemplate,
  "list-object": ListObjectTemplate,
  "list-object-list": ListObjectListTemplate
};

export async function renderPageTemplate(
  config: SiteConfig,
  input: RenderPageInput,
  resolver: RouteResolver,
  collections: ReadonlyMap<string, CollectionResult>,
  assetHref: string,
  assetHrefForName: (name: string) => string,
  githubAvatarHref: string | null
): Promise<string> {
  const template = templates[input.route.template];
  const props: TemplateProps = {
    config,
    input,
    resolver,
    collections,
    assetHref,
    assetHrefForName,
    githubAvatarHref
  };
  const renderedDocument = await renderToString(h(template, props));
  return `<!doctype html>\n${renderedDocument}\n`;
}
