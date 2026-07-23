import WarzSetupLoadingState from "@/components/warz/WarzSetupLoadingState";

export default function WarzSetupLoading() {
  return (
    <div
      className="flex min-h-screen items-start justify-center px-4 pb-8"
      style={{
        background: "var(--pw-bg-base)",
        paddingTop: "calc(56px + env(safe-area-inset-top, 0px) + 1rem)",
      }}
    >
      <div className="w-full min-w-0 max-w-xl">
        <WarzSetupLoadingState />
      </div>
    </div>
  );
}
