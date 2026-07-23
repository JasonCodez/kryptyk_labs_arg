/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LeaderboardRankSummary from "./LeaderboardRankSummary";

jest.mock("framer-motion", () => ({
  motion: { section: ({ initial: _initial, animate: _animate, transition: _transition, ...props }: any) => <section {...props} /> },
}));
jest.mock("@/hooks/useAppReducedMotion", () => ({ useAppReducedMotion: () => true }));

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

describe("LeaderboardRankSummary", () => {
  it("Global label", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Your Global Rank")).toBeTruthy();
  });

  it("Weekly label", () => {
    render(<LeaderboardRankSummary activeTab="weekly" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Your Weekly Rank")).toBeTruthy();
  });

  it("Monthly label", () => {
    render(<LeaderboardRankSummary activeTab="monthly" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Your Monthly Rank")).toBeTruthy();
  });

  it("Following label", () => {
    render(<LeaderboardRankSummary activeTab="following" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Your Following Rank")).toBeTruthy();
  });

  it("renders numeric rank", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={42} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("#42")).toBeTruthy();
  });

  it("renders the unranked state", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={null} points={null} puzzlesSolved={null} />);
    expect(screen.getByText("Unranked")).toBeTruthy();
  });

  it("earned-points label for Global", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Earned points")).toBeTruthy();
  });

  it("earned-points label for Following", () => {
    render(<LeaderboardRankSummary activeTab="following" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Earned points")).toBeTruthy();
  });

  it("period-points label for Weekly", () => {
    render(<LeaderboardRankSummary activeTab="weekly" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Period points")).toBeTruthy();
  });

  it("period-points label for Monthly", () => {
    render(<LeaderboardRankSummary activeTab="monthly" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Period points")).toBeTruthy();
  });

  it("formats points with exact toLocaleString formatting", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={1} points={3450} puzzlesSolved={1} />);
    expect(screen.getByText("3,450")).toBeTruthy();
  });

  it("formats puzzles-solved exactly", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1234} />);
    expect(screen.getByText("1,234 puzzles solved")).toBeTruthy();
  });

  it("rank 50 shows Reward zone on Weekly", () => {
    render(<LeaderboardRankSummary activeTab="weekly" rank={50} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Reward zone")).toBeTruthy();
  });

  it("rank 51 does not show Reward zone", () => {
    render(<LeaderboardRankSummary activeTab="weekly" rank={51} points={10} puzzlesSolved={1} />);
    expect(screen.queryByText("Reward zone")).toBeNull();
  });

  it("Global never shows Reward zone", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.queryByText("Reward zone")).toBeNull();
  });

  it("Following never shows Reward zone", () => {
    render(<LeaderboardRankSummary activeTab="following" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.queryByText("Reward zone")).toBeNull();
  });

  it("null rank never shows Reward zone", () => {
    render(<LeaderboardRankSummary activeTab="weekly" rank={null} points={null} puzzlesSolved={null} />);
    expect(screen.queryByText("Reward zone")).toBeNull();
  });

  it("Following count singular grammar", () => {
    render(<LeaderboardRankSummary activeTab="following" rank={1} points={10} puzzlesSolved={1} followingCount={1} />);
    expect(screen.getByText("Following 1 player")).toBeTruthy();
  });

  it("Following count plural grammar", () => {
    render(<LeaderboardRankSummary activeTab="following" rank={1} points={10} puzzlesSolved={1} followingCount={4} />);
    expect(screen.getByText("Following 4 players")).toBeTruthy();
  });

  it("Following count is rendered exactly as passed, not derived", () => {
    render(<LeaderboardRankSummary activeTab="following" rank={1} points={10} puzzlesSolved={1} followingCount={9999} />);
    expect(screen.getByText("Following 9,999 players")).toBeTruthy();
  });

  it("never renders #0", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={0} points={0} puzzlesSolved={0} />);
    expect(screen.queryByText("#0")).toBeNull();
  });

  it("never renders NaN", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={NaN} points={NaN} puzzlesSolved={NaN} />);
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("never renders undefined", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={undefined as unknown as null} points={undefined as unknown as null} puzzlesSolved={undefined as unknown as null} />);
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it("never shows a spendable balance", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.queryByText(/balance/i)).toBeNull();
  });

  it("never shows XP", () => {
    render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.queryByText(/XP/)).toBeNull();
  });

  it("never shows a next-rank gap", () => {
    const { container } = render(<LeaderboardRankSummary activeTab="global" rank={5} points={10} puzzlesSolved={1} />);
    expect(container.textContent).not.toMatch(/next rank/i);
  });

  it("uses visible reward-zone text, not color alone", () => {
    render(<LeaderboardRankSummary activeTab="weekly" rank={1} points={10} puzzlesSolved={1} />);
    expect(screen.getByText("Reward zone").textContent).toBe("Reward zone");
  });

  it("reward icon is decorative", () => {
    const { container } = render(<LeaderboardRankSummary activeTab="weekly" rank={1} points={10} puzzlesSolved={1} />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("contains no emoji", () => {
    const { container } = render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1} />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw hex or RGBA colors", () => {
    const { container } = render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1} />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("performs no network request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<LeaderboardRankSummary activeTab="global" rank={1} points={10} puzzlesSolved={1} />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });
});
