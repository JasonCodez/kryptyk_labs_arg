/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { getThemeConfig } from "@/lib/profileThemes";
import TeamApplicationsPanel, {
  normalizeTeamApplications,
  getApplicationDisplayName,
  formatApplicationDate,
  type TeamApplication,
  type TeamApplicationsPanelProps,
} from "./TeamApplicationsPanel";

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamApplicationsPanel.tsx"), "utf8");
const theme = getThemeConfig("default");

function makeApplication(overrides: Partial<TeamApplication> = {}): TeamApplication {
  return {
    id: "app-1",
    createdAt: "2026-01-14T12:00:00.000Z",
    user: { id: "u1", name: "Jane Applicant", email: "jane@example.test", image: null },
    ...overrides,
  };
}

function makeProps(overrides: Partial<TeamApplicationsPanelProps> = {}): TeamApplicationsPanelProps {
  return {
    applications: [],
    loadStatus: "ready",
    pendingAction: null,
    theme,
    onApprove: jest.fn(),
    onDeny: jest.fn(),
    onRetry: jest.fn(),
    ...overrides,
  };
}

describe("normalizeTeamApplications", () => {
  it("non-array payload returns []", () => {
    expect(normalizeTeamApplications(null)).toEqual([]);
    expect(normalizeTeamApplications({})).toEqual([]);
    expect(normalizeTeamApplications("x")).toEqual([]);
  });

  it("non-object entries are ignored", () => {
    expect(normalizeTeamApplications([1, "x", null, undefined, true])).toEqual([]);
  });

  it("missing IDs are ignored", () => {
    expect(normalizeTeamApplications([{ createdAt: null, user: null }])).toEqual([]);
  });

  it("empty IDs are ignored", () => {
    expect(normalizeTeamApplications([{ id: "", createdAt: null, user: null }])).toEqual([]);
  });

  it("whitespace-only IDs are ignored", () => {
    expect(normalizeTeamApplications([{ id: "   ", createdAt: null, user: null }])).toEqual([]);
  });

  it("valid API order is preserved", () => {
    const input = [
      { id: "a", createdAt: null, user: null },
      { id: "b", createdAt: null, user: null },
      { id: "c", createdAt: null, user: null },
    ];
    expect(normalizeTeamApplications(input).map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("no sorting occurs (reverse-chronological input stays as supplied)", () => {
    const input = [
      { id: "newer", createdAt: "2026-02-01T00:00:00.000Z", user: null },
      { id: "older", createdAt: "2026-01-01T00:00:00.000Z", user: null },
    ];
    expect(normalizeTeamApplications(input).map((a) => a.id)).toEqual(["newer", "older"]);
  });

  it("input array is not mutated", () => {
    const input = [{ id: "a", createdAt: null, user: null }];
    const snapshot = JSON.parse(JSON.stringify(input));
    normalizeTeamApplications(input);
    expect(input).toEqual(snapshot);
  });

  it("input objects are not mutated", () => {
    const entry = { id: "a", createdAt: null, user: { id: "u", name: "  Bob  ", email: null, image: null } };
    const input = [entry];
    normalizeTeamApplications(input);
    expect(entry.user!.name).toBe("  Bob  ");
  });

  it("malformed user becomes null", () => {
    expect(normalizeTeamApplications([{ id: "a", createdAt: null, user: "not-an-object" }])[0]!.user).toBeNull();
    expect(normalizeTeamApplications([{ id: "a", createdAt: null, user: 5 }])[0]!.user).toBeNull();
    expect(normalizeTeamApplications([{ id: "a", createdAt: null }])[0]!.user).toBeNull();
  });

  it("valid user fields normalize correctly", () => {
    const result = normalizeTeamApplications([
      { id: "a", createdAt: null, user: { id: "u1", name: "  Jane  ", email: " jane@test.test ", image: " http://x/y.png " } },
    ])[0]!;
    expect(result.user).toEqual({ id: "u1", name: "Jane", email: "jane@test.test", image: "http://x/y.png" });
  });

  it("empty user display strings normalize to null", () => {
    const result = normalizeTeamApplications([
      { id: "a", createdAt: null, user: { id: "u1", name: "   ", email: "", image: "" } },
    ])[0]!;
    expect(result.user).toEqual({ id: "u1", name: null, email: null, image: null });
  });

  it("malformed date becomes null", () => {
    expect(normalizeTeamApplications([{ id: "a", createdAt: "not-a-date", user: null }])[0]!.createdAt).toBeNull();
    expect(normalizeTeamApplications([{ id: "a", createdAt: 12345, user: null }])[0]!.createdAt).toBeNull();
    expect(normalizeTeamApplications([{ id: "a", user: null }])[0]!.createdAt).toBeNull();
  });

  it("mixed valid and invalid rows retain valid rows in order", () => {
    const input = [
      { id: "first", createdAt: "2026-01-01T00:00:00.000Z", user: null },
      null,
      "invalid",
      { noId: true },
      { id: "second", createdAt: "not-a-date", user: { id: "u2" } },
    ];
    const result = normalizeTeamApplications(input);
    expect(result.map((a) => a.id)).toEqual(["first", "second"]);
    expect(result[1]!.createdAt).toBeNull();
  });
});

describe("getApplicationDisplayName", () => {
  it("name is preferred over email", () => {
    expect(getApplicationDisplayName(makeApplication({ user: { id: "u", name: "Jane", email: "jane@test.test", image: null } }))).toBe("Jane");
  });

  it("email is used when name is absent", () => {
    expect(getApplicationDisplayName(makeApplication({ user: { id: "u", name: null, email: "jane@test.test", image: null } }))).toBe("jane@test.test");
  });

  it("Applicant is used when both are absent", () => {
    expect(getApplicationDisplayName(makeApplication({ user: { id: "u", name: null, email: null, image: null } }))).toBe("Applicant");
    expect(getApplicationDisplayName(makeApplication({ user: null }))).toBe("Applicant");
  });
});

describe("formatApplicationDate", () => {
  it("valid date formats safely", () => {
    expect(formatApplicationDate("2026-01-14T12:00:00.000Z")).not.toBe("Date unavailable");
    expect(formatApplicationDate("2026-01-14T12:00:00.000Z")).not.toMatch(/Invalid/);
  });

  it("invalid date returns Date unavailable", () => {
    expect(formatApplicationDate("not-a-date")).toBe("Date unavailable");
  });

  it("null date returns Date unavailable", () => {
    expect(formatApplicationDate(null)).toBe("Date unavailable");
  });
});

describe("TeamApplicationsPanel — panel states", () => {
  it("heading is always present", () => {
    render(<TeamApplicationsPanel {...makeProps({ loadStatus: "loading" })} />);
    expect(screen.getByText("Pending Applications")).toBeTruthy();
  });

  it("loading state exposes one semantic status", () => {
    render(<TeamApplicationsPanel {...makeProps({ loadStatus: "loading" })} />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("loading state contains no spinner", () => {
    const { container } = render(<TeamApplicationsPanel {...makeProps({ loadStatus: "loading" })} />);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("empty state preserves 'No pending applications.'", () => {
    render(<TeamApplicationsPanel {...makeProps({ loadStatus: "ready", applications: [] })} />);
    expect(screen.getByText("No pending applications.")).toBeTruthy();
  });

  it("error state preserves 'Applications couldn’t be loaded.'", () => {
    render(<TeamApplicationsPanel {...makeProps({ loadStatus: "error" })} />);
    expect(screen.getByText("Applications couldn’t be loaded.")).toBeTruthy();
  });

  it("retry invokes onRetry", () => {
    const onRetry = jest.fn();
    render(<TeamApplicationsPanel {...makeProps({ loadStatus: "error", onRetry })} />);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("retry button uses type=\"button\"", () => {
    render(<TeamApplicationsPanel {...makeProps({ loadStatus: "error" })} />);
    expect((screen.getByRole("button", { name: "Try Again" }) as HTMLButtonElement).type).toBe("button");
  });

  it("retry control retains a 44px minimum target", () => {
    render(<TeamApplicationsPanel {...makeProps({ loadStatus: "error" })} />);
    expect(screen.getByRole("button", { name: "Try Again" }).className).toMatch(/min-h-11/);
  });
});

describe("TeamApplicationsPanel — populated behavior", () => {
  it("applications render in supplied order", () => {
    const apps = [makeApplication({ id: "first" }), makeApplication({ id: "second", user: { id: "u2", name: "Bob", email: null, image: null } })];
    render(<TeamApplicationsPanel {...makeProps({ applications: apps })} />);
    const rows = screen.getAllByText(/Jane Applicant|Bob/);
    expect(rows.map((r) => r.textContent)).toEqual(["Jane Applicant", "Bob"]);
  });

  it("long applicant names remain present", () => {
    const longName = "Longname Featherstonehaugh-Wallingford-Smythe";
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ user: { id: "u", name: longName, email: null, image: null } })] })} />);
    expect(screen.getByText(longName)).toBeTruthy();
  });

  it("missing user renders Applicant", () => {
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ user: null })] })} />);
    expect(screen.getByText("Applicant")).toBeTruthy();
  });

  it("missing image renders a non-emoji fallback", () => {
    const { container } = render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ user: { id: "u", name: "Jane", email: null, image: null } })] })} />);
    expect(container.querySelector("img")).toBeNull();
    const bodyText = container.textContent ?? "";
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(bodyText)).toBe(false);
  });

  it("approve invokes the correct application ID", () => {
    const onApprove = jest.fn();
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-42" })], onApprove })} />);
    fireEvent.click(screen.getByTestId("team-application-approve-app-42"));
    expect(onApprove).toHaveBeenCalledWith("app-42");
  });

  it("deny invokes the correct application ID", () => {
    const onDeny = jest.fn();
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-42" })], onDeny })} />);
    fireEvent.click(screen.getByTestId("team-application-deny-app-42"));
    expect(onDeny).toHaveBeenCalledWith("app-42");
  });

  it("approve appears before deny", () => {
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-1" })] })} />);
    const row = screen.getByTestId("team-application-row-app-1");
    const buttons = within(row).getAllByRole("button");
    expect(buttons[0]!.textContent).toContain("Approve");
    expect(buttons[1]!.textContent).toContain("Deny");
  });

  it("buttons use type=\"button\"", () => {
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-1" })] })} />);
    const row = screen.getByTestId("team-application-row-app-1");
    within(row).getAllByRole("button").forEach((btn) => {
      expect((btn as HTMLButtonElement).type).toBe("button");
    });
  });

  it("action controls retain 44px minimum targets", () => {
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-1" })] })} />);
    const row = screen.getByTestId("team-application-row-app-1");
    within(row).getAllByRole("button").forEach((btn) => {
      expect(btn.className).toMatch(/min-h-11/);
    });
  });

  it("stable row and action test IDs are present", () => {
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-99" })] })} />);
    expect(screen.getByTestId("team-application-row-app-99")).toBeTruthy();
    expect(screen.getByTestId("team-application-approve-app-99")).toBeTruthy();
    expect(screen.getByTestId("team-application-deny-app-99")).toBeTruthy();
  });
});

