import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-[#d4d4d4] focus:ring-1 focus:ring-[#d4d4d4] ${className}`}
      {...props}
    />
  );
}
