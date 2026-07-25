/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { getThemeConfig } from "@/lib/profileThemes";
import TeamLeaveDialog, {
  getLeaveTeamDisplayName,
  type TeamLeaveDialogProps,
} from "./TeamLeaveDialog";

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamLeaveDialog.tsx"), "utf8");
const theme = getThemeConfig("default");

function makeDialogProps(overrides: Partial<TeamLeaveDialogProps> = {}): TeamLeaveDialogProps {
  return {
    isOpen: true,
    teamName: "Midnight Puzzle Society",
    pending: false,
    theme,
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
}

describe("getLeaveTeamDisplayName", () => {
  it("non-empty team name is returned", () => {
    expect(getLeaveTeamDisplayName("Midnight Puzzle Society")).toBe("Midnight Puzzle Society");
  });

  it("team name is trimmed", () => {
    expect(getLeaveTeamDisplayName("  Midnight Puzzle Society  ")).toBe("Midnight Puzzle Society");
  });

  it("null returns Unnamed Team", () => {
    expect(getLeaveTeamDisplayName(null)).toBe("Unnamed Team");
  });

  it("undefined returns Unnamed Team", () => {
    expect(getLeaveTeamDisplayName(undefined)).toBe("Unnamed Team");
  });

  it("empty string returns Unnamed Team", () => {
    expect(getLeaveTeamDisplayName("")).toBe("Unnamed Team");
  });

  it("whitespace-only string returns Unnamed Team", () => {
    expect(getLeaveTeamDisplayName("   ")).toBe("Unnamed Team");
  });
});

describe("TeamLeaveDialog — closed state", () => {
  it("closed dialog renders nothing", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ isOpen: false })} />);
    expect(screen.queryByTestId("team-leave-dialog")).toBeNull();
  });
});

describe("TeamLeaveDialog — open dialog semantics", () => {
  it('exposes exactly one role="dialog"', () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it('exposes aria-modal="true"', () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("aria-labelledby points to a real heading", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    const dialog = screen.getByRole("dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby")!;
    const el = document.getElementById(labelledBy);
    expect(el).toBeTruthy();
    expect(el?.tagName).toBe("H2");
  });

  it("aria-describedby points to a real description", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)).toBeTruthy();
  });

  it("heading is exactly Leave team", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByRole("heading", { name: "Leave team" })).toBeTruthy();
  });

  it("exact confirmation sentence contains the team name", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ teamName: "Midnight Puzzle Society" })} />);
    expect(
      screen.getByText("Are you sure you want to leave the team Midnight Puzzle Society?")
    ).toBeTruthy();
  });

  it("null team name renders Unnamed Team", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ teamName: null })} />);
    expect(
      screen.getByText("Are you sure you want to leave the team Unnamed Team?")
    ).toBeTruthy();
  });

  it("stable dialog test ID is present", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-leave-dialog")).toBeTruthy();
  });

  it("stable Cancel test ID is present", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-leave-cancel")).toBeTruthy();
  });

  it("stable Leave test ID is present", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-leave-confirm")).toBeTruthy();
  });
});

describe("TeamLeaveDialog — buttons and layout", () => {
  it("Cancel visible text is exact", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-leave-cancel").textContent).toBe("Cancel");
  });

  it("Leave visible text is exact", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-leave-confirm").textContent).toBe("Leave");
  });

  it('both buttons use type="button"', () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect((screen.getByTestId("team-leave-cancel") as HTMLButtonElement).type).toBe("button");
    expect((screen.getByTestId("team-leave-confirm") as HTMLButtonElement).type).toBe("button");
  });

  it("both buttons have at least a 44px minimum target", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-leave-cancel").className).toMatch(/min-h-11/);
    expect(screen.getByTestId("team-leave-confirm").className).toMatch(/min-h-11/);
  });

  it("both buttons have visible focus classes", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-leave-cancel").className).toMatch(/focus-visible:ring/);
    expect(screen.getByTestId("team-leave-confirm").className).toMatch(/focus-visible:ring/);
  });

  it("mobile stacked layout classes exist", () => {
    const { container } = render(<TeamLeaveDialog {...makeDialogProps()} />);
    const actions = container.querySelector(".flex.flex-col.gap-2");
    expect(actions).toBeTruthy();
  });

  it("responsive inline layout classes exist", () => {
    const { container } = render(<TeamLeaveDialog {...makeDialogProps()} />);
    const actions = container.querySelector(".sm\\:flex-row");
    expect(actions).toBeTruthy();
  });

  it("dialog has safe-area-aware spacing", () => {
    const { container } = render(<TeamLeaveDialog {...makeDialogProps()} />);
    const outer = container.querySelector(".fixed.inset-0") as HTMLElement;
    expect(outer.style.paddingBottom).toMatch(/env\(safe-area-inset-bottom/);
  });

  it('dialog container uses tabIndex="-1"', () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-leave-dialog").getAttribute("tabindex")).toBe("-1");
  });
});

