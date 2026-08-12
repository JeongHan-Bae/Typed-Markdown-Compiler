import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parse } from "dotenv";

export const ENV_FILE_NAME = "ENV_FILE";
export const ENV_DIRECTORY_NAME = "ENV_DIRECTORY";
export const ASSET_DIRECTORY_ENV_NAME = "ASSET_DIRECTORY";
export const DEFAULT_ENV_FILE_NAME = ".env";

const ENVIRONMENT_OVERRIDE_NAMES = new Set([
  "SITE_TITLE",
  "FOOTER_TEXT",
  "CONTENT_DIRECTORY",
  "PUBLIC_DIRECTORY",
  ASSET_DIRECTORY_ENV_NAME
]);

export type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Merge the project .env file over the process environment.
 *
 * A non-empty value for an allowed user key replaces the same process value.
 * An empty allowed value does nothing, so normal process/default resolution
 * continues. Keys outside the allowlist are never copied from the file and
 * therefore cannot replace deployment, identity, server, or test controls.
 */
export function resolveEnvironment(
  environment: Environment,
  rootDirectory = process.cwd()
): Record<string, string | undefined> {
  const resolved: Record<string, string | undefined> = { ...environment };
  const fileValues = readEnvironmentFile(environment, rootDirectory);

  for (const [name, value] of Object.entries(fileValues)) {
    if (isEnvironmentOverrideAllowed(name) && value.trim().length > 0) {
      resolved[name] = value;
    }
  }

  return resolved;
}

export function resolveEnvironmentFilePath(
  environment: Environment,
  rootDirectory = process.cwd()
): string {
  const configuredFile = nonEmptyValue(environment[ENV_FILE_NAME]);
  if (configuredFile !== null) {
    return isAbsolute(configuredFile)
      ? configuredFile
      : resolve(rootDirectory, configuredFile);
  }

  const configuredDirectory = nonEmptyValue(environment[ENV_DIRECTORY_NAME]);
  return configuredDirectory === null
    ? resolve(rootDirectory, DEFAULT_ENV_FILE_NAME)
    : resolve(rootDirectory, configuredDirectory, DEFAULT_ENV_FILE_NAME);
}

export function parseEnvironmentFile(source: string): Record<string, string> {
  return parse(source);
}

export function isEnvironmentOverrideAllowed(name: string): boolean {
  return ENVIRONMENT_OVERRIDE_NAMES.has(name);
}

export function readEnvironmentFile(
  environment: Environment,
  rootDirectory = process.cwd()
): Record<string, string> {
  const environmentFile = resolveEnvironmentFilePath(environment, rootDirectory);
  return loadEnvironmentFile(environmentFile, isEnvironmentFileConfigured(environment));
}

function loadEnvironmentFile(filePath: string, required: boolean): Record<string, string> {
  if (!existsSync(filePath)) {
    if (!required) {
      return {};
    }
    throw new Error(`Environment file does not exist: ${filePath}`);
  }

  return parseEnvironmentFile(readFileSync(filePath, "utf8"));
}

function isEnvironmentFileConfigured(environment: Environment): boolean {
  return nonEmptyValue(environment[ENV_FILE_NAME]) !== null
    || nonEmptyValue(environment[ENV_DIRECTORY_NAME]) !== null;
}

function nonEmptyValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}
