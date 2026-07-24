/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { getThemeConfig } from "@/lib/profileThemes";
import TeamDetailActions, { type TeamDetailActionsProps } from "./TeamDetailActions";

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamDetailActions.tsx"), "utf8");
const theme = getThemeConfig("default");

function makeProps(overrides: Partial<TeamDetailActionsProps> = {}): TeamDetailActionsProps {
  return {
    userRole: null,
    isPublic: true,
    isAuthenticated: false,
    inviteStatus: "none",
    themePickerOpen: false,
    theme,
    onToggleThemePicker: jest.fn(),
    onInviteMembers: jest.fn(),
    onLeaveTeam: jest.fn(),
    onApplyToJoin: jest.fn(),
    ...overrides,
  };
}

function getVisibleActionNames() {
  return screen.queryAllByRole("button").map((b) => b.textContent).concat(
    screen.queryAllByRole("link").map((l) => l.textContent)
  );
}

describe("TeamDetailActions — role visibility", () => {
  it("admin action order is Theme, Invite Members, Leave Team", () => {
    render(<TeamDetailActions {...makeProps({ userRole: "admin" })} />);
    const names = getVisibleActionNames();
    expect(names).toEqual([
      expect.stringContaining("Theme"),
      expect.stringContaining("Invite Members"),
      expect.stringContaining("Leave Team"),
    ]);
  });

  it("moderator sees Invite Members and Leave Team, not Theme", () => {
    render(<TeamDetailActions {...makeProps({ userRole: "moderator" })} />);
    expect(screen.queryByRole("button", { name: /^Theme$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Invite Members/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Leave Team/ })).toBeTruthy();
  });

  it("member sees only Leave Team", () => {
    render(<TeamDetailActions {...makeProps({ userRole: "member" })} />);
    const names = getVisibleActionNames();
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Leave Team");
  });

  it("unknown non-empty role sees only Leave Team", () => {
    render(<TeamDetailActions {...makeProps({ userRole: "mascot" })} />);
    const names = getVisibleActionNames();
    expect(names).toHaveLength(1);
    expect(names[0]).toContain("Leave Team");
    expect(screen.queryByRole("button", { name: /^Theme$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Invite Members/ })).toBeNull();
  });

  it("signed-in public non-member sees Apply to Join", () => {
    render(<TeamDetailActions {...makeProps({ userRole: null, isPublic: true, isAuthenticated: true, inviteStatus: "none" })} />);
    expect(screen.getByRole("button", { name: /Apply to Join/ })).toBeTruthy();
  });

  it("pending signed-in public non-member sees disabled Application Submitted", () => {
    render(<TeamDetailActions {...makeProps({ userRole: null, isPublic: true, isAuthenticated: true, inviteStatus: "pending" })} />);
    const btn = screen.getByRole("button", { name: /Application Submitted/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("pending control does not invoke the apply callback", () => {
    const onApplyToJoin = jest.fn();
    render(<TeamDetailActions {...makeProps({ userRole: null, isPublic: true, isAuthenticated: true, inviteStatus: "pending", onApplyToJoin })} />);
    const btn = screen.getByRole("button", { name: /Application Submitted/ });
    fireEvent.click(btn);
    expect(onApplyToJoin).not.toHaveBeenCalled();
  });

  it("anonymous public visitor sees Sign in to Join", () => {
    render(<TeamDetailActions {...makeProps({ userRole: null, isPublic: true, isAuthenticated: false })} />);
    expect(screen.getByRole("link", { name: /Sign in to Join/ })).toBeTruthy();
  });

  it("sign-in link points to /auth/signin", () => {
    render(<TeamDetailActions {...makeProps({ userRole: null, isPublic: true, isAuthenticated: false })} />);
    expect(screen.getByRole("link", { name: /Sign in to Join/ }).getAttribute("href")).toBe("/auth/signin");
  });

  it("non-public non-member sees no join action", () => {
    render(<TeamDetailActions {...makeProps({ userRole: null, isPublic: false, isAuthenticated: true })} />);
    expect(getVisibleActionNames()).toHaveLength(0);
  });
});

describe("TeamDetailActions — callbacks", () => {
  it("Theme button invokes onToggleThemePicker", () => {
    const onToggleThemePicker = jest.fn();
    render(<TeamDetailActions {...makeProps({ userRole: "admin", onToggleThemePicker })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    expect(onToggleThemePicker).toHaveBeenCalledTimes(1);
  });

  it("Invite button invokes onInviteMembers", () => {
    const onInviteMembers = jest.fn();
    render(<TeamDetailActions {...makeProps({ userRole: "admin", onInviteMembers })} />);
    fireEvent.click(screen.getByRole("button", { name: /Invite Members/ }));
    expect(onInviteMembers).toHaveBeenCalledTimes(1);
  });

  it("Leave button invokes onLeaveTeam", () => {
    const onLeaveTeam = jest.fn();
    render(<TeamDetailActions {...makeProps({ userRole: "admin", onLeaveTeam })} />);
    fireEvent.click(screen.getByRole("button", { name: /Leave Team/ }));
    expect(onLeaveTeam).toHaveBeenCalledTimes(1);
  });

  it("Apply button invokes onApplyToJoin", () => {
    const onApplyToJoin = jest.fn();
    render(<TeamDetailActions {...makeProps({ userRole: null, isPublic: true, isAuthenticated: true, inviteStatus: "none", onApplyToJoin })} />);
    fireEvent.click(screen.getByRole("button", { name: /Apply to Join/ }));
    expect(onApplyToJoin).toHaveBeenCalledTimes(1);
  });
});

describe("TeamDetailActions — Theme accessibility", () => {
  it("Theme button exposes correct aria-expanded", () => {
    const { rerender } = render(<TeamDetailActions {...makeProps({ userRole: "admin", themePickerOpen: false })} />);
    expect(screen.getByRole("button", { name: /^Theme$/ }).getAttribute("aria-expanded")).toBe("false");
    rerender(<TeamDetailActions {...makeProps({ userRole: "admin", themePickerOpen: true })} />);
    expect(screen.getByRole("button", { name: /^Theme$/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("Theme button references team-theme-picker", () => {
    render(<TeamDetailActions {...makeProps({ userRole: "admin" })} />);
    expect(screen.getByRole("button", { name: /^Theme$/ }).getAttribute("aria-controls")).toBe("team-theme-picker");
  });
});

describe("TeamDetailActions — structure", () => {
  it("all rendered buttons have type=\"button\"", () => {
    render(<TeamDetailActions {...makeProps({ userRole: "admin" })} />);
    screen.getAllByRole("button").forEach((btn) => {
      expect((btn as HTMLButtonElement).type).toBe("button");
    });
  });

  it("interactive controls retain at least a 44px minimum-height class", () => {
    render(<TeamDetailActions {...makeProps({ userRole: "admin" })} />);
    screen.getAllByRole("button").forEach((btn) => {
      expect(btn.className).toMatch(/min-h-11/);
    });
  });

  it("does not call fetch", () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    render(<TeamDetailActions {...makeProps({ userRole: "admin" })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Theme$/ }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("source contains no direct fetch call", () => {
    expect(SOURCE).not.toMatch(/\bfetch\(/);
  });

  it("data-testid is present on the action deck", () => {
    render(<TeamDetailActions {...makeProps({ userRole: "admin" })} />);
    expect(screen.getByTestId("team-detail-actions")).toBeTruthy();
  });
});
