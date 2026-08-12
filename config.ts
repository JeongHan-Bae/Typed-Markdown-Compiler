import { resolveEnvironment } from "./constants/environment.ts";
import type { SiteConfig } from "./src/ast/types.ts";
import { resolveConstants } from "./constants/site.ts";

const constants = resolveConstants(resolveEnvironment(process.env));

export const siteConfig: SiteConfig = {
  language: "en",
  title: constants.siteTitle,
  description: "A small, typed content compiler for calm, durable static sites.",
  githubUsername: constants.githubUsername,
  footerText: constants.footerText,
  contentDirectory: constants.contentDirectory,
  styleEntry: "styles/site.less",
  publicDirectory: constants.publicDirectory,
  assetDirectory: constants.assetDirectory,
  basePath: constants.basePath
};
