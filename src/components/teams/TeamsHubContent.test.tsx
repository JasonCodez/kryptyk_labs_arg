/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import TeamsHubContent, {
  filterTeamsForView,
  getTeamsHubDescription,
  getTeamsHubDisplayName,
  normalizeTeamsPayload,
  type TeamsHubContentProps,
  type TeamsHubTeam,
} from "./TeamsHubContent";

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamsHubContent.tsx"), "utf8");

function makeTeam(overrides: Partial<TeamsHubTeam> = {}): TeamsHubTeam {
  return {
    id: "team-1",
    name: "Midnight Puzzle Society",
    description: "We solve puzzles together.",
    isPublic: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    members: [{ user: { id: "me", name: "Me", image: null }, role: "admin" }],
    ...overrides,
  };
}

function makeProps(overrides: Partial<TeamsHubContentProps> = {}): TeamsHubContentProps {
  return {
    isAuthenticated: true,
    sessionUserId: "me",
    viewMode: "mine",
    onChangeViewMode: jest.fn(),
    loadStatus: "ready",
    teams: [makeTeam()],
    retrying: false,
    onRetry: jest.fn(),
    invitationCount: 0,
    onOpenInvitations: jest.fn(),
    onOpenCreateTeam: jest.fn(),
    ...overrides,
  };
}

