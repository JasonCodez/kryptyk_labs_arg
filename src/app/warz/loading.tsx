import PageContainer from "@/components/ui/PageContainer";
import WarzLobbyLoadingState from "@/components/warz/WarzLobbyLoadingState";

export default function WarzLoading() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--pw-bg-base)",
        paddingTop: "calc(56px + env(safe-area-inset-top, 0px))",
      }}
    >
      <PageContainer size="catalog" className="py-8">
        <div className="mx-auto w-full max-w-5xl">
          <WarzLobbyLoadingState />
        </div>
      </PageContainer>
    </div>
  );
}
