import { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full rounded-[22px] border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none transition-colors resize-none ${className}`}
      rows={3}
      {...props}
    />
  );
}
