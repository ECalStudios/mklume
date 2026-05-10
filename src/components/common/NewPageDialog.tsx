import { useState, useEffect } from "react";

interface NewPageDialogProps {
  folders: string[];
  hasNav: boolean;
  onConfirm: (title: string, filename: string, folder: string, addToNav: boolean) => void;
  onCancel: () => void;
  error: string;
}

function titleToFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return slug ? slug + ".md" : "";
}

function NewPageDialog({
  folders,
  hasNav,
  onConfirm,
  onCancel,
  error,
}: NewPageDialogProps) {
  const [title, setTitle] = useState("");
  const [filename, setFilename] = useState("");
  const [folder, setFolder] = useState("");
  const [editedFilename, setEditedFilename] = useState(false);
  const [addToNav, setAddToNav] = useState(true);

  useEffect(() => {
    if (!editedFilename) {
      setFilename(titleToFilename(title));
    }
  }, [title, editedFilename]);

  const canSubmit = title.trim().length > 0 && filename.length > 3;

  function handleSubmit() {
    if (canSubmit) {
      onConfirm(title.trim(), filename, folder, addToNav);
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box dialog-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">New Page</h3>

        <div className="dialog-field">
          <label className="dialog-label">Page Title</label>
          <input
            className="dialog-input"
            type="text"
            placeholder="Getting Started"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Filename</label>
          <input
            className="dialog-input mono"
            type="text"
            placeholder="getting-started.md"
            value={filename}
            onChange={(e) => {
              setFilename(e.target.value);
              setEditedFilename(true);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <span className="dialog-hint">
            Auto-generated from title. Edit to customise.
          </span>
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Folder</label>
          <select
            className="dialog-select"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          >
            <option value="">Project Root (docs/)</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}/
              </option>
            ))}
          </select>
        </div>

        <label className="dialog-checkbox">
          <input
            type="checkbox"
            checked={addToNav}
            onChange={(e) => setAddToNav(e.target.checked)}
          />
          <span className="dialog-label" style={{ marginBottom: 0 }}>
            Add to navigation {hasNav ? "" : "(creates nav section in mkdocs.yml)"}
          </span>
        </label>

        {error && <p className="dialog-error-text">{error}</p>}

        <div className="dialog-actions">
          <button className="dialog-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="dialog-btn primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Create Page
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewPageDialog;
