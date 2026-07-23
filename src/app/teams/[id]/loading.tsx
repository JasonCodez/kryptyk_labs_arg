import PageContainer from "@/components/ui/PageContainer";
import TeamDetailLoadingState from "@/components/teams/TeamDetailLoadingState";

export default function TeamDetailRouteLoading() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
    >
      <PageContainer size="catalog" className="pb-12 pt-6">
        <div className="mx-auto w-full max-w-5xl">
          <TeamDetailLoadingState />
        </div>
      </PageContainer>
    </div>
  );
}
