/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import DashboardFeaturedMission from "./DashboardFeaturedMission";

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const LEGACY_COLOR_STRINGS = [
  "139,61,255",
  "139, 61, 255",
  "8B3DFF",
  "255,79,163",
  "255, 79, 163",
  "FF4FA3",
  "purple",
  "magenta",
  "pink",
];

function mockFetchPending() {
  global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
}

function mockFetchResolves(data: unknown, ok = true) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response),
  ) as jest.Mock;
}

function mockFetchFails() {
  global.fetch = jest.fn(() => Promise.reject(new Error("network error"))) as jest.Mock;
}

async function renderCard() {
  const utils = render(<DashboardFeaturedMission />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return utils;
}

describe("DashboardFeaturedMission", () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("renders a link to /debrief", async () => {
    mockFetchPending();
    render(<DashboardFeaturedMission />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/debrief");
  });

  it("renders The Debrief heading", async () => {
    mockFetchPending();
    render(<DashboardFeaturedMission />);
    expect(screen.getByRole("heading", { level: 2, name: "The Debrief" })).toBeTruthy();
  });

  it("renders the specified body copy", async () => {
    mockFetchPending();
    render(<DashboardFeaturedMission />);
    expect(
      screen.getByText("Memorize the incident report before it disappears, then answer five recall questions."),
    ).toBeTruthy();
  });

  it("renders the generic card while loading", async () => {
    mockFetchPending();
    render(<DashboardFeaturedMission />);
    expect(screen.getByText("Featured Mission")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "The Debrief" })).toBeTruthy();
  });

  it("does not show Live Today on the generic loading card", async () => {
    mockFetchPending();
    render(<DashboardFeaturedMission />);
    expect(screen.queryByText("Live Today")).toBeNull();
  });

  it("shows Live Today after a successful incomplete response", async () => {
    mockFetchResolves({ caseNumber: 1, classification: "classified", stats: { totalPlays: 0 }, completed: false });
    await renderCard();
    expect(screen.getByText("Live Today")).toBeTruthy();
  });

  it("formats CASE #0001 from a successful response", async () => {
    mockFetchResolves({ caseNumber: 1, classification: "classified", stats: { totalPlays: 0 }, completed: false });
    await renderCard();
    expect(screen.getByText((_, node) => node?.textContent === "CASE #0001 • CLASSIFIED")).toBeTruthy();
  });

  it("shows the classification from a successful response", async () => {
    mockFetchResolves({ caseNumber: 7, classification: "restricted", stats: { totalPlays: 0 }, completed: false });
    await renderCard();
    expect(screen.getByText((_, node) => node?.textContent === "CASE #0007 • RESTRICTED")).toBeTruthy();
  });

  it("formats investigator totals with separators", async () => {
    mockFetchResolves({ caseNumber: 3, classification: "classified", stats: { totalPlays: 12345 }, completed: false });
    await renderCard();
    expect(screen.getByText("12,345 investigators")).toBeTruthy();
  });

  it("omits investigator count when totalPlays is zero", async () => {
    mockFetchResolves({ caseNumber: 3, classification: "classified", stats: { totalPlays: 0 }, completed: false });
    await renderCard();
    expect(screen.queryByText(/investigators/)).toBeNull();
  });

  it("hides the card entirely for a completed response", async () => {
    mockFetchResolves({ caseNumber: 3, classification: "classified", stats: { totalPlays: 10 }, completed: true });
    await renderCard();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps the generic card visible when the request fails", async () => {
    mockFetchFails();
    await renderCard();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/debrief");
    expect(screen.getByRole("heading", { level: 2, name: "The Debrief" })).toBeTruthy();
    expect(screen.queryByText("Live Today")).toBeNull();
  });

  it("hides its SVG icon from assistive technology", async () => {
    mockFetchPending();
    const { container } = render(<DashboardFeaturedMission />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
  });

  it("contains no emoji glyphs", async () => {
    mockFetchResolves({ caseNumber: 1, classification: "classified", stats: { totalPlays: 500 }, completed: false });
    const { container } = await renderCard();
    expect(EMOJI_PATTERN.test(container.textContent || "")).toBe(false);
  });

  it("contains no legacy purple, magenta, or pink color strings", async () => {
    mockFetchResolves({ caseNumber: 1, classification: "classified", stats: { totalPlays: 500 }, completed: false });
    const { container } = await renderCard();
    const html = container.innerHTML.toLowerCase();
    for (const value of LEGACY_COLOR_STRINGS) {
      expect(html).not.toContain(value.toLowerCase());
    }
  });

  it("renders without animation classes or inline animation styles", async () => {
    mockFetchResolves({ caseNumber: 1, classification: "classified", stats: { totalPlays: 500 }, completed: false });
    const { container } = await renderCard();
    expect(container.innerHTML).not.toMatch(/animation:/);
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
  });

  it("contains exactly one link and no buttons", async () => {
    mockFetchResolves({ caseNumber: 1, classification: "classified", stats: { totalPlays: 500 }, completed: false });
    await renderCard();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
