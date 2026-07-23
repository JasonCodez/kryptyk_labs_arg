/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LeaderboardRankSummary from "./LeaderboardRankSummary";
jest.mock("framer-motion", () => ({ motion: { section: ({ initial: _initial, animate: _animate, transition: _transition, ...props }: any) => <section {...props} /> } }));
jest.mock("@/hooks/useAppReducedMotion", () => ({ useAppReducedMotion: () => true }));
describe("LeaderboardRankSummary", () => {
  it("formats a ranked period result and reward zone", () => {
    render(<LeaderboardRankSummary activeTab="weekly" rank={12} points={1234} puzzlesSolved={7} />);
    expect(screen.getByText("#12")).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("Reward zone")).toBeTruthy();
  });
  it("renders the following onboarding state without invalid rank text", () => {
    render(<LeaderboardRankSummary activeTab="following" rank={null} points={null} puzzlesSolved={null} followingCount={0} />);
    expect(screen.getByText("Follow another player to build your comparison group.")).toBeTruthy();
    expect(screen.queryByText("#0")).toBeNull();
  });
});