describe("TeamApplicationsPanel — pending behavior", () => {
  it("panel exposes aria-busy=\"true\" while pending", () => {
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-1" })], pendingAction: { applicationId: "app-1", action: "approve" } })} />);
    expect(screen.getByTestId("team-applications-panel").getAttribute("aria-busy")).toBe("true");
  });

  it("active approve label becomes Approving…", () => {
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-1" })], pendingAction: { applicationId: "app-1", action: "approve" } })} />);
    expect(screen.getByTestId("team-application-approve-app-1").textContent).toContain("Approving…");
  });

  it("active deny label becomes Denying…", () => {
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-1" })], pendingAction: { applicationId: "app-1", action: "deny" } })} />);
    expect(screen.getByTestId("team-application-deny-app-1").textContent).toContain("Denying…");
  });

  it("all action controls are disabled while one request is pending", () => {
    const apps = [makeApplication({ id: "app-1" }), makeApplication({ id: "app-2", user: { id: "u2", name: "Bob", email: null, image: null } })];
    render(<TeamApplicationsPanel {...makeProps({ applications: apps, pendingAction: { applicationId: "app-1", action: "approve" } })} />);
    expect((screen.getByTestId("team-application-approve-app-1") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("team-application-deny-app-1") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("team-application-approve-app-2") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("team-application-deny-app-2") as HTMLButtonElement).disabled).toBe(true);
  });

  it("disabled controls do not invoke callbacks", () => {
    const onApprove = jest.fn();
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-1" })], pendingAction: { applicationId: "app-1", action: "deny" }, onApprove })} />);
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("pending state preserves application order", () => {
    const apps = [makeApplication({ id: "app-1" }), makeApplication({ id: "app-2", user: { id: "u2", name: "Bob", email: null, image: null } })];
    render(<TeamApplicationsPanel {...makeProps({ applications: apps, pendingAction: { applicationId: "app-1", action: "approve" } })} />);
    const names = screen.getAllByText(/Jane Applicant|Bob/).map((el) => el.textContent);
    expect(names).toEqual(["Jane Applicant", "Bob"]);
  });
});

describe("TeamApplicationsPanel — purity", () => {
  it("does not call fetch", () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    render(<TeamApplicationsPanel {...makeProps({ applications: [makeApplication({ id: "app-1" })] })} />);
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("source contains no direct fetch(", () => {
    expect(SOURCE).not.toMatch(/\bfetch\(/);
  });

  it("source contains no .sort(", () => {
    expect(SOURCE).not.toMatch(/\.sort\(/);
  });

  it("supplied applications are not mutated during render or interaction", () => {
    const apps = [makeApplication({ id: "app-1" })];
    const snapshot = JSON.parse(JSON.stringify(apps));
    render(<TeamApplicationsPanel {...makeProps({ applications: apps })} />);
    fireEvent.click(screen.getByTestId("team-application-approve-app-1"));
    expect(apps).toEqual(snapshot);
  });
});
