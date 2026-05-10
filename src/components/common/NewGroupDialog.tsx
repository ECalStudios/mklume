import { useState, useEffect } from "react";

interface NewGroupDialogProps {
  onConfirm: (
    folderName: string,
    displayName: string,
    createStarter: boolean,
  ) => void;
  onCancel: () => void;
  error: string;
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function NewGroupDialog({ onConfirm, onCancel, error }: NewGroupDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [editedFolder, setEditedFolder] = useState(false);
  const [createStarter, setCreateStarter] = useState(true);

  useEffect(() => {
    if (!editedFolder) {
      setFolderName(nameToSlug(displayName));
    }
  }, [displayName, editedFolder]);

  const canSubmit = displayName.trim().length > 0 && folderName.trim().length > 0;

  function handleSubmit() {
    if (canSubmit) {
      onConfirm(folderName.trim(), displayName.trim(), createStarter);
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">New Group</h3>
        <p className="dialog-subtitle">
          Create a new documentation section with its own folder.
        </p>

        <div className="dialog-field">
          <label className="dialog-label">Group Name</label>
          <input
            className="dialog-input"
            type="text"
            placeholder="Guides"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Folder Name</label>
          <input
            className="dialog-input mono"
            type="text"
            placeholder="guides"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              setEditedFolder(true);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <span className="dialog-hint">
            Creates docs/{folderName || "..."}/
          </span>
        </div>

        <div className="dialog-checkbox">
          <input
            type="checkbox"
            id="create-starter"
            checked={createStarter}
            onChange={(e) => setCreateStarter(e.target.checked)}
          />
          <label htmlFor="create-starter">
            Create a starter page (index.md)
          </label>
        </div>

        {!createStarter && (
          <span className="dialog-hint" style={{ marginBottom: 8 }}>
            An empty group won't appear in MkDocs navigation until it has pages.
          </span>
        )}

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
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewGroupDialog;
