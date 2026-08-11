import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { constantDefinitions } from "../constants/site.ts";

const execFileAsync = promisify(execFile);
const rootDirectory = process.cwd();

interface RouteManifest {
  routes: Array<{ name: string; path: string }>;
}

test("copies nested public assets and emits root-relative route references", async () => {
  await execFileAsync(
    process.execPath,
    ["--import=tsx", "src/build.ts"],
    {
      cwd: rootDirectory,
      env: {
        ...process.env,
        SITE_TITLE: "Personal Blog",
        GITHUB_USERNAME: "",
        FOOTER_TEXT: "",
        VITE_BASE_PATH: "",
        CONTENT_DIRECTORY: "dev/rt-test/fixtures/content",
        PUBLIC_DIRECTORY: "dev/rt-test/fixtures/public"
      }
    }
  );

  const asset = await readFile(join(rootDirectory, "dist/assets/icons/runtime-marker.svg"), "utf8");
  const indexHtml = await readFile(join(rootDirectory, "dist/index.html"), "utf8");
  const aboutHtml = await readFile(join(rootDirectory, "dist/about/index.html"), "utf8");
  const syntaxHtml = await readFile(join(rootDirectory, "dist/syntax/index.html"), "utf8");
  const entriesHtml = await readFile(join(rootDirectory, "dist/entries/index.html"), "utf8");
  const seriesHtml = await readFile(join(rootDirectory, "dist/entries/series/index.html"), "utf8");
  const nestedHtml = await readFile(
    join(rootDirectory, "dist/entries/branch/leaf/index.html"),
    "utf8"
  );
  const manifest = JSON.parse(
    await readFile(join(rootDirectory, "dist/routes.json"), "utf8")
  ) as RouteManifest;

  assert.match(asset, /<svg/u);
  assert.match(indexHtml, /href="\/assets\/icons\/runtime-marker\.svg"/u);
  assert.match(indexHtml, /src="\/assets\/icons\/runtime-marker\.svg"/u);
  assert.match(indexHtml, /--content-image-max-width: 40%/u);
  assert.match(indexHtml, new RegExp(escapeRegExp(constantDefinitions.footerText.defaultValue), "u"));
  assert.doesNotMatch(indexHtml, /github-avatar/u);
  assert.doesNotMatch(indexHtml, /Follow me on GitHub/u);
  assert.match(indexHtml, /alt="Runtime marker"[^>]*style="[^"]*width:\s*25%;[^"]*max-width:\s*100%/u);
  assert.doesNotMatch(indexHtml, /\{(?:max-width|width)=\d+(?:\.\d+)?%\}/u);
  assert.match(aboutHtml, /rel="stylesheet" href="\/assets\/site\.css"/u);
  assert.match(aboutHtml, /href="\/entries\/branch\/leaf\/"/u);
  assert.match(aboutHtml, /src="\/assets\/icons\/runtime-marker\.svg"/u);
  assert.match(aboutHtml, /alt="Runtime marker"[^>]*style="[^"]*max-width:\s*30%/u);
  assert.doesNotMatch(aboutHtml, /\{(?:max-width|width)=\d+(?:\.\d+)?%\}/u);
  assert.match(syntaxHtml, /<h5>HTML H5<\/h5>/u);
  assert.match(syntaxHtml, /<code>tt<\/code>/u);
  assert.match(syntaxHtml, /&lt;script&gt;alert\(&quot;escaped&quot;\)&lt;\/script&gt;/u);
  assert.match(entriesHtml, /href="\/entries\/branch\/"/u);
  assert.match(entriesHtml, /href="\/entries\/series\/"/u);
  assert.match(seriesHtml, /href="\/entries\/series\/first\/"/u);
  assert.match(seriesHtml, /href="\/entries\/series\/second\/"/u);
  assert.match(nestedHtml, /href="\/"/u);
  assert.match(nestedHtml, /href="\/entries\/branch\/leaf\/"/u);
  assert.doesNotMatch(
    nestedHtml.match(/<img[^>]*alt="Runtime marker"[^>]*>/u)?.[0] ?? "",
    /\bstyle=/u
  );
  assert.ok(manifest.routes.some((route) => (
    route.name === "entries:branch:leaf"
    && route.path === "/entries/branch/leaf/"
  )));
  assert.ok(manifest.routes.some((route) => route.name === "syntax"));
  assert.ok(!manifest.routes.some((route) => route.name === "draft"));
  assert.doesNotMatch(aboutHtml, /<script\b/u);

  const renderedPages = [
    "index.html",
    "about/index.html",
    "notes/index.html",
    "entries/index.html",
    "entries/branch/index.html",
    "entries/branch/leaf/index.html",
    "entries/series/index.html",
    "entries/series/first/index.html",
    "entries/series/second/index.html",
    "syntax/index.html"
  ];
  for (const pagePath of renderedPages) {
    const html = await readFile(join(rootDirectory, "dist", pagePath), "utf8");
    assert.match(html, /href="\/"/u, pagePath);
    assert.match(html, /href="\/entries\/branch\/leaf\/"/u, pagePath);
    assert.match(html, /src="\/assets\/icons\/runtime-marker\.svg"/u, pagePath);
    assert.doesNotMatch(html, /(?:href|src)="\.\.\//u, pagePath);
  }

  await execFileAsync(
    process.execPath,
    ["--import=tsx", "src/build.ts"],
    {
      cwd: rootDirectory,
      env: {
        ...process.env,
        SITE_TITLE: "Personal Blog",
        GITHUB_USERNAME: "",
        FOOTER_TEXT: "",
        VITE_BASE_PATH: "/fixture-site/",
        CONTENT_DIRECTORY: "dev/rt-test/fixtures/content",
        PUBLIC_DIRECTORY: "dev/rt-test/fixtures/public"
      }
    }
  );
  const basePathHtml = await readFile(join(rootDirectory, "dist/index.html"), "utf8");
  const basePathManifest = JSON.parse(
    await readFile(join(rootDirectory, "dist/routes.json"), "utf8")
  ) as RouteManifest;
  assert.match(basePathHtml, /href="\/fixture-site\/"/u);
  assert.match(basePathHtml, /href="\/fixture-site\/assets\/site\.css"/u);
  assert.match(basePathHtml, /src="\/fixture-site\/assets\/icons\/runtime-marker\.svg"/u);
  assert.doesNotMatch(basePathHtml, /href="\/assets\/site\.css"/u);
  assert.ok(basePathManifest.routes.some((route) => (
    route.name === "index"
    && route.path === "/fixture-site/"
  )));

  await execFileAsync(
    process.execPath,
    ["--import=tsx", "src/build.ts"],
    {
      cwd: rootDirectory,
      env: {
        ...process.env,
        SITE_TITLE: "Personal Blog",
        GITHUB_USERNAME: "",
        FOOTER_TEXT: "nil",
        VITE_BASE_PATH: "",
        CONTENT_DIRECTORY: "dev/rt-test/fixtures/content",
        PUBLIC_DIRECTORY: "dev/rt-test/fixtures/public"
      }
    }
  );
  const footerlessHtml = await readFile(join(rootDirectory, "dist/index.html"), "utf8");
  assert.doesNotMatch(footerlessHtml, /site-footer/u);
  assert.doesNotMatch(footerlessHtml, /built by /u);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
