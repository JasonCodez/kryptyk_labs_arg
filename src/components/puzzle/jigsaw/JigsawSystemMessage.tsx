"use client";

function IconSpinner() {
  return (
    <svg
      className="jigsaw-system-message-spinner"
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconImageError() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="9" r="1.4" fill="currentColor" stroke="none" />
      <path d="M2 2l20 20" strokeLinecap="round" />
    </svg>
  );
}

function IconRestore() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <path d="M3 4v4.5H7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4.5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M12 3.5 21.5 20H2.5Z" strokeLinejoin="round" />
      <path d="M12 9.5v4.5" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export type JigsawSystemMessageVariant = "loading" | "image-error" | "restored" | "completion-error";

export type JigsawSystemMessageProps = {
  variant: JigsawSystemMessageVariant;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionPending?: boolean;
};

const ARIA_LABEL: Record<JigsawSystemMessageVariant, string> = {
  loading: "Jigsaw loading status",
  "image-error": "Jigsaw image error",
  restored: "Jigsaw progress restored",
  "completion-error": "Jigsaw completion save error",
};

function VariantIcon({ variant }: { variant: JigsawSystemMessageVariant }) {
  switch (variant) {
    case "loading": return <IconSpinner />;
    case "image-error": return <IconImageError />;
    case "restored": return <IconRestore />;
    case "completion-error": return <IconWarning />;
  }
}

export default function JigsawSystemMessage({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  actionPending = false,
}: JigsawSystemMessageProps) {
  const showAction = Boolean(actionLabel && onAction);
  const isStatusRole = variant === "loading" || variant === "restored";

  const handleAction = () => {
    if (actionPending || !onAction) return;
    onAction();
  };

  return (
    <div
      className="jigsaw-system-message"
      data-variant={variant}
      role={isStatusRole ? "status" : "group"}
      aria-label={ARIA_LABEL[variant]}
    >
      <span className="jigsaw-system-message-icon"><VariantIcon variant={variant} /></span>
      <div className="jigsaw-system-message-copy">
        <p className="jigsaw-system-message-title">{title}</p>
        {message && <p className="jigsaw-system-message-support">{message}</p>}
      </div>
      {showAction && (
        <button
          type="button"
          className="jigsaw-system-message-action"
          onClick={handleAction}
          disabled={actionPending}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
