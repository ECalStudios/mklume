import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface NewProjectDialogProps {
  onConfirm: (
    parentDir: string,
    folderName: string,
    siteName: string,
    siteDescription: string,
    mklumeCredit: boolean,
  ) => void;
  onCancel: () => void;
  error: string;
}

function nameToFolder(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function NewProjectDialog({ onConfirm, onCancel, error }: NewProjectDialogProps) {
  const [siteName, setSiteName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [editedFolder, setEditedFolder] = useState(false);
  const [description, setDescription] = useState("");
  const [parentDir, setParentDir] = useState("");
  const [mklumeCredit, setMklumeCredit] = useState(false);

  useEffect(() => {
    if (!editedFolder) {
      setFolderName(nameToFolder(siteName));
    }
  }, [siteName, editedFolder]);

  async function pickLocation() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose where to create the project",
    });
    if (selected) {
      setParentDir(selected as string);
    }
  }

  const canSubmit =
    siteName.trim().length > 0 &&
    folderName.trim().length > 0 &&
    parentDir.length > 0;

  function handleSubmit() {
    if (canSubmit) {
      onConfirm(parentDir, folderName.trim(), siteName.trim(), description.trim(), mklumeCredit);
    }
  }

  function shortenPath(p: string): string {
    const norm = p.replace(/\\/g, "/");
    const parts = norm.split("/");
    if (parts.length <= 3) return norm;
    return `…/${parts.slice(-2).join("/")}`;
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box dialog-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">New Project</h3>
        <p className="dialog-subtitle">
          Create a fresh MkDocs Material documentation site.
        </p>

        <div className="dialog-field">
          <label className="dialog-label">Project Name</label>
          <input
            className="dialog-input"
            type="text"
            placeholder="My Documentation"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Folder Name</label>
          <input
            className="dialog-input mono"
            type="text"
            placeholder="my-documentation"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              setEditedFolder(true);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <span className="dialog-hint">
            A folder with this name will be created in the chosen location.
          </span>
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Location</label>
          <div className="dialog-location-row">
            <span className="dialog-location-path">
              {parentDir ? shortenPath(parentDir) : "No location selected"}
            </span>
            <button className="dialog-location-btn" onClick={pickLocation}>
              Browse
            </button>
          </div>
          {parentDir && folderName && (
            <span className="dialog-hint">
              Project will be created at: {shortenPath(parentDir)}/{folderName}
            </span>
          )}
        </div>

        <div className="dialog-field">
          <label className="dialog-label">
            Description <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
          </label>
          <input
            className="dialog-input"
            type="text"
            placeholder="A short description of your project"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <label className="dialog-checkbox-row">
          <input
            type="checkbox"
            checked={mklumeCredit}
            onChange={(e) => setMklumeCredit(e.target.checked)}
          />
          <span className="dialog-checkbox-label">
            Add "Built with MkLume" footer credit
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
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewProjectDialog;
