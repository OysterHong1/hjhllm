import Image from "next/image";

type BrandMarkProps = {
  label?: string | null;
  compact?: boolean;
};

export function BrandMark({ label = null, compact = false }: BrandMarkProps) {
  const size = compact ? 32 : 36;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="relative flex flex-shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/oyster-logo.webp"
          alt=""
          fill
          sizes={`${size}px`}
          className="object-contain"
          priority={compact}
        />
      </span>
      {!compact && label && (
        <span className="truncate text-sm font-semibold text-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
