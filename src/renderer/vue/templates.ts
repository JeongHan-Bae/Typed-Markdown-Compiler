import { h, type FunctionalComponent, type VNode } from "vue";
import {
  CONTENT_IMAGE_MAX_WIDTH_PERCENT,
  FIRST_INDEX
} from "../../../constants/runtime.ts";
import type {
  CollectionResult,
  RenderPageInput,
  SiteConfig
} from "../../ast/types.ts";
import type { RouteResolver } from "../../resolver/route-resolver.ts";
import { lowerAstToIr } from "../../ir/ast-to-ir.ts";
import { vueCodeGenerator } from "../../codegen/vue-code-generator.ts";
import {
  renderGithubAvatar,
  renderGithubFollowLink
} from "../../plugins/github-follow-link.ts";
import {
  renderAdjacentLink,
  renderBreadcrumbs,
  renderNavigationLinks,
  renderTags
} from "./page-chrome.ts";

export interface TemplateProps {
  config: SiteConfig;
  input: RenderPageInput;
  resolver: RouteResolver;
  collections: ReadonlyMap<string, CollectionResult>;
  assetHref: string;
  assetHrefForName: (name: string) => string;
  githubAvatarHref: string | null;
}

export type TemplateComponent = FunctionalComponent<TemplateProps>;

export const PageTemplate = createTemplate(
  "PageTemplate",
  "article",
  "content-page",
  true,
  false
);

export const ListTemplate = createTemplate(
  "ListTemplate",
  "section",
  "content-page content-page--list",
  false,
  false
);

export const ListObjectTemplate = createTemplate(
  "ListObjectTemplate",
  "article",
  "content-page content-page--list-object",
  true,
  true
);

export const ListObjectListTemplate = createTemplate(
  "ListObjectListTemplate",
  "article",
  "content-page content-page--list-object-list",
  true,
  true
);

function createTemplate(
  displayName: string,
  contentTag: "article" | "section",
  contentClass: string,
  includeTags: boolean,
  includeArticleNavigation: boolean
): TemplateComponent {
  const component: TemplateComponent = (props) => renderDocument(props, {
    contentTag,
    contentClass,
    includeTags,
    includeArticleNavigation
  });
  component.displayName = displayName;
  return component;
}

interface ContentOptions {
  contentTag: "article" | "section";
  contentClass: string;
  includeTags: boolean;
  includeArticleNavigation: boolean;
}

function renderDocument(props: TemplateProps, options: ContentOptions): VNode {
  const { config, input } = props;
  const metadata = input.document.metadata;
  const pageShellStyle = "--content-image-max-width: "
    + CONTENT_IMAGE_MAX_WIDTH_PERCENT
    + "%";
  const contentIr = lowerAstToIr(input.document.ast, {
    routeHref: (name) => props.resolver.href(name),
    relativeHref: (path) => props.resolver.hrefForRelative(path),
    assetHref: props.assetHrefForName,
    collections: props.collections
  });
  const contentVNodes = vueCodeGenerator.generate(contentIr);
  const githubAvatar = renderGithubAvatar(config.githubUsername, props.githubAvatarHref);
  const githubLink = renderGithubFollowLink(config.githubUsername);
  const navigation = h(
    "nav",
    { class: "site-nav", "aria-label": "Primary navigation" },
    renderNavigationLinks(input.primaryNavigation)
  );
  const breadcrumbs = h(
    "nav",
    { class: "breadcrumbs", "aria-label": "Breadcrumbs" },
    renderBreadcrumbs(input.navigation.breadcrumbs)
  );
  const brandContent = h("div", { class: "site-header__brand-content" }, [
    h("a", { class: "site-title", href: props.resolver.href("home") }, config.title),
    breadcrumbs
  ]);
  const brandChildren = githubAvatar === null
    ? [brandContent]
    : [githubAvatar, brandContent];
  const footer = config.footerText === null
    ? null
    : h("footer", { class: "site-footer" }, [
      h("div", { class: "site-footer__inner" }, [
        h("span", null, config.footerText)
      ])
    ]);

  return h("html", { lang: config.language }, [
    h("head", null, [
      h("meta", { charset: "utf-8" }),
      h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      h("meta", { name: "description", content: metadata.description }),
      h("title", null, `${metadata.title} | ${config.title}`),
      h("link", { rel: "stylesheet", href: props.assetHref })
    ]),
    h("body", null, [
      h("header", { class: "site-header" }, [
        h("div", { class: "site-header__inner" }, [
          h("div", { class: "site-header__brand" }, brandChildren),
          h(
            "div",
            { class: "site-header__actions" },
            githubLink === null ? [navigation] : [navigation, githubLink]
          )
        ])
      ]),
      h(
        "main",
        { class: "page-shell", style: pageShellStyle },
        [renderContentPage(props, options, contentVNodes)]
      ),
      footer
    ])
  ]);
}

function renderContentPage(
  props: TemplateProps,
  options: ContentOptions,
  contentVNodes: ReturnType<typeof vueCodeGenerator.generate>
): VNode {
  const metadata = props.input.document.metadata;
  const introChildren: VNode[] = [
    h("h1", null, metadata.title),
    h("p", { class: "lede" }, metadata.description)
  ];

  const contentChildren: VNode[] = [
    h("header", { class: "page-intro" }, introChildren),
    h("div", { class: "prose" }, contentVNodes)
  ];

  if (options.includeTags) {
    const tags = renderTags(metadata.tags);
    if (tags !== null) {
      contentChildren.push(h("div", { class: "page-tags" }, [tags]));
    }
  }

  if (options.includeArticleNavigation) {
    const adjacentLinks = [
      renderAdjacentLink(props.input.navigation.previous, "previous"),
      renderAdjacentLink(props.input.navigation.next, "next")
    ].filter((link): link is VNode => link !== null);
    const parent = props.input.navigation.parent;
    if (parent !== null || adjacentLinks.length > FIRST_INDEX) {
      const navigationChildren: VNode[] = [];
      if (parent !== null) {
        navigationChildren.push(
          h("a", { class: "back-link", href: parent.path }, ["Back to ", parent.label])
        );
      }
      if (adjacentLinks.length > FIRST_INDEX) {
        navigationChildren.push(
          h("div", { class: "article-navigation__links" }, adjacentLinks)
        );
      }
      contentChildren.push(
        h(
          "nav",
          { class: "article-navigation", "aria-label": "Article navigation" },
          navigationChildren
        )
      );
    }
  }

  return h(options.contentTag, { class: options.contentClass }, contentChildren);
}
