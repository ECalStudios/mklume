/**
 * Shared path resolution for local docs assets (images, links).
 * Used by both MarkdownPreview (to render images) and Project Health
 * (to detect missing references).
 *
 * All paths are normalized to forward slashes internally.
 */

export interface ResolvedAsset {
  /** The path exactly as written in markdown */
  original: string;
  /** Full absolute path on disk (forward slashes) */
  absolutePath: string;
  /** Path relative to the docs root (forward slashes) */
  docsRelativePath: string;
}

/**
 * Resolve an asset path (image, link) relative to a markdown file.
 *
 * @param docsDir - Absolute path to the docs directory (may contain backslashes)
 * @param pageRelativePath - Current page path relative to docs (forward slashes)
 * @param refPath - The referenced path as written in markdown
 */
export function resolveDocsAsset(
  docsDir: string,
  pageRelativePath: string,
  refPath: string,
): ResolvedAsset {
  const normDocs = docsDir.replace(/\\/g, "/").replace(/\/+$/, "");

  let docsRelative: string;

  if (refPath.startsWith("/")) {
    docsRelative = refPath.slice(1);
  } else {
    const lastSlash = pageRelativePath.lastIndexOf("/");
    const pageDir =
      lastSlash === -1 ? "" : pageRelativePath.substring(0, lastSlash);

    const parts = pageDir ? pageDir.split("/") : [];
    for (const segment of refPath.split("/")) {
      if (segment === "..") {
        parts.pop();
      } else if (segment !== "." && segment !== "") {
        parts.push(segment);
      }
    }
    docsRelative = parts.join("/");
  }

  return {
    original: refPath,
    absolutePath: `${normDocs}/${docsRelative}`,
    docsRelativePath: docsRelative,
  };
}

/** True for URLs that should not be resolved locally. */
export function isExternalUrl(src: string): boolean {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("mailto:") ||
    src.startsWith("blob:")
  );
}
