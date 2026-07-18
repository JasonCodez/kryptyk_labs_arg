import Image from "next/image";

interface LoadingSpinnerProps {
  label?: string;
  size?: number;
}

export default function LoadingSpinner({ label, size = 72 }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "var(--pw-bg-base)" }}>
      <Image
        src="/images/puzzle_warz_logo.png"
        alt="Loading…"
        width={size}
        height={size}
        className="pw-logo-spin"
        style={{ objectFit: "contain", animation: "pw-logo-spin 1.4s ease-in-out infinite" }}
      />
      {label && (
        <p className="text-sm font-semibold" style={{ color: "var(--pw-brand-primary)" }}>{label}</p>
      )}
    </div>
  );
}
