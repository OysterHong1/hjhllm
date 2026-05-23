import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "plain" | "surface" | "dark";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
};

const variantStyles: Record<IconButtonVariant, string> = {
  plain: "text-foreground hover:bg-[#e9e9e5]",
  surface:
    "border border-border bg-white text-foreground shadow-sm hover:bg-[#f1f1ee]",
  dark: "bg-[#111111] text-white shadow-sm hover:bg-[#262626]",
};

export function IconButton({
  icon,
  label,
  variant = "plain",
  className = "",
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 flex-shrink-0 touch-none items-center justify-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
}
