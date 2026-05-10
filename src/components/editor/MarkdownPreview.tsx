/*
 * MkLume
 * Copyright © 2026 ECal Studios. Created by Enrique Cal.
 * Licensed under the GNU General Public License v3.0.
 */

import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { convertFileSrc } from "@tauri-apps/api/core";
import { preprocessAdmonitions } from "../../utils/markdownPreprocess";
import { resolveDocsAsset, isExternalUrl } from "../../utils/pathResolver";
import IconShortcode from "../common/IconShortcode";
import { ICON_SHORTCODE_REGEX } from "../../utils/iconShortcodes";

interface MarkdownPreviewProps {
  content: string;
  docsDir: string;
  pageRelativePath: string;
}

const ICON_SPLIT_REGEX =
  /:(material|fontawesome|simple|octicons|emoji)-[a-zA-Z0-9-]+:/g;

function renderTextWithIcons(text: string): ReactNode {
  if (!ICON_SHORTCODE_REGEX.test(text)) {
    ICON_SHORTCODE_REGEX.lastIndex = 0;
    return text;
  }
  ICON_SHORTCODE_REGEX.lastIndex = 0;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const re = new RegExp(ICON_SPLIT_REGEX.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <IconShortcode key={key++} shortcode={match[0]} size={16} />,
    );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function processChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    return renderTextWithIcons(children);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        const result = renderTextWithIcons(child);
        if (typeof result === "string") return result;
        return <span key={`ic-${i}`}>{result}</span>;
      }
      return child;
    });
  }
  return children;
}

function MarkdownPreview({
  content,
  docsDir,
  pageRelativePath,
}: MarkdownPreviewProps) {
  const processed = preprocessAdmonitions(content);

  const components = useMemo(
    () => ({
      img: ({
        src,
        alt,
        ...props
      }: React.ImgHTMLAttributes<HTMLImageElement>) => {
        if (!src) return <img alt={alt} {...props} />;

        if (isExternalUrl(src)) {
          return <img src={src} alt={alt} {...props} />;
        }

        const resolved = resolveDocsAsset(docsDir, pageRelativePath, src);
        const assetUrl = convertFileSrc(resolved.absolutePath);

        return (
          <img
            src={assetUrl}
            alt={alt || ""}
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "inline-block";
              el.style.border = "1px dashed var(--border)";
              el.style.borderRadius = "4px";
              el.style.padding = "8px 12px";
              el.style.fontSize = "12px";
              el.style.color = "var(--text-tertiary)";
              el.style.background = "var(--bg-elevated)";
              el.style.maxWidth = "100%";
              el.alt = `⚠ Image not found: ${src}`;
              el.removeAttribute("src");
            }}
            {...props}
          />
        );
      },
      p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p {...props}>{processChildren(children)}</p>
      ),
      strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
        <strong {...props}>{processChildren(children)}</strong>
      ),
      em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
        <em {...props}>{processChildren(children)}</em>
      ),
      a: ({
        children,
        ...props
      }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a {...props}>{processChildren(children)}</a>
      ),
      li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
        <li {...props}>{processChildren(children)}</li>
      ),
      td: ({
        children,
        ...props
      }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
        <td {...props}>{processChildren(children)}</td>
      ),
      th: ({
        children,
        ...props
      }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
        <th {...props}>{processChildren(children)}</th>
      ),
      h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h1 {...props}>{processChildren(children)}</h1>
      ),
      h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h2 {...props}>{processChildren(children)}</h2>
      ),
      h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h3 {...props}>{processChildren(children)}</h3>
      ),
      h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h4 {...props}>{processChildren(children)}</h4>
      ),
      span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
        <span {...props}>{processChildren(children)}</span>
      ),
      div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div {...props}>{processChildren(children)}</div>
      ),
      summary: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
        <summary {...props}>{processChildren(children)}</summary>
      ),
    }),
    [docsDir, pageRelativePath],
  );

  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownPreview;
