import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-[#d4d4d4] focus:ring-1 focus:ring-[#d4d4d4] resize-none ${className}`}
      rows={3}
      {...props}
    />
  );
}
