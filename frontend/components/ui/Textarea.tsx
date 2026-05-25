import { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full resize-none rounded-[18px] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted ${className}`}
      rows={3}
      {...props}
    />
  );
}