describe("normalizeTeamsPayload", () => {
  it("1. non-array payload returns null", () => {
    expect(normalizeTeamsPayload({})).toBeNull();
    expect(normalizeTeamsPayload(null)).toBeNull();
    expect(normalizeTeamsPayload("nope")).toBeNull();
  });

  it("2. empty array returns []", () => {
    expect(normalizeTeamsPayload([])).toEqual([]);
  });

  it("3. valid rows normalize", () => {
    const result = normalizeTeamsPayload([makeTeam()]);
    expect(result).toHaveLength(1);
    expect(result![0]!.id).toBe("team-1");
  });

  it("4. valid row order is preserved", () => {
    const rows = [makeTeam({ id: "a" }), makeTeam({ id: "b" }), makeTeam({ id: "c" })];
    const result = normalizeTeamsPayload(rows);
    expect(result!.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("5. malformed Team rows are dropped", () => {
    const rows = [makeTeam({ id: "a" }), null, "invalid", { id: "no-name" }, makeTeam({ id: "b" })];
    const result = normalizeTeamsPayload(rows);
    expect(result!.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("6. malformed members are dropped", () => {
    const row = makeTeam({
      members: [
        { user: { id: "ok1", name: "A", image: null }, role: "member" },
        null,
        { user: null, role: "member" },
        { user: { id: "" }, role: "member" },
        { user: { id: "ok2" }, role: "member" },
        { user: { id: "ok3" } }, // missing role
      ] as unknown as TeamsHubTeam["members"],
    });
    const result = normalizeTeamsPayload([row]);
    expect(result![0]!.members.map((m) => m.user.id)).toEqual(["ok1", "ok2"]);
  });

  it("7. valid members remain in source order", () => {
    const row = makeTeam({
      members: [
        { user: { id: "z", name: null, image: null }, role: "member" },
        { user: { id: "a", name: null, image: null }, role: "admin" },
      ],
    });
    const result = normalizeTeamsPayload([row]);
    expect(result![0]!.members.map((m) => m.user.id)).toEqual(["z", "a"]);
  });

  it("8. Team IDs are trimmed", () => {
    const result = normalizeTeamsPayload([makeTeam({ id: "  team-1  " })]);
    expect(result![0]!.id).toBe("team-1");
  });

  it("9. empty Team IDs invalidate the row", () => {
    const result = normalizeTeamsPayload([makeTeam({ id: "   " })]);
    expect(result).toEqual([]);
  });

  it("10. non-boolean isPublic invalidates the row", () => {
    const result = normalizeTeamsPayload([{ ...makeTeam(), isPublic: "yes" as unknown as boolean }]);
    expect(result).toEqual([]);
  });

  it("11. non-array members invalidates the row", () => {
    const result = normalizeTeamsPayload([{ ...makeTeam(), members: "nope" as unknown as [] }]);
    expect(result).toEqual([]);
  });

  it("12. optional description normalizes to null", () => {
    const result = normalizeTeamsPayload([{ ...makeTeam(), description: undefined }]);
    expect(result![0]!.description).toBeNull();
    const result2 = normalizeTeamsPayload([{ ...makeTeam(), description: 5 as unknown as string }]);
    expect(result2![0]!.description).toBeNull();
  });

  it("13. optional createdAt normalizes to null", () => {
    const result = normalizeTeamsPayload([{ ...makeTeam(), createdAt: undefined }]);
    expect(result![0]!.createdAt).toBeNull();
  });

  it("14. input payload is not mutated", () => {
    const row = makeTeam();
    const snapshot = JSON.parse(JSON.stringify(row));
    normalizeTeamsPayload([row]);
    expect(row).toEqual(snapshot);
  });

  it("15. unrelated progress fields are ignored", () => {
    const row = { ...makeTeam(), progress: { totalPoints: 999 } };
    const result = normalizeTeamsPayload([row]);
    expect(result![0]).not.toHaveProperty("progress");
  });
});

describe("getTeamsHubDisplayName / getTeamsHubDescription", () => {
  it("16. non-empty Team name is trimmed", () => {
    expect(getTeamsHubDisplayName("  Midnight Puzzle Society  ")).toBe("Midnight Puzzle Society");
  });

  it("17. blank Team name becomes Unnamed Team", () => {
    expect(getTeamsHubDisplayName("   ")).toBe("Unnamed Team");
  });

  it("18. null Team name becomes Unnamed Team", () => {
    expect(getTeamsHubDisplayName(null)).toBe("Unnamed Team");
    expect(getTeamsHubDisplayName(undefined)).toBe("Unnamed Team");
  });

  it("19. non-empty description is trimmed", () => {
    expect(getTeamsHubDescription("  We solve puzzles.  ")).toBe("We solve puzzles.");
  });

  it("20. blank description becomes the fallback", () => {
    expect(getTeamsHubDescription("   ")).toBe("No description provided.");
  });

  it("21. null description becomes the fallback", () => {
    expect(getTeamsHubDescription(null)).toBe("No description provided.");
    expect(getTeamsHubDescription(undefined)).toBe("No description provided.");
  });
});

describe("filterTeamsForView", () => {
  it("22. public mode returns only public Teams", () => {
    const teams = [makeTeam({ id: "a", isPublic: true }), makeTeam({ id: "b", isPublic: false })];
    expect(filterTeamsForView(teams, "public", "me").map((t) => t.id)).toEqual(["a"]);
  });

  it("23. public mode preserves order", () => {
    const teams = [makeTeam({ id: "c", isPublic: true }), makeTeam({ id: "a", isPublic: true })];
    expect(filterTeamsForView(teams, "public", "me").map((t) => t.id)).toEqual(["c", "a"]);
  });

  it("24. My Teams matches exact member user ID", () => {
    const teams = [
      makeTeam({ id: "joined", members: [{ user: { id: "me", name: null, image: null }, role: "member" }] }),
      makeTeam({ id: "not-joined", members: [{ user: { id: "other", name: null, image: null }, role: "member" }] }),
    ];
    expect(filterTeamsForView(teams, "mine", "me").map((t) => t.id)).toEqual(["joined"]);
  });

  it("25. My Teams preserves order", () => {
    const teams = [
      makeTeam({ id: "b", members: [{ user: { id: "me", name: null, image: null }, role: "member" }] }),
      makeTeam({ id: "a", members: [{ user: { id: "me", name: null, image: null }, role: "member" }] }),
    ];
    expect(filterTeamsForView(teams, "mine", "me").map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("26. My Teams does not match display name", () => {
    const teams = [makeTeam({ id: "a", members: [{ user: { id: "not-me", name: "me", image: null }, role: "member" }] })];
    expect(filterTeamsForView(teams, "mine", "me")).toEqual([]);
  });

  it("27. missing session user ID returns an empty My Teams result", () => {
    const teams = [makeTeam({ id: "a" })];
    expect(filterTeamsForView(teams, "mine", null)).toEqual([]);
    expect(filterTeamsForView(teams, "mine", "")).toEqual([]);
    expect(filterTeamsForView(teams, "mine", "   ")).toEqual([]);
  });

  it("28. filtering does not mutate Teams", () => {
    const teams = [makeTeam({ id: "a" })];
    const snapshot = JSON.parse(JSON.stringify(teams));
    filterTeamsForView(teams, "mine", "me");
    filterTeamsForView(teams, "public", "me");
    expect(teams).toEqual(snapshot);
  });
});

describe("TeamsHubContent — header", () => {
  it("29. heading is exactly Teams", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByRole("heading", { name: "Teams" })).toBeTruthy();
  });

  it("30. supporting copy is exact", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByText("Join other players, build a crew, and solve together.")).toBeTruthy();
  });

  it("31. header test ID exists", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-header")).toBeTruthy();
  });

  it("32. no emoji is rendered", () => {
    const { container } = render(<TeamsHubContent {...makeProps()} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent ?? "")).toBe(false);
  });

  it("33. decorative header icon is hidden from assistive technology", () => {
    const { container } = render(<TeamsHubContent {...makeProps()} />);
    const header = container.querySelector('[data-testid="teams-hub-header"]')!;
    const svg = header.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("TeamsHubContent — authenticated controls", () => {
  it("34. authenticated visitor sees view switcher", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-view-switcher")).toBeTruthy();
  });

  it("35. My Teams control exists", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-view-mine")).toBeTruthy();
  });

  it("36. Public Teams control exists", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-view-public")).toBeTruthy();
  });

  it("37. active state is exposed accessibly", () => {
    render(<TeamsHubContent {...makeProps({ viewMode: "mine" })} />);
    expect(screen.getByTestId("teams-hub-view-mine").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("teams-hub-view-public").getAttribute("aria-pressed")).toBe("false");
  });

  it("38. view controls invoke the exact requested mode", () => {
    const onChangeViewMode = jest.fn();
    render(<TeamsHubContent {...makeProps({ onChangeViewMode })} />);
    fireEvent.click(screen.getByTestId("teams-hub-view-public"));
    expect(onChangeViewMode).toHaveBeenCalledWith("public");
    fireEvent.click(screen.getByTestId("teams-hub-view-mine"));
    expect(onChangeViewMode).toHaveBeenCalledWith("mine");
  });

  it("39. view controls are at least 44px tall", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-view-mine").className).toMatch(/min-h-11/);
    expect(screen.getByTestId("teams-hub-view-public").className).toMatch(/min-h-11/);
  });

  it("40. Create Team control exists", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-create")).toBeTruthy();
    expect(screen.getByTestId("teams-hub-create").textContent).toContain("Create Team");
  });

  it("41. Create Team invokes only its callback", () => {
    const onOpenCreateTeam = jest.fn();
    const onOpenInvitations = jest.fn();
    render(<TeamsHubContent {...makeProps({ onOpenCreateTeam, onOpenInvitations, invitationCount: 3 })} />);
    fireEvent.click(screen.getByTestId("teams-hub-create"));
    expect(onOpenCreateTeam).toHaveBeenCalledTimes(1);
    expect(onOpenInvitations).not.toHaveBeenCalled();
  });

  it("42. invitation control renders only when count is above zero", () => {
    const { rerender } = render(<TeamsHubContent {...makeProps({ invitationCount: 0 })} />);
    expect(screen.queryByTestId("teams-hub-invitations")).toBeNull();
    rerender(<TeamsHubContent {...makeProps({ invitationCount: 2 })} />);
    expect(screen.getByTestId("teams-hub-invitations")).toBeTruthy();
  });

  it("43. invitation accessible label includes the count", () => {
    render(<TeamsHubContent {...makeProps({ invitationCount: 5 })} />);
    expect(screen.getByTestId("teams-hub-invitations").getAttribute("aria-label")).toBe("Invitations, 5 pending");
  });

  it("44. invitations invokes only its callback", () => {
    const onOpenCreateTeam = jest.fn();
    const onOpenInvitations = jest.fn();
    render(<TeamsHubContent {...makeProps({ onOpenCreateTeam, onOpenInvitations, invitationCount: 1 })} />);
    fireEvent.click(screen.getByTestId("teams-hub-invitations"));
    expect(onOpenInvitations).toHaveBeenCalledTimes(1);
    expect(onOpenCreateTeam).not.toHaveBeenCalled();
  });
});

describe("TeamsHubContent — anonymous controls", () => {
  function anonProps(overrides: Partial<TeamsHubContentProps> = {}) {
    return makeProps({ isAuthenticated: false, sessionUserId: null, viewMode: "public", ...overrides });
  }

  it("45. anonymous visitor sees no My Teams control", () => {
    render(<TeamsHubContent {...anonProps()} />);
    expect(screen.queryByTestId("teams-hub-view-mine")).toBeNull();
    expect(screen.queryByTestId("teams-hub-view-switcher")).toBeNull();
  });

  it("46. anonymous visitor sees no Create Team button", () => {
    render(<TeamsHubContent {...anonProps()} />);
    expect(screen.queryByTestId("teams-hub-create")).toBeNull();
  });

  it("47. anonymous visitor sees no Invitations control", () => {
    render(<TeamsHubContent {...anonProps({ invitationCount: 5 })} />);
    expect(screen.queryByTestId("teams-hub-invitations")).toBeNull();
  });

  it("48. anonymous sign-in link points to /auth/signin", () => {
    render(<TeamsHubContent {...anonProps()} />);
    expect(screen.getByTestId("teams-hub-sign-in").getAttribute("href")).toBe("/auth/signin");
  });

  it("49. sign-in link has at least a 44px target", () => {
    render(<TeamsHubContent {...anonProps()} />);
    expect(screen.getByTestId("teams-hub-sign-in").className).toMatch(/min-h-11/);
  });
});

describe("TeamsHubContent — loading", () => {
  it("50. loading state exposes role=status", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "loading" })} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("51. loading state is labelled Loading teams", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "loading" })} />);
    expect(screen.getByRole("status", { name: "Loading teams" })).toBeTruthy();
  });

  it("52. at least three card skeletons render", () => {
    const { container } = render(<TeamsHubContent {...makeProps({ loadStatus: "loading" })} />);
    const skeletons = container.querySelectorAll('[data-skeleton="true"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("53. reduced-motion class exists", () => {
    const { container } = render(<TeamsHubContent {...makeProps({ loadStatus: "loading" })} />);
    expect(container.innerHTML).toMatch(/motion-reduce:animate-none/);
  });

  it("54. plain Loading teams... text is absent", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "loading" })} />);
    expect(screen.queryByText("Loading teams...")).toBeNull();
  });
});

