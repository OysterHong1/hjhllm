type BrandMarkProps = {
  label?: string | null;
  compact?: boolean;
};

export function BrandMark({ label = null, compact = false }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img
        src="/brand/oyster-logo.webp"
        alt=""
        className={`${compact ? "h-8 w-8" : "h-9 w-9"} rounded-full object-cover`}
      />
      {!compact && label && (
        <span className="truncate text-sm font-semibold text-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
