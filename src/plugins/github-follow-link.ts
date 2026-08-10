import { h, type VNode } from "vue";
import {
  GITHUB_ICON_PATH,
  GITHUB_ICON_VIEWBOX
} from "../../constants/github.ts";

export function normalizeGithubUsername(username: string): string | null {
  const normalizedUsername = username.trim().replace(/^@/u, "");
  return /^[A-Za-z0-9-]+$/u.test(normalizedUsername) ? normalizedUsername : null;
}

export function renderGithubFollowLink(username: string): VNode | null {
  const normalizedUsername = normalizeGithubUsername(username);
  if (normalizedUsername === null) {
    return null;
  }

  const href = `https://github.com/${normalizedUsername}`;
  return h("a", {
    class: "github-link",
    href,
    target: "_blank",
    rel: "noreferrer",
    "aria-label": `Follow ${normalizedUsername} on GitHub`
  }, [
    h("svg", {
      class: "github-link__icon",
      viewBox: GITHUB_ICON_VIEWBOX,
      "aria-hidden": "true",
      focusable: "false"
    }, [
      h("path", {
        fill: "currentColor",
        d: GITHUB_ICON_PATH
      })
    ]),
    h("span", null, "Follow me on GitHub")
  ]);
}

export function renderGithubAvatar(username: string, avatarSource: string | null): VNode | null {
  const normalizedUsername = normalizeGithubUsername(username);
  if (normalizedUsername === null || avatarSource === null || avatarSource.trim().length === 0) {
    return null;
  }

  return h("div", { class: "github-avatar-frame" }, [
    h("img", {
      class: "github-avatar",
      src: avatarSource,
      alt: `${normalizedUsername} GitHub avatar`,
      decoding: "async"
    })
  ]);
}
