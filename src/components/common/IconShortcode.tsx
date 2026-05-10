import { resolveIcon } from "../../utils/iconShortcodes";
import { CircleDot } from "lucide-react";

interface IconShortcodeProps {
  shortcode: string;
  size?: number;
  className?: string;
}

function IconShortcode({ shortcode, size = 16, className = "" }: IconShortcodeProps) {
  const Icon = resolveIcon(shortcode);
  const label = shortcode.replace(/^:/, "").replace(/:$/, "");

  if (Icon) {
    return (
      <span className={`icon-sc ${className}`} title={label}>
        <Icon size={size} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span className={`icon-sc icon-sc--fallback ${className}`} title={label}>
      <CircleDot size={size} strokeWidth={1.5} />
    </span>
  );
}

export default IconShortcode;
