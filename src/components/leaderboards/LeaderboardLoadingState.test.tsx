/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LeaderboardLoadingState from "./LeaderboardLoadingState";
describe("LeaderboardLoadingState", () => {
  it("announces loading without fabricated player data", () => {
    render(<LeaderboardLoadingState activeTab="monthly" />);
    expect(screen.getByRole("status").textContent).toContain("Loading leaderboard");
  });
});
