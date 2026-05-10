import { useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import MarkdownPreview from "./MarkdownPreview";
import SitePreview from "./SitePreview";
import InsertToolbar from "./InsertToolbar";
import VisualEditor from "./VisualEditor";
import FindReplace from "./FindReplace";
import LinkAutocomplete from "./LinkAutocomplete";
import { insertBlock } from "../../utils/insertBlock";
import type { BlockType } from "../../utils/insertBlock";
import type { PageEntry, NavEntry, ViewMode, PreviewType, SplitEditor } from "../../types/project";
import type { SiteConfig } from "../../services/projectService";
import type { PageIndexEntry } from "../../hooks/usePageIndex";
import type { AutocompleteState } from "../../hooks/useLinkAutocomplete";
import {
  toggleBold,
  toggleItalic,
  toggleInlineCode,
  toggleStrikethrough,
  insertLink,
  insertImage,
  insertHeading,
  insertFootnote,
} from "../../utils/formatMarkdown";

export interface ContentAreaHandle {
  /** Get the textarea ref for direct manipulation */
  getTextarea: () => HTMLTextAreaElement | null;
  /** Apply a formatting command */
  execFormat: (cmd: string) => void;
  /** Insert a block by type */
  execInsertBlock: (type: BlockType) => void;
}

interface ContentAreaProps {
  content: string;
  selectedPage: PageEntry | null;
  isDirty: boolean;
  onChange: (value: string) => void;
  viewMode: ViewMode;
  docsDir: string;
  editorFontSize?: number;
  wordWrap?: boolean;
  findOpen: boolean;
  findReplaceOpen: boolean;
  onFindClose: () => void;
  /** Drag overlay state from useImageDrop */
  imageDragState?: { isDragging: boolean; hasImages: boolean };
  /** Page index for link autocomplete */
  pageIndex?: PageIndexEntry[];
  /** Link autocomplete state from useLinkAutocomplete */
  linkAutocomplete?: AutocompleteState;
  /** Called on text change / cursor move to check triggers */
  onCheckLinkTrigger?: (content: string, cursorPos: number) => void;
  /** Called when user selects a page from autocomplete */
  onLinkSelect?: (title: string, relativePath: string) => void;
  /** Called to close autocomplete */
  onLinkClose?: () => void;
  /** Site Preview + Flexible Split */
  previewType?: PreviewType;
  onPreviewTypeChange?: (type: PreviewType) => void;
  splitEditor?: SplitEditor;
  onSplitEditorChange?: (type: SplitEditor) => void;
  /** Data for Site Preview */
  nav?: NavEntry[] | null;
  pages?: PageEntry[];
  siteName?: string;
  siteConfig?: SiteConfig | null;
  onNavigate?: (page: PageEntry) => void;
}

const ContentArea = forwardRef<ContentAreaHandle, ContentAreaProps>(function ContentArea(
  {
    content,
    selectedPage,
    isDirty,
    onChange,
    viewMode,
    docsDir,
    editorFontSize = 13,
    wordWrap = true,
    findOpen,
    findReplaceOpen,
    onFindClose,
    imageDragState,
    pageIndex,
    linkAutocomplete,
    onCheckLinkTrigger,
    onLinkSelect,
    onLinkClose,
    previewType = "page",
    onPreviewTypeChange,
    splitEditor = "markdown",
    onSplitEditorChange,
    nav,
    pages,
    siteName = "",
    siteConfig,
    onNavigate,
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Apply a format result to the textarea
  const applyFormat = useCallback(
    (result: { newContent: string; selStart: number; selEnd: number }) => {
      onChange(result.newContent);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.selectionStart = result.selStart;
          ta.selectionEnd = result.selEnd;
        }
      });
    },
    [onChange],
  );

  const execFormat = useCallback(
    (cmd: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;

      switch (cmd) {
        case "bold":          applyFormat(toggleBold(content, s, e)); break;
        case "italic":        applyFormat(toggleItalic(content, s, e)); break;
        case "inlineCode":    applyFormat(toggleInlineCode(content, s, e)); break;
        case "strikethrough": applyFormat(toggleStrikethrough(content, s, e)); break;
        case "link":          applyFormat(insertLink(content, s, e)); break;
        case "image":         applyFormat(insertImage(content, s, e)); break;
        case "h1":            applyFormat(insertHeading(content, s, e, 1)); break;
        case "h2":            applyFormat(insertHeading(content, s, e, 2)); break;
        case "h3":            applyFormat(insertHeading(content, s, e, 3)); break;
        case "h4":            applyFormat(insertHeading(content, s, e, 4)); break;
        case "h5":            applyFormat(insertHeading(content, s, e, 5)); break;
        case "h6":            applyFormat(insertHeading(content, s, e, 6)); break;
        case "footnote":      applyFormat(insertFootnote(content, s, e)); break;
      }
    },
    [content, applyFormat],
  );

  const handleInsertBlock = useCallback(
    (type: BlockType) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const result = insertBlock(type, content, ta.selectionStart, ta.selectionEnd);
      onChange(result.newContent);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = result.cursorStart;
        ta.selectionEnd = result.cursorEnd;
      });
    },
    [content, onChange],
  );

  // Expose handle to parent
  useImperativeHandle(ref, () => ({
    getTextarea: () => textareaRef.current,
    execFormat,
    execInsertBlock: handleInsertBlock,
  }), [execFormat, handleInsertBlock]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.ctrlKey || e.metaKey;

      // Close link autocomplete on Escape (before other handlers)
      if (e.key === "Escape" && linkAutocomplete?.active && onLinkClose) {
        e.preventDefault();
        e.stopPropagation();
        onLinkClose();
        return;
      }

      if (e.key === "Tab") {
        // If link autocomplete is active, Tab selects (handled by LinkAutocomplete's capture handler)
        if (linkAutocomplete?.active) return;
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = content.substring(0, start) + "  " + content.substring(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = start + 2;
          ta.selectionEnd = start + 2;
        });
        return;
      }

      if (!mod) return;

      // Formatting shortcuts handled at textarea level
      switch (e.key) {
        case "b":
          e.preventDefault();
          execFormat("bold");
          break;
        case "i":
          e.preventDefault();
          execFormat("italic");
          break;
        case "e":
          e.preventDefault();
          execFormat("inlineCode");
          break;
        case "K":
        case "k":
          // Ctrl+Shift+K → code block (only with shift)
          if (e.shiftKey) {
            e.preventDefault();
            handleInsertBlock("code");
          }
          // Plain Ctrl+K is handled at App level (command palette or link)
          break;
      }
    },
    [content, onChange, execFormat, handleInsertBlock, linkAutocomplete?.active, onLinkClose],
  );

  if (!selectedPage) {
    return (
      <div className="content-area">
        <div className="content-empty">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-tertiary)" }}
          >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 13h4" />
            <path d="M10 17h4" />
          </svg>
          <p>Select a page from the sidebar to start editing.</p>
        </div>
      </div>
    );
  }

  // Flexible split: left side can be markdown or visual, right side can be page or site
  const isSplit = viewMode === "split";
  const showEditor = viewMode === "edit" || (isSplit && splitEditor === "markdown");
  const showPreview = viewMode === "preview" || isSplit;
  const showVisual = viewMode === "visual" || (isSplit && splitEditor === "visual");
  const showToolbar = viewMode === "edit" || (isSplit && splitEditor === "markdown");
  const showFind = (findOpen || findReplaceOpen) && showEditor;
  const useSitePreview = previewType === "site" && (viewMode === "preview" || isSplit);

  const lineCount = content.split("\n").length;
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="content-area">
      <div className="content-header">
        <div className="content-header-left">
          <h2 className="content-title">
            {selectedPage.title}
            {isDirty && <span className="content-dirty-dot" />}
          </h2>
          <span className="content-path">{selectedPage.relative_path}</span>
        </div>
      </div>

      {showToolbar && <InsertToolbar onInsert={handleInsertBlock} />}

      {showFind && (
        <FindReplace
          open={showFind}
          showReplace={findReplaceOpen}
          content={content}
          onChange={onChange}
          onClose={onFindClose}
          textareaRef={textareaRef}
        />
      )}

      {/* Split mode controls */}
      {isSplit && (
        <div className="split-controls">
          <div className="split-controls-left">
            <span className="split-controls-label">Editor:</span>
            <div className="split-controls-toggle">
              <button
                className={`split-controls-btn${splitEditor === "markdown" ? " active" : ""}`}
                onClick={() => onSplitEditorChange?.("markdown")}
              >
                Markdown
              </button>
              <button
                className={`split-controls-btn${splitEditor === "visual" ? " active" : ""}`}
                onClick={() => onSplitEditorChange?.("visual")}
              >
                Visual
              </button>
            </div>
          </div>
          <div className="split-controls-right">
            <span className="split-controls-label">Preview:</span>
            <div className="split-controls-toggle">
              <button
                className={`split-controls-btn${previewType === "page" ? " active" : ""}`}
                onClick={() => onPreviewTypeChange?.("page")}
              >
                Page
              </button>
              <button
                className={`split-controls-btn${previewType === "site" ? " active" : ""}`}
                onClick={() => onPreviewTypeChange?.("site")}
              >
                Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview type toggle (standalone preview mode) */}
      {viewMode === "preview" && onPreviewTypeChange && (
        <div className="preview-type-bar">
          <div className="split-controls-toggle">
            <button
              className={`split-controls-btn${previewType === "page" ? " active" : ""}`}
              onClick={() => onPreviewTypeChange("page")}
            >
              Page Preview
            </button>
            <button
              className={`split-controls-btn${previewType === "site" ? " active" : ""}`}
              onClick={() => onPreviewTypeChange("site")}
            >
              Site Preview
            </button>
          </div>
        </div>
      )}

      <div className={`content-body content-body--${viewMode}`}>
        {imageDragState?.isDragging && (
          <div className="image-drop-overlay">
            <div className="image-drop-overlay-content">
              {imageDragState.hasImages ? (
                <>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                  <span className="image-drop-overlay-text">Drop images to add them to docs/assets</span>
                </>
              ) : (
                <>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m15 9-6 6" />
                    <path d="m9 9 6 6" />
                  </svg>
                  <span className="image-drop-overlay-text">Unsupported file type</span>
                </>
              )}
            </div>
          </div>
        )}
        {showEditor && !isSplit && (
          <>
            <textarea
              ref={textareaRef}
              className="content-editor"
              value={content}
              onChange={(e) => {
                onChange(e.target.value);
                if (onCheckLinkTrigger) {
                  requestAnimationFrame(() => {
                    const ta = textareaRef.current;
                    if (ta) onCheckLinkTrigger(ta.value, ta.selectionStart);
                  });
                }
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={(e) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                  if (onCheckLinkTrigger) {
                    const ta = e.currentTarget;
                    onCheckLinkTrigger(ta.value, ta.selectionStart);
                  }
                }
              }}
              onClick={() => {
                if (onCheckLinkTrigger) {
                  const ta = textareaRef.current;
                  if (ta) onCheckLinkTrigger(ta.value, ta.selectionStart);
                }
              }}
              spellCheck={false}
              style={{
                fontSize: `${editorFontSize}px`,
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                wordWrap: wordWrap ? "break-word" : "normal",
                overflowX: wordWrap ? "hidden" : "auto",
              }}
            />
            {linkAutocomplete?.active && pageIndex && onLinkSelect && onLinkClose && selectedPage && (
              <LinkAutocomplete
                autocomplete={linkAutocomplete}
                pageIndex={pageIndex}
                currentPagePath={selectedPage.relative_path}
                textareaRef={textareaRef}
                onSelect={onLinkSelect}
                onClose={onLinkClose}
              />
            )}
          </>
        )}
        {showVisual && !isSplit && (
          <VisualEditor
            content={content}
            onChange={onChange}
            docsDir={docsDir}
            pageRelativePath={selectedPage.relative_path}
          />
        )}
        {/* Split mode: left pane (editor) */}
        {isSplit && (
          <div className="split-pane split-pane-left">
            {splitEditor === "markdown" ? (
              <>
                <textarea
                  ref={textareaRef}
                  className="content-editor"
                  value={content}
                  onChange={(e) => {
                    onChange(e.target.value);
                    if (onCheckLinkTrigger) {
                      requestAnimationFrame(() => {
                        const ta = textareaRef.current;
                        if (ta) onCheckLinkTrigger(ta.value, ta.selectionStart);
                      });
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  onKeyUp={(e) => {
                    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                      if (onCheckLinkTrigger) {
                        const ta = e.currentTarget;
                        onCheckLinkTrigger(ta.value, ta.selectionStart);
                      }
                    }
                  }}
                  onClick={() => {
                    if (onCheckLinkTrigger) {
                      const ta = textareaRef.current;
                      if (ta) onCheckLinkTrigger(ta.value, ta.selectionStart);
                    }
                  }}
                  spellCheck={false}
                  style={{
                    fontSize: `${editorFontSize}px`,
                    whiteSpace: wordWrap ? "pre-wrap" : "pre",
                    wordWrap: wordWrap ? "break-word" : "normal",
                    overflowX: wordWrap ? "hidden" : "auto",
                  }}
                />
                {linkAutocomplete?.active && pageIndex && onLinkSelect && onLinkClose && selectedPage && (
                  <LinkAutocomplete
                    autocomplete={linkAutocomplete}
                    pageIndex={pageIndex}
                    currentPagePath={selectedPage.relative_path}
                    textareaRef={textareaRef}
                    onSelect={onLinkSelect}
                    onClose={onLinkClose}
                  />
                )}
              </>
            ) : (
              <VisualEditor
                content={content}
                onChange={onChange}
                docsDir={docsDir}
                pageRelativePath={selectedPage.relative_path}
              />
            )}
          </div>
        )}
        {/* Split mode: right pane (preview) */}
        {isSplit && (
          <div className="split-pane split-pane-right">
            {useSitePreview ? (
              <SitePreview
                content={content}
                docsDir={docsDir}
                pageRelativePath={selectedPage.relative_path}
                nav={nav ?? null}
                selectedPage={selectedPage}
                siteName={siteName}
                siteConfig={siteConfig ?? null}
                onNavigate={onNavigate}
                pages={pages ?? []}
              />
            ) : (
              <MarkdownPreview
                content={content}
                docsDir={docsDir}
                pageRelativePath={selectedPage.relative_path}
              />
            )}
          </div>
        )}
        {/* Standalone preview mode */}
        {showPreview && !isSplit && (
          useSitePreview ? (
            <SitePreview
              content={content}
              docsDir={docsDir}
              pageRelativePath={selectedPage.relative_path}
              nav={nav ?? null}
              selectedPage={selectedPage}
              siteName={siteName}
              siteConfig={siteConfig ?? null}
              onNavigate={onNavigate}
              pages={pages ?? []}
            />
          ) : (
            <MarkdownPreview
              content={content}
              docsDir={docsDir}
              pageRelativePath={selectedPage.relative_path}
            />
          )
        )}
      </div>

      {(showEditor || (isSplit && splitEditor === "markdown")) && (
        <div className="editor-status-footer">
          <span className="editor-status-item">{lineCount} lines</span>
          <span className="editor-status-item">{wordCount} words</span>
          <span className="editor-status-item">{charCount} chars</span>
        </div>
      )}
    </div>
  );
});

export default ContentArea;
