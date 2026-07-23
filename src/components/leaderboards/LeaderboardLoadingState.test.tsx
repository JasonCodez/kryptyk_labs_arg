/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LeaderboardLoadingState from "./LeaderboardLoadingState";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;
const FAKE_NAME_PATTERN = /Anonymous|Player \d|John Doe/i;

describe("LeaderboardLoadingState", () => {
  it("has an accessible loading status", () => {
    render(<LeaderboardLoadingState activeTab="global" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("announces 'Loading leaderboard'", () => {
    render(<LeaderboardLoadingState activeTab="global" />);
    expect(screen.getByRole("status").textContent).toContain("Loading leaderboard");
  });

  it("renders a rank-summary skeleton block", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThan(0);
  });

  it("renders row skeletons", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    const rows = container.querySelectorAll(".border-b, .last\\:border-0");
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it("Weekly renders a period-context skeleton", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="weekly" />);
    expect(container.querySelector(".sm\\:grid-cols-\\[220px_1fr\\]")).toBeTruthy();
  });

  it("Monthly renders a period-context skeleton", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="monthly" />);
    expect(container.querySelector(".sm\\:grid-cols-\\[220px_1fr\\]")).toBeTruthy();
  });

  it("Global does not require a period-context skeleton", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(container.querySelector(".sm\\:grid-cols-\\[220px_1fr\\]")).toBeNull();
  });

  it("Following does not require a period-context skeleton", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="following" />);
    expect(container.querySelector(".sm\\:grid-cols-\\[220px_1fr\\]")).toBeNull();
  });

  it("contains no fake usernames", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(FAKE_NAME_PATTERN.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no fake point values", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(/\d/.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no emoji", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw hex colors", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("contains no raw RGBA colors", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("uses bounded, non-overflowing mobile containers", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(container.querySelector(".overflow-hidden")).toBeTruthy();
  });

  it("performs no network request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<LeaderboardLoadingState activeTab="global" />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });
});