describe("TeamLeaveDialog — interaction", () => {
  it("Cancel invokes only onCancel", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<TeamLeaveDialog {...makeDialogProps({ onCancel, onConfirm })} />);
    fireEvent.click(screen.getByTestId("team-leave-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Leave invokes only onConfirm", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<TeamLeaveDialog {...makeDialogProps({ onCancel, onConfirm })} />);
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("Escape invokes only onCancel", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<TeamLeaveDialog {...makeDialogProps({ onCancel, onConfirm })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Backdrop invokes only onCancel", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { container } = render(<TeamLeaveDialog {...makeDialogProps({ onCancel, onConfirm })} />);
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("initial focus moves to Cancel", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-cancel"));
  });

  it("Tab from Leave wraps to Cancel", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    screen.getByTestId("team-leave-confirm").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-cancel"));
  });

  it("Shift+Tab from Cancel wraps to Leave", () => {
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    screen.getByTestId("team-leave-cancel").focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-confirm"));
  });

  it("focus outside the dialog is redirected inside", () => {
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.appendChild(outside);
    render(<TeamLeaveDialog {...makeDialogProps()} />);
    outside.focus();
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-cancel"));
    document.body.removeChild(outside);
  });

  it("normal cancellation restores the original trigger", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(<TeamLeaveDialog {...makeDialogProps({ isOpen: false })} />);
    trigger.focus();
    rerender(<TeamLeaveDialog {...makeDialogProps({ isOpen: true })} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-cancel"));

    // Simulate the real cancellation path: click Cancel (marks the internal
    // cancellation flag), then the page closes the dialog via isOpen.
    fireEvent.click(screen.getByTestId("team-leave-cancel"));
    rerender(<TeamLeaveDialog {...makeDialogProps({ isOpen: false })} />);
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it("request-resolution closure (isOpen set false while pending) does not restore trigger focus", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<TeamLeaveDialog {...makeDialogProps({ isOpen: false })} />);
    trigger.focus();
    rerender(<TeamLeaveDialog {...makeDialogProps({ isOpen: true, pending: true })} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-dialog"));

    // The dialog remains open (pending -> resolved outside this component's control);
    // simulate the page closing it directly after resolution rather than via onCancel.
    rerender(<TeamLeaveDialog {...makeDialogProps({ isOpen: false, pending: false })} />);
    expect(document.activeElement).not.toBe(trigger);

    document.body.removeChild(trigger);
  });
});

describe("TeamLeaveDialog — pending state", () => {
  it('dialog exposes aria-busy="true"', () => {
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    expect(screen.getByTestId("team-leave-dialog").getAttribute("aria-busy")).toBe("true");
  });

  it("confirmation label becomes Leaving…", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    expect(screen.getByTestId("team-leave-confirm").textContent).toContain("Leaving…");
  });

  it("Leave is disabled", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    expect((screen.getByTestId("team-leave-confirm") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Cancel is disabled", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    expect((screen.getByTestId("team-leave-cancel") as HTMLButtonElement).disabled).toBe(true);
  });

  it("backdrop cannot dismiss", () => {
    const onCancel = jest.fn();
    const { container } = render(<TeamLeaveDialog {...makeDialogProps({ pending: true, onCancel })} />);
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("Escape cannot dismiss", () => {
    const onCancel = jest.fn();
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true, onCancel })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("disabled buttons invoke no callbacks", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true, onCancel, onConfirm })} />);
    fireEvent.click(screen.getByTestId("team-leave-cancel"));
    fireEvent.click(screen.getByTestId("team-leave-confirm"));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("pending focus moves to the dialog container", () => {
    const { rerender } = render(<TeamLeaveDialog {...makeDialogProps({ pending: false })} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-cancel"));
    rerender(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-dialog"));
  });

  it("pending Tab remains on the dialog container", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-dialog"));
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-dialog"));
  });

  it("pending Shift+Tab remains on the dialog container", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-dialog"));
  });

  it("outside focus is redirected to the dialog container", () => {
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.appendChild(outside);
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    outside.focus();
    expect(document.activeElement).not.toBe(outside);
    expect(document.activeElement).toBe(screen.getByTestId("team-leave-dialog"));
    document.body.removeChild(outside);
  });

  it("pending layout remains stable", () => {
    render(<TeamLeaveDialog {...makeDialogProps({ pending: true })} />);
    expect(screen.getByTestId("team-leave-cancel").className).toMatch(/min-h-11/);
    expect(screen.getByTestId("team-leave-confirm").className).toMatch(/min-h-11/);
  });
});

describe("TeamLeaveDialog — purity", () => {
  it("source contains no direct fetch(", () => {
    expect(SOURCE).not.toMatch(/\bfetch\(/);
  });

  it("source contains no useSession", () => {
    expect(SOURCE).not.toMatch(/useSession/);
  });

  it("source contains no useRouter", () => {
    expect(SOURCE).not.toMatch(/useRouter/);
  });

  it("source contains no setTimeout", () => {
    expect(SOURCE).not.toMatch(/setTimeout/);
  });

  it("source contains no .sort(", () => {
    expect(SOURCE).not.toMatch(/\.sort\(/);
  });
});
