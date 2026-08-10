import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "@vue/server-renderer";
import { constantDefinitions, resolveConstants } from "../constants/site.ts";
import {
  renderGithubAvatar,
  renderGithubFollowLink
} from "../src/plugins/github-follow-link.ts";
import { resolveCurrentGithubUsername } from "./git-identity.ts";

const currentGithubUsername = resolveCurrentGithubUsername();

test("uses defaults and environment overrides for build constants", () => {
  const defaults = resolveConstants({});
  assert.equal(defaults.siteTitle, "Personal Blog");
  assert.equal(defaults.githubUsername, "");
  assert.equal(defaults.footerText, constantDefinitions.footerText.defaultValue);
  assert.equal(
    resolveConstants({ FOOTER_TEXT: "" }).footerText,
    constantDefinitions.footerText.defaultValue
  );
  assert.equal(resolveConstants({ FOOTER_TEXT: "null" }).footerText, null);
  assert.equal(resolveConstants({ FOOTER_TEXT: "nil" }).footerText, null);
  assert.equal(defaults.contentDirectory, "content");
  assert.equal(defaults.publicDirectory, "public");
  assert.equal(defaults.basePath, "");

  const inferredFromActions = resolveConstants({
    GITHUB_REPOSITORY_OWNER: "fixture-owner",
    GITHUB_USER_FULL_NAME: "Fixture Owner",
    GITHUB_REPOSITORY_NAME: "fixture-site"
  }, []);
  assert.equal(inferredFromActions.siteTitle, "Fixture Owner's Personal Blog");
  assert.equal(inferredFromActions.githubUsername, "fixture-owner");
  assert.equal(inferredFromActions.basePath, "/fixture-site");
  assert.equal(
    resolveConstants({ VITE_BASE_PATH: "", GITHUB_REPOSITORY_NAME: "ignored-site" }, []).basePath,
    ""
  );
  assert.equal(resolveConstants({}, ["--base", "/fixture-cli/"]).basePath, "/fixture-cli");
  assert.equal(resolveConstants({}, ["--base=/fixture-inline/"]).basePath, "/fixture-inline");
  assert.equal(
    resolveConstants({ GITHUB_REPOSITORY: "fixture-owner/fixture-repository" }, []).basePath,
    "/fixture-repository"
  );
  assert.equal(
    resolveConstants({ GITHUB_USERNAME: "", GITHUB_REPOSITORY_OWNER: "ignored-owner" }).githubUsername,
    ""
  );

  const overridden = resolveConstants({
    SITE_TITLE: "Personal Blog",
    GITHUB_USERNAME: currentGithubUsername ?? "",
    FOOTER_TEXT: "A personal publication",
    CONTENT_DIRECTORY: "dev/rt-test/fixtures/content",
    PUBLIC_DIRECTORY: "dev/rt-test/fixtures/public"
  });
  assert.equal(overridden.siteTitle, "Personal Blog");
  assert.equal(overridden.githubUsername, currentGithubUsername ?? "");
  assert.equal(overridden.footerText, "A personal publication");
  assert.equal(overridden.contentDirectory, "dev/rt-test/fixtures/content");
  assert.equal(overridden.publicDirectory, "dev/rt-test/fixtures/public");
});

test("only renders the GitHub action for a valid username", async (t) => {
  assert.equal(renderGithubFollowLink(""), null);
  assert.equal(renderGithubFollowLink("not a username"), null);

  if (currentGithubUsername === null) {
    t.skip("the current repository has no GitHub remote");
    return;
  }

  const link = renderGithubFollowLink(currentGithubUsername);
  assert.ok(link);
  const html = await renderToString(link);
  assert.match(html, new RegExp(`href="https://github\\.com/${currentGithubUsername}"`, "u"));
  assert.match(html, /Follow me on GitHub/u);
  assert.match(html, /<svg/u);
});

test("renders a GitHub avatar only for a valid username", async (t) => {
  assert.equal(renderGithubAvatar("", "/assets/github/test-user.png"), null);
  assert.equal(renderGithubAvatar("not a username", "/assets/github/test-user.png"), null);
  if (currentGithubUsername === null) {
    t.skip("the current repository has no GitHub remote");
    return;
  }

  assert.equal(renderGithubAvatar(currentGithubUsername, null), null);
  const avatarPath = `/assets/github/${currentGithubUsername}.png`;
  const avatar = renderGithubAvatar(currentGithubUsername, avatarPath);
  assert.ok(avatar);
  const html = await renderToString(avatar);
  assert.match(html, /<div class="github-avatar-frame"><img class="github-avatar"/u);
  assert.match(html, /class="github-avatar"/u);
  assert.match(html, new RegExp(`src="${avatarPath}"`, "u"));
  assert.match(html, new RegExp(`alt="${currentGithubUsername} GitHub avatar"`, "u"));

  const cachedAvatar = renderGithubAvatar(currentGithubUsername, avatarPath);
  assert.ok(cachedAvatar);
  const cachedHtml = await renderToString(cachedAvatar);
  assert.match(cachedHtml, new RegExp(`src="${avatarPath}"`, "u"));
});
