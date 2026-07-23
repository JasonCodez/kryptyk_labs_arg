/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import LeaderboardTabs from "./LeaderboardTabs";
describe("LeaderboardTabs", () => {
  it("is an accessible controlled tab list and ignores the active tab", () => {
    const change = jest.fn();
    render(<LeaderboardTabs activeTab="global" onChange={change} />);
    expect(screen.getByRole("tablist", { name: "Leaderboard views" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Global/ }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    expect(change).toHaveBeenCalledWith("weekly");
  });
});
