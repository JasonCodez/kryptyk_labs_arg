/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import LeaderboardTabs from "./LeaderboardTabs";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

describe("LeaderboardTabs", () => {
  it("renders Global", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: /Global/ })).toBeTruthy();
  });

  it("renders Weekly", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: /Weekly/ })).toBeTruthy();
  });

  it("renders Monthly", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: /Monthly/ })).toBeTruthy();
  });

  it("renders Following", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: /Following/ })).toBeTruthy();
  });

  it("preserves exact tab order", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    const labels = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(labels).toEqual([
      expect.stringContaining("Global"),
      expect.stringContaining("Weekly"),
      expect.stringContaining("Monthly"),
      expect.stringContaining("Following"),
    ]);
  });

  it("uses a labeled tablist", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(screen.getByRole("tablist", { name: "Leaderboard views" })).toBeTruthy();
  });

  it("uses semantic native tab buttons", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    screen.getAllByRole("tab").forEach((tab) => expect(tab.tagName).toBe("BUTTON"));
  });

  it("active tab has aria-selected=true", () => {
    render(<LeaderboardTabs activeTab="weekly" onChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: /Weekly/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("inactive tabs have aria-selected=false", () => {
    render(<LeaderboardTabs activeTab="weekly" onChange={jest.fn()} />);
    expect(screen.getByRole("tab", { name: /Global/ }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: /Monthly/ }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: /Following/ }).getAttribute("aria-selected")).toBe("false");
  });

  it("clicking another tab invokes onChange exactly once", () => {
    const onChange = jest.fn();
    render(<LeaderboardTabs activeTab="global" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /Weekly/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("weekly");
  });

  it("clicking the active tab invokes no change", () => {
    const onChange = jest.fn();
    render(<LeaderboardTabs activeTab="global" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /Global/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("tab ids and panel controls are correct", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    const weekly = screen.getByRole("tab", { name: /Weekly/ });
    expect(weekly.id).toBe("leaderboard-tab-weekly");
    expect(weekly.getAttribute("aria-controls")).toBe("leaderboard-panel-weekly");
  });

  it("every tab target is at least 44px tall (min-h-11)", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    screen.getAllByRole("tab").forEach((tab) => expect(tab.className).toMatch(/min-h-11/));
  });

  it("icons are hidden from assistive technology", () => {
    const { container } = render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    container.querySelectorAll("svg").forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("labels contain no emoji", () => {
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    screen.getAllByRole("tab").forEach((tab) => expect(NO_EMOJI.test(tab.textContent ?? "")).toBe(false));
  });

  it("contains no raw hex colors", () => {
    const { container } = render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("contains no raw RGBA colors", () => {
    const { container } = render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("supports horizontal overflow within the tab strip", () => {
    const { container } = render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(container.querySelector(".overflow-x-auto")).toBeTruthy();
  });

  it("does not create document-level overflow markup itself", () => {
    const { container } = render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(container.querySelectorAll("body").length).toBe(0);
  });

  it("performs no network request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<LeaderboardTabs activeTab="global" onChange={jest.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });
});
