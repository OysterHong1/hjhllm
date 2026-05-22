import Image from "next/image";

type BrandMarkProps = {
  label?: string | null;
  compact?: boolean;
};

export function BrandMark({ label = null, compact = false }: BrandMarkProps) {
  const size = compact ? 32 : 36;
  const innerSize = compact ? 24 : 27;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="flex flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5"
        style={{ width: size, height: size }}
      >
        <span className="relative block" style={{ width: innerSize, height: innerSize }}>
          <Image
            src="/brand/oyster-logo.webp"
            alt=""
            fill
            sizes={`${innerSize}px`}
            className="object-contain"
            priority={compact}
          />
        </span>
      </span>
      {!compact && label && (
        <span className="truncate text-sm font-semibold text-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
