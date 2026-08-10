export interface ConstantDefinition {
  environmentName: string;
  defaultValue: string;
}

export const constantDefinitions = {
  siteTitle: {
    environmentName: "SITE_TITLE",
    defaultValue: "Personal Blog"
  },
  githubUsername: {
    environmentName: "GITHUB_USERNAME",
    defaultValue: ""
  },
  footerText: {
    environmentName: "FOOTER_TEXT",
    defaultValue: "built by JeongHan-Bae"
  },
  contentDirectory: {
    environmentName: "CONTENT_DIRECTORY",
    defaultValue: "content"
  },
  publicDirectory: {
    environmentName: "PUBLIC_DIRECTORY",
    defaultValue: "public"
  },
  basePath: {
    environmentName: "VITE_BASE_PATH",
    defaultValue: ""
  }
} as const satisfies Record<string, ConstantDefinition>;

export interface ResolvedConstants {
  siteTitle: string;
  githubUsername: string;
  footerText: string | null;
  contentDirectory: string;
  publicDirectory: string;
  basePath: string;
}

export function resolveConstants(
  environment: Readonly<Record<string, string | undefined>>,
  cliArguments: readonly string[] = process.argv.slice(2)
): ResolvedConstants {
  const githubUsername = resolveGithubUsername(environment);
  const githubFullName = resolveGithubFullName(environment, githubUsername);
  return {
    siteTitle: resolveSiteTitle(environment, githubFullName),
    githubUsername,
    footerText: resolveFooterValue(environment),
    contentDirectory: resolveValue(constantDefinitions.contentDirectory, environment),
    publicDirectory: resolveValue(constantDefinitions.publicDirectory, environment),
    basePath: resolveBasePath(environment, cliArguments)
  };
}

function resolveValue(
  definition: ConstantDefinition,
  environment: Readonly<Record<string, string | undefined>>
): string {
  const value = environment[definition.environmentName]?.trim();
  return value === undefined || value.length === 0 ? definition.defaultValue : value;
}

function resolveFooterValue(
  environment: Readonly<Record<string, string | undefined>>
): string | null {
  const value = environment[constantDefinitions.footerText.environmentName]?.trim();
  if (value === undefined || value.length === 0) {
    return constantDefinitions.footerText.defaultValue;
  }
  return /^(?:null|nil)$/iu.test(value) ? null : value;
}

function resolveSiteTitle(
  environment: Readonly<Record<string, string | undefined>>,
  githubFullName: string | null
): string {
  if (Object.hasOwn(environment, constantDefinitions.siteTitle.environmentName)) {
    return resolveValue(constantDefinitions.siteTitle, environment);
  }
  return githubFullName === null
    ? constantDefinitions.siteTitle.defaultValue
    : `${githubFullName}'s Personal Blog`;
}

function resolveGithubUsername(
  environment: Readonly<Record<string, string | undefined>>
): string {
  if (Object.hasOwn(environment, constantDefinitions.githubUsername.environmentName)) {
    return environment[constantDefinitions.githubUsername.environmentName]?.trim() ?? "";
  }

  return firstEnvironmentValue(environment, [
    "GITHUB_REPOSITORY_OWNER",
    "GITHUB_ACTOR"
  ]) ?? constantDefinitions.githubUsername.defaultValue;
}

function resolveGithubFullName(
  environment: Readonly<Record<string, string | undefined>>,
  githubUsername: string
): string | null {
  return firstEnvironmentValue(environment, [
    "GITHUB_USER_FULL_NAME",
    "GITHUB_OWNER_NAME",
    "GITHUB_ACTOR_NAME"
  ]) ?? (githubUsername.length === 0 ? null : githubUsername);
}

function resolveBasePath(
  environment: Readonly<Record<string, string | undefined>>,
  cliArguments: readonly string[]
): string {
  const cliBasePath = readCliBasePath(cliArguments);
  if (cliBasePath !== undefined) {
    return normalizeBasePath(cliBasePath);
  }

  if (Object.hasOwn(environment, constantDefinitions.basePath.environmentName)) {
    return normalizeBasePath(environment[constantDefinitions.basePath.environmentName] ?? "");
  }

  const repositoryName = firstEnvironmentValue(environment, ["GITHUB_REPOSITORY_NAME"])
    ?? repositoryNameFromEnvironment(environment.GITHUB_REPOSITORY);
  return repositoryName === null ? "" : normalizeBasePath(repositoryName);
}

function readCliBasePath(cliArguments: readonly string[]): string | undefined {
  for (let index = 0; index < cliArguments.length; index += 1) {
    const argument = cliArguments[index];
    if (argument === "--base") {
      return cliArguments[index + 1] ?? "";
    }
    if (argument?.startsWith("--base=") === true) {
      return argument.slice("--base=".length);
    }
  }
  return undefined;
}

function repositoryNameFromEnvironment(value: string | undefined): string | null {
  const repository = value?.trim();
  if (repository === undefined || repository.length === 0) {
    return null;
  }
  const separatorIndex = repository.indexOf("/");
  return separatorIndex < 0 ? repository : repository.slice(separatorIndex + 1);
}

function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "/" || trimmed === ".") {
    return "";
  }
  return `/${trimmed.replace(/^\/+|\/+$/gu, "")}`;
}

function firstEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  names: readonly string[]
): string | null {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return null;
}
