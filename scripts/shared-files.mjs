/** The one list of shared/ files and where each is copied. Read by
 *  sync-shared.mjs, build.mjs and check-sync.mjs -- add a shared file here, then
 *  add its <script> tag to the pages that use it. */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Copied into both extension/src/lib and viewer/lib. */
export const SHARED = ["lzstring.min.js", "share-codec.js", "monogram.js", "toast.js", "i18n.js"];

/** Extension-only: the build bakes VIEWER_BASE / SHORTENER_BASE into it. */
export const EXTENSION_ONLY = ["config.js"];

/** Working-tree copy targets (the build writes the same files into dist/). */
export const TARGETS = [
  { dir: path.join(root, "extension", "src", "lib"), files: [...SHARED, ...EXTENSION_ONLY] },
  { dir: path.join(root, "viewer", "lib"), files: SHARED },
];
