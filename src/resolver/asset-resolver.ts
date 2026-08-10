import { extname } from "node:path";
import {
  ASSET_DIRECTORY,
  WEB_IMAGE_EXTENSIONS
} from "../../constants/runtime.ts";

export function normalizeAssetName(name: string): string {
  const normalized = name.trim().replaceAll("\\", "/").replace(/^\.\//u, "");
  const segments = normalized.split("/");
  if (
    normalized.length === 0
    || normalized.startsWith("/")
    || segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe asset path rejected: ${name}`);
  }

  const extension = extname(normalized).toLowerCase();
  if (!(WEB_IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new Error(`Unsupported asset type: ${name}`);
  }

  return segments.join("/");
}

export function assetOutputPath(name: string): string {
  return `${ASSET_DIRECTORY}/${normalizeAssetName(name)}`;
}
