/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { getThemeConfig, THEME_CONFIGS } from "@/lib/profileThemes";
import TeamThemePicker, {
  getAvailableTeamThemeKeys,
  formatTeamThemeLabel,
  type TeamThemePickerProps,
} from "./TeamThemePicker";

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamThemePicker.tsx"), "utf8");
const theme = getThemeConfig("default");

function makeProps(overrides: Partial<TeamThemePickerProps> = {}): TeamThemePickerProps {
  return {
    activeTheme: "default",
    ownedTeamThemes: [],
    theme,
    onClose: jest.fn(),
    onSelectTheme: jest.fn(),
    ...overrides,
  };
}

describe("getAvailableTeamThemeKeys", () => {
  it("default is always available", () => {
    expect(getAvailableTeamThemeKeys([])).toEqual(["default"]);
  });

  it("valid owned themes render", () => {
    expect(getAvailableTeamThemeKeys(["gold"])).toEqual(["default", "gold"]);
  });

  it("duplicate themes are removed", () => {
    expect(getAvailableTeamThemeKeys(["gold", "gold"])).toEqual(["default", "gold"]);
  });

  it("unknown themes are ignored", () => {
    expect(getAvailableTeamThemeKeys(["unknown"])).toEqual(["default"]);
  });

  it("non-string inventory values are ignored", () => {
    expect(getAvailableTeamThemeKeys(["gold", null, undefined, 5, {}])).toEqual(["default", "gold"]);
  });

  it("empty strings are ignored", () => {
    expect(getAvailableTeamThemeKeys(["", "  "])).toEqual(["default"]);
  });

  it("matches the documented mixed example", () => {
    expect(getAvailableTeamThemeKeys(["gold", "gold", "unknown", null])).toEqual(["default", "gold"]);
  });

  it("input inventory is not mutated", () => {
    const input = ["gold", "unknown"];
    const snapshot = [...input];
    getAvailableTeamThemeKeys(input);
    expect(input).toEqual(snapshot);
  });

  it("preserves canonical THEME_CONFIGS order regardless of input order", () => {
    const canonicalNonDefault = Object.keys(THEME_CONFIGS).filter((k) => k !== "default");
    const reversedInput = [...canonicalNonDefault].reverse();
    expect(getAvailableTeamThemeKeys(reversedInput)).toEqual(["default", ...canonicalNonDefault]);
  });

  it("default never appears twice even if supplied as owned", () => {
    expect(getAvailableTeamThemeKeys(["default", "default"])).toEqual(["default"]);
  });
});

describe("formatTeamThemeLabel", () => {
  it("formats a two-word underscored key", () => {
    expect(formatTeamThemeLabel("ignition_ember")).toBe("Ignition Ember");
  });

  it("formats a single-word key", () => {
    expect(formatTeamThemeLabel("gold")).toBe("Gold");
  });
});

describe("TeamThemePicker — active theme normalization", () => {
  it("theme_gold correctly selects Gold", () => {
    render(<TeamThemePicker {...makeProps({ activeTheme: "theme_gold", ownedTeamThemes: ["gold"] })} />);
    expect(screen.getByTestId("team-theme-option-gold").getAttribute("aria-pressed")).toBe("true");
  });

  it("unknown active theme falls back to Default", () => {
    render(<TeamThemePicker {...makeProps({ activeTheme: "totally-unknown-theme", ownedTeamThemes: ["gold"] })} />);
    expect(screen.getByTestId("team-theme-option-default").getAttribute("aria-pressed")).toBe("true");
  });

  it("active option has aria-pressed=true", () => {
    render(<TeamThemePicker {...makeProps({ activeTheme: "gold", ownedTeamThemes: ["gold"] })} />);
    expect(screen.getByTestId("team-theme-option-gold").getAttribute("aria-pressed")).toBe("true");
  });

  it("inactive option has aria-pressed=false", () => {
    render(<TeamThemePicker {...makeProps({ activeTheme: "gold", ownedTeamThemes: ["gold"] })} />);
    expect(screen.getByTestId("team-theme-option-default").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("TeamThemePicker — selection and close", () => {
  it("selecting Gold calls onSelectTheme(\"gold\")", () => {
    const onSelectTheme = jest.fn();
    render(<TeamThemePicker {...makeProps({ ownedTeamThemes: ["gold"], onSelectTheme })} />);
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    expect(onSelectTheme).toHaveBeenCalledWith("gold");
  });

  it("close invokes onClose", () => {
    const onClose = jest.fn();
    render(<TeamThemePicker {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: "Close theme picker" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("close button is named Close theme picker", () => {
    render(<TeamThemePicker {...makeProps()} />);
    expect(screen.getByRole("button", { name: "Close theme picker" })).toBeTruthy();
  });
});

describe("TeamThemePicker — empty state", () => {
  it("empty owned inventory preserves the empty-state message", () => {
    render(<TeamThemePicker {...makeProps({ ownedTeamThemes: [] })} />);
    expect(screen.getByText("No team themes owned yet.")).toBeTruthy();
  });

  it("store link points to /store", () => {
    render(<TeamThemePicker {...makeProps({ ownedTeamThemes: [] })} />);
    expect(screen.getByRole("link", { name: /Visit Store/ }).getAttribute("href")).toBe("/store");
  });

  it("store link text remains 'Visit Store →'", () => {
    render(<TeamThemePicker {...makeProps({ ownedTeamThemes: [] })} />);
    expect(screen.getByText("Visit Store →")).toBeTruthy();
  });

  it("empty-state message is absent once a theme is owned", () => {
    render(<TeamThemePicker {...makeProps({ ownedTeamThemes: ["gold"] })} />);
    expect(screen.queryByText("No team themes owned yet.")).toBeNull();
  });
});

describe("TeamThemePicker — presentation", () => {
  it("theme labels are human-readable", () => {
    render(<TeamThemePicker {...makeProps({ ownedTeamThemes: ["ignition_ember"] })} />);
    expect(screen.getByText("Ignition Ember")).toBeTruthy();
  });

  it("does not call fetch", () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    render(<TeamThemePicker {...makeProps({ ownedTeamThemes: ["gold"] })} />);
    fireEvent.click(screen.getByTestId("team-theme-option-gold"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("source contains no direct fetch call", () => {
    expect(SOURCE).not.toMatch(/\bfetch\(/);
  });

  it("exposes the picker container id and testid", () => {
    render(<TeamThemePicker {...makeProps()} />);
    const el = screen.getByTestId("team-theme-picker");
    expect(el.id).toBe("team-theme-picker");
  });
});
