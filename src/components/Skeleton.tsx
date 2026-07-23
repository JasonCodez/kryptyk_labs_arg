type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = "", style, ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      data-skeleton="true"
      aria-hidden="true"
      className={`motion-safe:animate-pulse motion-reduce:animate-none rounded ${className}`}
      style={{ background: "var(--pw-surface-2)", ...style }}
    />
  );
}

export function PuzzlePageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      {/* Title */}
      <Skeleton className="h-8 w-2/3" />
      {/* Subtitle */}
      <Skeleton className="h-4 w-1/3" />
      {/* Body area */}
      <Skeleton className="h-48 w-full rounded-2xl" style={{ animationDelay: "80ms" }} />
      {/* Input row */}
      <div className="flex gap-3">
        <Skeleton className="h-12 flex-1 rounded-xl" style={{ animationDelay: "120ms" }} />
        <Skeleton className="h-12 w-24 rounded-xl" style={{ animationDelay: "160ms" }} />
      </div>
    </div>
  );
}
