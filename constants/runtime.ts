export const DEFAULT_DEV_HOST = "127.0.0.1";
export const DEFAULT_DEV_PORT = 4173;

export const FIRST_INDEX = 0;
export const NO_INDEX = -1;
export const SORT_BEFORE = -1;
export const SORT_AFTER = 1;
export const DEFAULT_ORDERED_LIST_START = 1;

export const MIN_HEADING_DEPTH = 1;
export const MAX_HEADING_DEPTH = 6;
export const MAX_DESCRIPTION_LENGTH = 160;
export const DESCRIPTION_ELLIPSIS = "...";

export const COLLECTION_TITLE_FONT_SIZE_PX = 18.4;
export const COLLECTION_TITLE_CHAR_WIDTH_RATIO = 0.58;
export const COLLECTION_TITLE_SPACE_WIDTH_RATIO = 0.32;
export const COLLECTION_TITLE_WIDE_CHAR_WIDTH_RATIO = 1;
export const COLLECTION_TITLE_WIDTH_PADDING_PX = 2;
export const COLLECTION_REFERENCE_WIDTH_PX = 1200;
export const COLLECTION_TITLE_MAX_COLUMN_RATIO = 0.4;
export const CONTENT_IMAGE_MAX_WIDTH_PERCENT = 40;
export const MIN_IMAGE_WIDTH_PERCENT = 0;
export const MAX_IMAGE_WIDTH_PERCENT = 100;
export const IMAGE_WIDTH_ATTRIBUTE_PATTERN = /^\s*\{\s*(?<property>width|max-width)\s*=\s*(?<value>\d+(?:\.\d+)?)%\s*\}\s*$/u;

export const ROUTE_PREFIX = "route:";
export const ASSET_PREFIX = "asset:";
export const ROUTE_SEGMENT_SEPARATOR = ":";
export const ASSET_DIRECTORY = "assets";
export const WEB_IMAGE_EXTENSIONS = [".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"] as const;
