/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LeaderboardHeader from "./LeaderboardHeader";
jest.mock("framer-motion", () => ({ motion: { header: ({ initial: _initial, animate: _animate, transition: _transition, ...props }: any) => <header {...props} /> } }));
jest.mock("@/hooks/useAppReducedMotion", () => ({ useAppReducedMotion: () => true }));
describe("LeaderboardHeader", () => {
  it("renders navigation and tab-specific copy", () => {
    render(<LeaderboardHeader activeTab="weekly" />);
    expect(screen.getByRole("heading", { name: "Leaderboards" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to Dashboard/ }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByText(/Climb this week/)).toBeTruthy();
  });
});
