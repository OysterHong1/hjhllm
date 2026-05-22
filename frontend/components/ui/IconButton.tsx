import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "plain" | "surface" | "dark";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
};

const variantStyles: Record<IconButtonVariant, string> = {
  plain: "text-[#111827] hover:bg-black/5",
  surface:
    "border border-border bg-white text-[#111827] shadow-sm hover:bg-[#f8fafc]",
  dark: "bg-[#111827] text-white shadow-sm hover:bg-[#243244]",
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
      className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
}
