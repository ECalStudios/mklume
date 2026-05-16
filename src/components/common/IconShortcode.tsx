import { resolveIcon } from "../../utils/iconShortcodes";
import { Shapes } from "lucide-react";

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

  // Clean fallback: small generic icon with the shortcode name as tooltip
  return (
    <span className={`icon-sc icon-sc--fallback ${className}`} title={shortcode}>
      <Shapes size={size} strokeWidth={1.5} />
    </span>
  );
}

export default IconShortcode;