describe("TeamsHubContent — error", () => {
  it("55. error heading is exact", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "error" })} />);
    expect(screen.getByRole("heading", { name: "We couldn’t load teams" })).toBeTruthy();
  });

  it("56. error copy is exact", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "error" })} />);
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
  });

  it("57. retry control exists", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "error" })} />);
    expect(screen.getByTestId("teams-hub-retry")).toBeTruthy();
  });

  it("58. retry invokes only its callback", () => {
    const onRetry = jest.fn();
    render(<TeamsHubContent {...makeProps({ loadStatus: "error", onRetry })} />);
    fireEvent.click(screen.getByTestId("teams-hub-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("59. retrying label is Trying…", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "error", retrying: true })} />);
    expect(screen.getByTestId("teams-hub-retry").textContent).toContain("Trying…");
  });

  it("60. retrying control is disabled", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "error", retrying: true })} />);
    expect((screen.getByTestId("teams-hub-retry") as HTMLButtonElement).disabled).toBe(true);
  });

  it("61. retry target is at least 44px", () => {
    render(<TeamsHubContent {...makeProps({ loadStatus: "error" })} />);
    expect(screen.getByTestId("teams-hub-retry").className).toMatch(/min-h-12/);
  });
});

describe("TeamsHubContent — cards", () => {
  it("62. grid test ID exists", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-grid")).toBeTruthy();
  });

  it("63. card order matches input order", () => {
    const teams = [makeTeam({ id: "b" }), makeTeam({ id: "a" })].map((t) => ({
      ...t,
      members: [{ user: { id: "me", name: null, image: null }, role: "member" }],
    }));
    render(<TeamsHubContent {...makeProps({ teams, viewMode: "mine" })} />);
    const grid = screen.getByTestId("teams-hub-grid");
    const links = within(grid).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("data-testid"))).toEqual(["teams-hub-team-b", "teams-hub-team-a"]);
  });

  it("64. card href is exact", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-team-team-1").getAttribute("href")).toBe("/teams/team-1");
  });

  it("65. accessible link name identifies the Team", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByRole("link", { name: "View Midnight Puzzle Society team" })).toBeTruthy();
  });

  it("66. blank Team name uses Unnamed Team", () => {
    render(<TeamsHubContent {...makeProps({ teams: [makeTeam({ name: "   " })] })} />);
    expect(screen.getByText("Unnamed Team")).toBeTruthy();
  });

  it("67. missing description uses the fallback", () => {
    render(<TeamsHubContent {...makeProps({ teams: [makeTeam({ description: null })] })} />);
    expect(screen.getByText("No description provided.")).toBeTruthy();
  });

  it("68. zero-member grammar is correct", () => {
    render(<TeamsHubContent {...makeProps({ teams: [makeTeam({ members: [] })], viewMode: "public" })} />);
    expect(screen.getByText("0 members")).toBeTruthy();
  });

  it("69. one-member grammar is correct", () => {
    render(<TeamsHubContent {...makeProps({ teams: [makeTeam({ members: [{ user: { id: "u1", name: null, image: null }, role: "member" }] })], viewMode: "public" })} />);
    expect(screen.getByText("1 member")).toBeTruthy();
  });

  it("70. multiple-member grammar is correct", () => {
    render(
      <TeamsHubContent
        {...makeProps({
          teams: [
            makeTeam({
              members: [
                { user: { id: "u1", name: null, image: null }, role: "member" },
                { user: { id: "u2", name: null, image: null }, role: "member" },
              ],
            }),
          ],
          viewMode: "public",
        })}
      />
    );
    expect(screen.getByText("2 members")).toBeTruthy();
  });

  it("71. public badge appears", () => {
    render(<TeamsHubContent {...makeProps({ teams: [makeTeam({ isPublic: true })], viewMode: "public" })} />);
    expect(screen.getByText("Public")).toBeTruthy();
  });

  it("72. private badge appears", () => {
    render(<TeamsHubContent {...makeProps({ teams: [makeTeam({ isPublic: false })], viewMode: "mine" })} />);
    expect(screen.getByText("Private")).toBeTruthy();
  });

  it("73. View team appears", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByText("View team")).toBeTruthy();
  });

  it("74. card has visible focus classes", () => {
    render(<TeamsHubContent {...makeProps()} />);
    expect(screen.getByTestId("teams-hub-team-team-1").className).toMatch(/focus-visible:ring/);
  });

  it("75. card source contains no .sort(", () => {
    expect(SOURCE).not.toMatch(/\.sort\(/);
  });
});

