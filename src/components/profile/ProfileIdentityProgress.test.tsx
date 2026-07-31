/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { THEME_CONFIGS, FRAME_CONFIGS } from "@/lib/profileThemes";
import ProfileIdentityProgress, {
  type ProfileIdentityProgressProfile,
} from "./ProfileIdentityProgress";

const THEME = THEME_CONFIGS.default;
const NO_FRAME = FRAME_CONFIGS.none;
const GOLD_FRAME = FRAME_CONFIGS.gold;

const BASE_PROFILE: ProfileIdentityProgressProfile = {
  name: "Nova Solver",
  image: null,
  role: "user",
  createdAt: "2025-03-15T12:00:00.000Z",
  level: 7,
  xp: 2150,
  xpTitle: "Riddle Hunter",
  xpToNextLevel: 500,
  xpProgress: 62,
  totalPuzzlesSolved: 128,
  totalPoints: 45210,
  rank: 12,
  activeNameColor: "none",
  activeFlair: "none",
  activeTitle: "none",
  isFounder: false,
  social: {
    followers: 34,
    following: 19,
  },
};

function noop() {}

function renderComponent(overrides: Partial<ProfileIdentityProgressProfile> = {}, props: Partial<{
  onEditProfile: () => void;
  onCustomize: () => void;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}> = {}) {
  const profile: ProfileIdentityProgressProfile = { ...BASE_PROFILE, ...overrides };
  return render(
    <ProfileIdentityProgress
      profile={profile}
      theme={THEME}
      frame={NO_FRAME}
      onEditProfile={props.onEditProfile ?? noop}
      onCustomize={props.onCustomize ?? noop}
      onOpenFollowers={props.onOpenFollowers ?? noop}
      onOpenFollowing={props.onOpenFollowing ?? noop}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("ProfileIdentityProgress — identity rendering (Test A)", () => {
  it("displays player name, level, XP title, member-since, social counts, rank, solved, and points", () => {
    renderComponent();

    expect(screen.getByRole("heading", { name: /Nova Solver/ })).toBeTruthy();
    expect(screen.getByText(/LVL 7/)).toBeTruthy();
    expect(screen.getByText(/Riddle Hunter/)).toBeTruthy();
    expect(screen.getByText(/Member since March 2025/)).toBeTruthy();
    expect(screen.getByText("34")).toBeTruthy();
    expect(screen.getByText("19")).toBeTruthy();
    expect(screen.getByText("#12")).toBeTruthy();
    expect(screen.getByText("128")).toBeTruthy();
    expect(screen.getByText("45,210")).toBeTruthy();
  });
});

describe("ProfileIdentityProgress — accessible XP progress (Test B)", () => {
  it("renders a labeled progressbar with correct min/max/now and displays XP values", () => {
    renderComponent();

    const bar = screen.getByRole("progressbar", { name: "Level progress" });
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("62");

    expect(screen.getByText("2,150 XP")).toBeTruthy();
    expect(screen.getByText("+500 to next level")).toBeTruthy();
  });

  it("clamps aria-valuenow above 100 down to 100", () => {
    renderComponent({ xpProgress: 140 });
    const bar = screen.getByRole("progressbar", { name: "Level progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
  });

  it("clamps aria-valuenow below 0 up to 0", () => {
    renderComponent({ xpProgress: -30 });
    const bar = screen.getByRole("progressbar", { name: "Level progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("ProfileIdentityProgress — main actions (Test C)", () => {
  it("calls onEditProfile exactly once when Edit Profile is clicked", () => {
    const onEditProfile = jest.fn();
    renderComponent({}, { onEditProfile });
    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
  });

  it("calls onCustomize exactly once when Customize is clicked", () => {
    const onCustomize = jest.fn();
    renderComponent({}, { onCustomize });
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });
});

describe("ProfileIdentityProgress — social actions (Test D)", () => {
  it("calls onOpenFollowers exactly once when Followers is clicked", () => {
    const onOpenFollowers = jest.fn();
    renderComponent({}, { onOpenFollowers });
    fireEvent.click(screen.getByRole("button", { name: /Followers/ }));
    expect(onOpenFollowers).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenFollowing exactly once when Following is clicked", () => {
    const onOpenFollowing = jest.fn();
    renderComponent({}, { onOpenFollowing });
    fireEvent.click(screen.getByRole("button", { name: /Following/ }));
    expect(onOpenFollowing).toHaveBeenCalledTimes(1);
  });
});

describe("ProfileIdentityProgress — conditional identity labels (Test E)", () => {
  it("shows Founder only when activeTitle is 'founder'", () => {
    renderComponent({ activeTitle: "founder" });
    expect(screen.getByText(/Founder/)).toBeTruthy();
  });

  it("shows Admin only when role is 'admin'", () => {
    renderComponent({ role: "admin" });
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("shows neither Founder nor Admin for a normal player without the equipped title", () => {
    renderComponent({ activeTitle: "none", role: "user", isFounder: false });
    expect(screen.queryByText(/Founder/)).toBeNull();
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("does not show Founder merely because isFounder is true without the title equipped", () => {
    renderComponent({ isFounder: true, activeTitle: "none" });
    expect(screen.queryByText(/Founder/)).toBeNull();
  });
});

describe("ProfileIdentityProgress — rank and fallback presentation (Test F)", () => {
  it("displays a numeric rank as #<rank>", () => {
    renderComponent({ rank: 5 });
    expect(screen.getByText("#5")).toBeTruthy();
  });

  it("displays a null rank as Unranked", () => {
    renderComponent({ rank: null });
    expect(screen.getByText("Unranked")).toBeTruthy();
  });

  it("uses the fallback avatar without crashing when image is missing", () => {
    expect(() => renderComponent({ image: null })).not.toThrow();
    expect(screen.getByRole("img", { name: /avatar/i })).toBeTruthy();
  });

  it("renders the active AvatarFrame when a frame with colors is provided, without crashing", () => {
    const profile: ProfileIdentityProgressProfile = { ...BASE_PROFILE };
    expect(() =>
      render(
        <ProfileIdentityProgress
          profile={profile}
          theme={THEME}
          frame={GOLD_FRAME}
          onEditProfile={noop}
          onCustomize={noop}
          onOpenFollowers={noop}
          onOpenFollowing={noop}
        />
      )
    ).not.toThrow();
  });
});

// ── Pass 27A1 — 320px narrow-layout hardening ───────────────────────────────

const STRESS_PROFILE_OVERRIDES: Partial<ProfileIdentityProgressProfile> = {
  name: "MaximumNameWidth",
  activeFlair: "✨",
  xp: 12_345_678,
  xpToNextLevel: 9_999_999,
  totalPuzzlesSolved: 999_999,
  totalPoints: 12_345_678,
  rank: null,
  social: {
    followers: 999_999,
    following: 999_999,
  },
};

describe("ProfileIdentityProgress — long and large values remain rendered (Test G)", () => {
  it("keeps the long name, flair, large social counts, XP values, and large stats accessible", () => {
    renderComponent(STRESS_PROFILE_OVERRIDES);

    expect(screen.getByRole("heading", { name: /MaximumNameWidth/ })).toBeTruthy();
    expect(screen.getByText(/✨/)).toBeTruthy();
    expect(screen.getAllByText("999,999").length).toBeGreaterThanOrEqual(2); // followers + following
    expect(screen.getByText("12,345,678 XP")).toBeTruthy();
    expect(screen.getByText("+9,999,999 to next level")).toBeTruthy();
    expect(screen.getByText("Unranked")).toBeTruthy();

    const statsGroup = screen.getByRole("group", { name: "Profile stats" });
    expect(within(statsGroup).getByText("999,999")).toBeTruthy(); // puzzles solved
    expect(within(statsGroup).getByText("12,345,678")).toBeTruthy(); // earned points
  });
});

describe("ProfileIdentityProgress — narrow layout hooks remain present (Test H)", () => {
  it("exposes stable, accessible groups for actions, social, and stats", () => {
    renderComponent();

    const actionsGroup = screen.getByRole("group", { name: "Profile actions" });
    expect(actionsGroup.getAttribute("data-testid")).toBe("profile-actions");
    expect(within(actionsGroup).getByRole("button", { name: "Edit Profile" })).toBeTruthy();
    expect(within(actionsGroup).getByRole("button", { name: "Customize" })).toBeTruthy();

    const socialGroup = screen.getByRole("group", { name: "Profile social" });
    expect(socialGroup.getAttribute("data-testid")).toBe("profile-social");
    expect(within(socialGroup).getByRole("button", { name: /Followers/ })).toBeTruthy();
    expect(within(socialGroup).getByRole("button", { name: /Following/ })).toBeTruthy();

    const statsGroup = screen.getByRole("group", { name: "Profile stats" });
    expect(statsGroup.getAttribute("data-testid")).toBe("profile-stats");
    expect(within(statsGroup).getByText("Global Rank")).toBeTruthy();
    expect(within(statsGroup).getByText("Puzzles Solved")).toBeTruthy();
    expect(within(statsGroup).getByText("Earned Points")).toBeTruthy();
  });
});

describe("ProfileIdentityProgress — Founder, Admin, long name, and flair coexist (Test I)", () => {
  it("renders every identity label together without any of them disappearing", () => {
    renderComponent({
      ...STRESS_PROFILE_OVERRIDES,
      activeTitle: "founder",
      role: "admin",
    });

    expect(screen.getByRole("heading", { name: /MaximumNameWidth/ })).toBeTruthy();
    expect(screen.getByText(/Founder/)).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText(/✨/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Customize" })).toBeTruthy();
  });
});
