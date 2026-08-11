import { h, type VNode } from "vue";
import { FIRST_INDEX } from "../../../constants/runtime.ts";
import type { NavigationLink } from "../../ast/types.ts";

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
    { class: `adjacent-link adjacent-link--${direction}`, href: link.path },
    [h("span", null, label), h("strong", null, link.label)]
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
