/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Flag } from "lucide-react";
import WarzBattleDialog from "./WarzBattleDialog";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function Harness({
  open,
  dismissible,
  role,
}: {
  open: boolean;
  dismissible: boolean;
  role?: "dialog" | "alertdialog";
}) {
  const triggerRef = createRef<HTMLButtonElement>();
  const confirmRef = createRef<HTMLButtonElement>();
  return (
    <div>
      <button ref={triggerRef} type="button">
        Open trigger
      </button>
      <WarzBattleDialog
        open={open}
        role={role}
        title="Forfeit Battle?"
        description="Leaving now counts as a loss."
        icon={Flag}
        dismissible={dismissible}
        initialFocusRef={confirmRef}
        returnFocusRef={triggerRef}
        onClose={() => {}}
      >
        <button type="button">Keep Fighting</button>
        <button ref={confirmRef} type="button">
          Confirm
        </button>
      </WarzBattleDialog>
    </div>
  );
}

describe("WarzBattleDialog", () => {
  it("1. closed dialog renders no panel", () => {
    render(<Harness open={false} dismissible />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("2. open dialog uses requested role", () => {
    render(<Harness open dismissible={false} role="alertdialog" />);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("3. dialog uses aria-modal='true'", () => {
    render(<Harness open dismissible />);
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("4. title is associated", () => {
    render(<Harness open dismissible />);
    const dialog = screen.getByRole("dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe("Forfeit Battle?");
  });

  it("5. description is associated", () => {
    render(<Harness open dismissible />);
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Leaving now counts as a loss.");
  });

  it("6. initial focus enters supplied control", () => {
    render(<Harness open dismissible />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Confirm" }));
  });

  it("7. Tab cycles inside dialog", () => {
    render(<Harness open dismissible />);
    const confirm = screen.getByRole("button", { name: "Confirm" });
    const keepFighting = screen.getByRole("button", { name: "Keep Fighting" });
    confirm.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    // Focus-trap logic runs when activeElement is the *last* focusable and
    // Tab (no shift) is pressed — Confirm is last, so it wraps to the first.
    expect(document.activeElement).toBe(keepFighting);
  });

  it("8. Shift+Tab cycles inside dialog", () => {
    render(<Harness open dismissible />);
    const keepFighting = screen.getByRole("button", { name: "Keep Fighting" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    keepFighting.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("9. Escape closes dismissible dialog", () => {
    let closed = false;
    render(
      <WarzBattleDialog
        open
        title="t"
        description="d"
        dismissible
        onClose={() => { closed = true; }}
      >
        <button type="button">x</button>
      </WarzBattleDialog>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(true);
  });

  it("10. Escape does not close non-dismissible dialog", () => {
    let closed = false;
    render(
      <WarzBattleDialog
        open
        title="t"
        description="d"
        dismissible={false}
        onClose={() => { closed = true; }}
      >
        <button type="button">x</button>
      </WarzBattleDialog>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(false);
  });

  it("11. Backdrop closes dismissible dialog", () => {
    let closed = false;
    render(
      <WarzBattleDialog
        open
        title="t"
        description="d"
        dismissible
        onClose={() => { closed = true; }}
      >
        <button type="button">x</button>
      </WarzBattleDialog>
    );
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(closed).toBe(true);
  });

  it("12. Backdrop does not close non-dismissible dialog", () => {
    let closed = false;
    render(
      <WarzBattleDialog
        open
        title="t"
        description="d"
        dismissible={false}
        onClose={() => { closed = true; }}
      >
        <button type="button">x</button>
      </WarzBattleDialog>
    );
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(closed).toBe(false);
  });

  it("13. panel click does not close dialog", () => {
    let closed = false;
    render(
      <WarzBattleDialog
        open
        title="t"
        description="d"
        dismissible
        onClose={() => { closed = true; }}
      >
        <button type="button">x</button>
      </WarzBattleDialog>
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(closed).toBe(false);
  });

  it("14. focus returns to supplied control", () => {
    const { rerender } = render(<Harness open dismissible />);
    rerender(<Harness open={false} dismissible />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open trigger" }));
  });

  it("15. key listener is removed on close", () => {
    const removeSpy = jest.spyOn(document, "removeEventListener");
    const { rerender } = render(<Harness open dismissible />);
    rerender(<Harness open={false} dismissible />);
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("16. key listener is removed on unmount", () => {
    const removeSpy = jest.spyOn(document, "removeEventListener");
    const { unmount } = render(<Harness open dismissible />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("17. uses Lucide icon when supplied", () => {
    render(<Harness open dismissible />);
    expect(screen.getByRole("dialog").querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("18. decorative icon is hidden", () => {
    render(<Harness open dismissible />);
    const icon = screen.getByRole("dialog").querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("19. contains no emoji", () => {
    render(<Harness open dismissible />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(screen.getByRole("dialog").textContent || "")).toBe(false);
  });

  it("20. contains no raw hex or RGBA values", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleDialog.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("21. reduced motion removes panel scale", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    render(<Harness open dismissible />);
    const panel = screen.getByRole("dialog") as HTMLElement;
    expect(panel.style.transform).not.toMatch(/scale/);
  });

  it("22. reduced motion removes panel Y movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    render(<Harness open dismissible />);
    const panel = screen.getByRole("dialog") as HTMLElement;
    expect(panel.style.transform).not.toMatch(/translateY/);
  });

  it("23. component performs no request", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleDialog.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(/);
  });

  it("24. component performs no navigation", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleDialog.tsx"), "utf8");
    expect(source).not.toMatch(/useRouter|router\.push|window\.location/);
  });

  it("25. component does not submit a terminal result", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleDialog.tsx"), "utf8");
    expect(source).not.toMatch(/onDone/);
  });
});
