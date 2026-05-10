import { useState, useRef, useEffect } from "react";
import { ICON_PRESETS } from "../../utils/iconShortcodes";

interface IconPickerProps {
  onSelect: (shortcode: string) => void;
  onClose: () => void;
}

function IconPicker({ onSelect, onClose }: IconPickerProps) {
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const lowerFilter = filter.toLowerCase();
  const filtered = ICON_PRESETS.filter(
    (p) =>
      p.label.toLowerCase().includes(lowerFilter) ||
      p.shortcode.toLowerCase().includes(lowerFilter),
  );

  return (
    <div className="icon-picker" ref={ref}>
      <input
        ref={inputRef}
        className="icon-picker-search"
        placeholder="Search icons..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="icon-picker-grid">
        {filtered.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.shortcode}
              className="icon-picker-item"
              onClick={() => onSelect(preset.shortcode)}
              title={preset.shortcode}
            >
              <span className="icon-picker-icon">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <span className="icon-picker-label">{preset.label}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="icon-picker-empty">No matching icons.</div>
        )}
      </div>
      <div className="icon-picker-footer">
        <span className="icon-picker-hint">
          Or type a custom shortcode like :material-name:
        </span>
      </div>
    </div>
  );
}

export default IconPicker;
