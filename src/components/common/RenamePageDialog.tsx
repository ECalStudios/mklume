import { useState } from "react";
import type { PageEntry } from "../../types/project";

interface RenamePageDialogProps {
  page: PageEntry;
  onConfirm: (newName: string, updateHeading: boolean) => void;
  onCancel: () => void;
  error: string;
}

function RenamePageDialog({
  page,
  onConfirm,
  onCancel,
  error,
}: RenamePageDialogProps) {
  const [name, setName] = useState(page.title);
  const [updateHeading, setUpdateHeading] = useState(true);

  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    if (canSubmit) {
      onConfirm(name.trim(), updateHeading);
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box dialog-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">Rename Page</h3>

        <div className="dialog-field">
          <label className="dialog-label">New Name</label>
          <input
            className="dialog-input"
            type="text"
            placeholder="Page name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
          <span className="dialog-hint">
            The file will be renamed to match.
          </span>
        </div>

        <label className="dialog-checkbox">
          <input
            type="checkbox"
            checked={updateHeading}
            onChange={(e) => setUpdateHeading(e.target.checked)}
          />
          <span className="dialog-label" style={{ marginBottom: 0 }}>
            Also update the heading inside the file
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
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

export default RenamePageDialog;
