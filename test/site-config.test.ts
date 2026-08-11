import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToString } from "@vue/server-renderer";
import {
  parseEnvironmentFile,
  resolveEnvironment,
  resolveEnvironmentFilePath
} from "../constants/environment.ts";
import { constantDefinitions, resolveConstants } from "../constants/site.ts";
import {
  renderGithubAvatar,
  renderGithubFollowLink
} from "../src/plugins/github-follow-link.ts";
import { resolveCurrentGithubUsername } from "./git-identity.ts";

const currentGithubUsername = resolveCurrentGithubUsername();

test("loads dotenv values over process fallbacks and ignores empty values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "typed-markdown-env-"));
  const environmentFile = join(directory, "custom.env");
  await writeFile(
    environmentFile,
    [
      "SITE_TITLE=Dotenv title",
      "FOOTER_TEXT=",
      "CONTENT_DIRECTORY=dotenv-content",
      "PUBLIC_DIRECTORY='dotenv-public'",
      "VITE_BASE_PATH=dotenv-site # inline comment",
      "GITHUB_USERNAME=dotenv-user",
      "GITHUB_ACTOR=dotenv-actor",
      "GITHUB_REPOSITORY_NAME=dotenv-repository",
      "HOST=dotenv-host",
      "PORT=9999",
      "ENV_DIRECTORY=dotenv-selector",
      "RT_TEST_HOST=dotenv-test-host",
      "# comments and blank lines are supported",
      ""
    ].join("\n"),
    "utf8"
  );

  try {
    const environment = resolveEnvironment({
      ENV_FILE: environmentFile,
      SITE_TITLE: "Process title",
      FOOTER_TEXT: "Process footer",
      CONTENT_DIRECTORY: "process-content",
      PUBLIC_DIRECTORY: "process-public",
      VITE_BASE_PATH: "process-site",
      GITHUB_USERNAME: "process-user",
      GITHUB_ACTOR: "process-actor",
      GITHUB_REPOSITORY_NAME: "process-repository",
      HOST: "process-host",
      PORT: "4173",
      ENV_DIRECTORY: "process-selector",
      RT_TEST_HOST: "process-test-host"
    }, directory);

    assert.equal(environment.SITE_TITLE, "Dotenv title");
    assert.equal(environment.FOOTER_TEXT, "Process footer");
    assert.equal(environment.CONTENT_DIRECTORY, "dotenv-content");
    assert.equal(environment.PUBLIC_DIRECTORY, "dotenv-public");
    assert.equal(environment.VITE_BASE_PATH, "process-site");
    assert.equal(environment.GITHUB_USERNAME, "process-user");
    assert.equal(environment.GITHUB_ACTOR, "process-actor");
    assert.equal(environment.GITHUB_REPOSITORY_NAME, "process-repository");
    assert.equal(environment.HOST, "process-host");
    assert.equal(environment.PORT, "4173");
    assert.equal(environment.ENV_DIRECTORY, "process-selector");
    assert.equal(environment.RT_TEST_HOST, "process-test-host");
    assert.equal(resolveConstants(environment).basePath, "/process-site");
    assert.deepEqual(parseEnvironmentFile("SITE_TITLE=Example\nEMPTY=\n"), {
      SITE_TITLE: "Example",
      EMPTY: ""
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("supports the project root and a selected dotenv directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "typed-markdown-env-root-"));
  const selectedDirectory = join(directory, "configuration");
  await mkdir(selectedDirectory);
  await writeFile(join(directory, ".env"), "SITE_TITLE=Root dotenv title\n", "utf8");
  await writeFile(
    join(selectedDirectory, ".env"),
    "SITE_TITLE=Directory dotenv title\n",
    "utf8"
  );

  try {
    assert.equal(resolveEnvironment({}, directory).SITE_TITLE, "Root dotenv title");
    assert.equal(
      resolveEnvironment({ ENV_DIRECTORY: "configuration" }, directory).SITE_TITLE,
      "Directory dotenv title"
    );
    assert.equal(
      resolveEnvironmentFilePath({ ENV_DIRECTORY: "configuration" }, directory),
      join(selectedDirectory, ".env")
    );
    assert.throws(
      () => resolveEnvironment({ ENV_FILE: "missing.env" }, directory),
      /Environment file does not exist: .*missing\.env/u
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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
