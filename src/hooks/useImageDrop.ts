/**
 * useImageDrop — hook for handling drag-and-drop image files via Tauri v2 window events.
 *
 * Tauri v2 emits `tauri://drag-drop` events on the window with file paths from the OS.
 * We listen to those events, copy files to docs/assets via the Rust backend, and return
 * the Markdown snippets to insert.
 *
 * Browser-level dragover/dragleave events are used for the overlay UX only (Tauri events
 * don't provide dragover/dragleave).
 */
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { copyImagesToAssets, type CopyImagesResult } from "../services/projectService";

const SUPPORTED_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);

export interface ImageDropResult {
  /** Markdown lines to insert, e.g. ["![Alt](assets/img.png)"] */
  markdownLines: string[];
  /** Toast message to show */
  toastMessage: string;
  /** "success" | "error" | "info" */
  toastType: "success" | "error" | "info";
}

interface UseImageDropOptions {
  /** Absolute path to docs directory */
  docsDir: string | null;
  /** Current page relative path (e.g. "plugins/overview.md") */
  pageRelativePath: string | null;
  /** Whether dropping is enabled (needs a project + page open) */
  enabled: boolean;
  /** Callback when images are dropped and copied */
  onImageDrop: (result: ImageDropResult) => void;
}

export interface ImageDropState {
  /** Whether files are being dragged over the window */
  isDragging: boolean;
  /** Whether the dragged files contain any supported images */
  hasImages: boolean;
}

export function useImageDrop({
  docsDir,
  pageRelativePath,
  enabled,
  onImageDrop,
}: UseImageDropOptions): ImageDropState {
  const [isDragging, setIsDragging] = useState(false);
  const [hasImages, setHasImages] = useState(true);
  const dragCounterRef = useRef(0);
  const onImageDropRef = useRef(onImageDrop);
  onImageDropRef.current = onImageDrop;

  // Browser-level dragover/dragleave for overlay UX
  useEffect(() => {
    if (!enabled) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setIsDragging(true);
        // Check if any dragged files are images
        const items = e.dataTransfer?.items;
        if (items && items.length > 0) {
          let foundImage = false;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === "file" && item.type.startsWith("image/")) {
              foundImage = true;
              break;
            }
          }
          // If no type info available (common with OS file drags), assume images
          if (items.length > 0 && !items[0].type) {
            foundImage = true;
          }
          setHasImages(foundImage);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
    };
  }, [enabled]);

  // Tauri drag-drop event for actual file paths
  useEffect(() => {
    if (!enabled || !docsDir || !pageRelativePath) return;

    const win = getCurrentWindow();
    let cancelled = false;

    const setupListener = async () => {
      const unlisten = await win.onDragDropEvent(async (event) => {
        if (cancelled) return;

        if (event.payload.type === "drop") {
          dragCounterRef.current = 0;
          setIsDragging(false);

          const paths: string[] = event.payload.paths ?? [];
          if (paths.length === 0) return;

          // Filter to supported image extensions
          const imagePaths = paths.filter((p) => {
            const ext = p.split(".").pop()?.toLowerCase() ?? "";
            return SUPPORTED_EXTS.has(ext);
          });

          const unsupportedCount = paths.length - imagePaths.length;

          if (imagePaths.length === 0) {
            onImageDropRef.current({
              markdownLines: [],
              toastMessage:
                unsupportedCount === 1
                  ? "Unsupported file type — only images (PNG, JPG, WebP, GIF, SVG) are supported"
                  : `${unsupportedCount} unsupported files skipped`,
              toastType: "error",
            });
            return;
          }

          try {
            const result: CopyImagesResult = await copyImagesToAssets(
              docsDir!,
              pageRelativePath!,
              imagePaths,
            );

            const markdownLines = result.results
              .filter((r) => r.ok)
              .map((r) => `![${r.alt_text}](${r.markdown_path})`);

            let toastMessage: string;
            let toastType: "success" | "error" | "info";

            const totalSkipped = result.skipped_count + unsupportedCount;

            if (result.copied_count > 0 && totalSkipped === 0) {
              toastMessage =
                result.copied_count === 1
                  ? "Added 1 image to assets"
                  : `Added ${result.copied_count} images to assets`;
              toastType = "success";
            } else if (result.copied_count > 0 && totalSkipped > 0) {
              toastMessage = `${result.copied_count} image${result.copied_count > 1 ? "s" : ""} added, ${totalSkipped} file${totalSkipped > 1 ? "s" : ""} skipped`;
              toastType = "info";
            } else {
              const errors = result.results
                .filter((r) => !r.ok)
                .map((r) => r.error)
                .filter(Boolean);
              toastMessage = errors[0] ?? "Failed to copy images";
              toastType = "error";
            }

            onImageDropRef.current({ markdownLines, toastMessage, toastType });
          } catch (err) {
            onImageDropRef.current({
              markdownLines: [],
              toastMessage: `Error: ${err}`,
              toastType: "error",
            });
          }
        } else if (event.payload.type === "over") {
          // Tauri also sends "over" events — keep overlay active
          setIsDragging(true);
        } else if (event.payload.type === "leave") {
          setIsDragging(false);
          dragCounterRef.current = 0;
        }
      });

      // Store unlisten for cleanup
      if (!cancelled) {
        cleanupRef.current = unlisten;
      } else {
        unlisten();
      }
    };

    const cleanupRef: { current: (() => void) | null } = { current: null };
    setupListener();

    return () => {
      cancelled = true;
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [enabled, docsDir, pageRelativePath]);

  return { isDragging, hasImages };
}