describe("TeamsHubContent — empty states", () => {
  it("76. authenticated My Teams empty heading is exact", () => {
    render(<TeamsHubContent {...makeProps({ teams: [], viewMode: "mine" })} />);
    expect(screen.getByRole("heading", { name: "You’re not on a team yet" })).toBeTruthy();
    expect(screen.getByText("Explore public teams or create one of your own.")).toBeTruthy();
  });

  it("77. Explore Public Teams invokes public view only", () => {
    const onChangeViewMode = jest.fn();
    render(<TeamsHubContent {...makeProps({ teams: [], viewMode: "mine", onChangeViewMode })} />);
    fireEvent.click(screen.getByText("Explore Public Teams"));
    expect(onChangeViewMode).toHaveBeenCalledWith("public");
    expect(onChangeViewMode).toHaveBeenCalledTimes(1);
  });

  it("78. My Teams empty Create Team invokes modal callback", () => {
    const onOpenCreateTeam = jest.fn();
    render(<TeamsHubContent {...makeProps({ teams: [], viewMode: "mine", onOpenCreateTeam })} />);
    const emptyState = screen.getByTestId("teams-hub-empty");
    fireEvent.click(within(emptyState).getByText("Create Team"));
    expect(onOpenCreateTeam).toHaveBeenCalledTimes(1);
  });

  it("79. authenticated Public empty copy is exact", () => {
    render(<TeamsHubContent {...makeProps({ teams: [], viewMode: "public" })} />);
    expect(screen.getByRole("heading", { name: "No public teams yet" })).toBeTruthy();
    expect(screen.getByText("Create a team and be the first to welcome new players.")).toBeTruthy();
  });

  it("80. anonymous empty state links to sign-in", () => {
    render(<TeamsHubContent {...makeProps({ isAuthenticated: false, sessionUserId: null, teams: [], viewMode: "public" })} />);
    expect(screen.getByRole("heading", { name: "No public teams yet" })).toBeTruthy();
    expect(screen.getByText("Sign in to create a team and start building your crew.")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: "Sign in to create a team" });
    expect(links.some((l) => l.getAttribute("href") === "/auth/signin")).toBe(true);
  });

  it("81. empty-state controls retain 44px targets", () => {
    render(<TeamsHubContent {...makeProps({ teams: [], viewMode: "mine" })} />);
    const emptyState = screen.getByTestId("teams-hub-empty");
    within(emptyState)
      .getAllByRole("button")
      .forEach((btn) => expect(btn.className).toMatch(/min-h-11/));
  });
});

describe("TeamsHubContent — purity", () => {
  it("82. source contains no direct fetch(", () => {
    expect(SOURCE).not.toMatch(/\bfetch\(/);
  });

  it("83. source contains no useSession", () => {
    expect(SOURCE).not.toMatch(/useSession/);
  });

  it("84. source contains no useRouter", () => {
    expect(SOURCE).not.toMatch(/useRouter/);
  });

  it("85. source contains no mutation endpoint", () => {
    expect(SOURCE).not.toMatch(/method:\s*["'](POST|PUT|DELETE|PATCH)["']/);
  });

  it("86. source contains no .sort(", () => {
    expect(SOURCE).not.toMatch(/\.sort\(/);
  });

  it("87. supplied Team arrays are not mutated", () => {
    const teams = [makeTeam({ id: "a" }), makeTeam({ id: "b", isPublic: false })];
    const snapshot = JSON.parse(JSON.stringify(teams));
    render(<TeamsHubContent {...makeProps({ teams, viewMode: "public" })} />);
    expect(teams).toEqual(snapshot);
  });
});
