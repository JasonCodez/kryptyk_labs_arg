/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { getThemeConfig } from "@/lib/profileThemes";
import TeamMemberRemovalDialog, {
  TeamMemberRemoveButton,
  getRemovalMemberDisplayName,
  type RemovableTeamMember,
  type TeamMemberRemovalDialogProps,
} from "./TeamMemberRemovalDialog";

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamMemberRemovalDialog.tsx"), "utf8");
const theme = getThemeConfig("default");

function makeMember(overrides: Partial<RemovableTeamMember["user"]> = {}): RemovableTeamMember {
  return {
    user: { id: "u1", name: "Jane Doe", email: "jane@example.test", image: null, ...overrides },
    role: "member",
  };
}

function makeDialogProps(overrides: Partial<TeamMemberRemovalDialogProps> = {}): TeamMemberRemovalDialogProps {
  return {
    isOpen: true,
    member: makeMember(),
    pending: false,
    theme,
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
}

describe("getRemovalMemberDisplayName", () => {
  it("name is preferred over email", () => {
    expect(getRemovalMemberDisplayName(makeMember({ name: "Jane", email: "jane@test.test" }))).toBe("Jane");
  });

  it("email is used when name is absent", () => {
    expect(getRemovalMemberDisplayName(makeMember({ name: null, email: "jane@test.test" }))).toBe("jane@test.test");
  });

  it("Member is used when both are absent", () => {
    expect(getRemovalMemberDisplayName(makeMember({ name: null, email: null }))).toBe("Member");
    expect(getRemovalMemberDisplayName(null)).toBe("Member");
  });

  it("name is trimmed", () => {
    expect(getRemovalMemberDisplayName(makeMember({ name: "  Jane  " }))).toBe("Jane");
  });

  it("email is trimmed", () => {
    expect(getRemovalMemberDisplayName(makeMember({ name: null, email: "  jane@test.test  " }))).toBe("jane@test.test");
  });

  it("input member is not mutated", () => {
    const member = makeMember({ name: "  Jane  " });
    const snapshot = JSON.parse(JSON.stringify(member));
    getRemovalMemberDisplayName(member);
    expect(member).toEqual(snapshot);
  });
});

describe("TeamMemberRemoveButton", () => {
  it("visible text is Remove", () => {
    render(<TeamMemberRemoveButton memberId="u1" displayName="Jane Doe" onRequestRemove={jest.fn()} />);
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("accessible name identifies the member", () => {
    render(<TeamMemberRemoveButton memberId="u1" displayName="Jane Doe" onRequestRemove={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Remove Jane Doe from team" })).toBeTruthy();
  });

  it('uses type="button"', () => {
    render(<TeamMemberRemoveButton memberId="u1" displayName="Jane Doe" onRequestRemove={jest.fn()} />);
    expect((screen.getByTestId("team-member-remove-u1") as HTMLButtonElement).type).toBe("button");
  });

  it("has a 44px minimum target", () => {
    render(<TeamMemberRemoveButton memberId="u1" displayName="Jane Doe" onRequestRemove={jest.fn()} />);
    expect(screen.getByTestId("team-member-remove-u1").className).toMatch(/min-h-11/);
  });

  it("has a visible focus class", () => {
    render(<TeamMemberRemoveButton memberId="u1" displayName="Jane Doe" onRequestRemove={jest.fn()} />);
    expect(screen.getByTestId("team-member-remove-u1").className).toMatch(/focus-visible:ring/);
  });

  it("stable test ID includes the member ID", () => {
    render(<TeamMemberRemoveButton memberId="member-42" displayName="Jane Doe" onRequestRemove={jest.fn()} />);
    expect(screen.getByTestId("team-member-remove-member-42")).toBeTruthy();
  });

  it("invokes onRequestRemove with the correct ID", () => {
    const onRequestRemove = jest.fn();
    render(<TeamMemberRemoveButton memberId="member-42" displayName="Jane Doe" onRequestRemove={onRequestRemove} />);
    fireEvent.click(screen.getByTestId("team-member-remove-member-42"));
    expect(onRequestRemove).toHaveBeenCalledWith("member-42");
  });

  it("disabled button does not invoke callback", () => {
    const onRequestRemove = jest.fn();
    render(<TeamMemberRemoveButton memberId="member-42" displayName="Jane Doe" disabled onRequestRemove={onRequestRemove} />);
    fireEvent.click(screen.getByTestId("team-member-remove-member-42"));
    expect(onRequestRemove).not.toHaveBeenCalled();
  });

  it("decorative icon is hidden from assistive technology", () => {
    const { container } = render(<TeamMemberRemoveButton memberId="u1" displayName="Jane Doe" onRequestRemove={jest.fn()} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not call fetch", () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    render(<TeamMemberRemoveButton memberId="u1" displayName="Jane Doe" onRequestRemove={jest.fn()} />);
    fireEvent.click(screen.getByTestId("team-member-remove-u1"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("TeamMemberRemovalDialog — closed states", () => {
  it("closed dialog renders nothing", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps({ isOpen: false })} />);
    expect(screen.queryByTestId("team-member-removal-dialog")).toBeNull();
  });

  it("null target renders nothing", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps({ member: null })} />);
    expect(screen.queryByTestId("team-member-removal-dialog")).toBeNull();
  });
});

describe("TeamMemberRemovalDialog — open dialog", () => {
  it('exposes exactly one role="dialog"', () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it('exposes aria-modal="true"', () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("has valid labelled-by and described-by references", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    const dialog = screen.getByRole("dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby")!;
    const describedBy = dialog.getAttribute("aria-describedby")!;
    expect(document.getElementById(labelledBy)).toBeTruthy();
    expect(document.getElementById(describedBy)).toBeTruthy();
  });

  it("heading is exactly Remove member", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(screen.getByRole("heading", { name: "Remove member" })).toBeTruthy();
  });

  it("message contains the exact target display name", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps({ member: makeMember({ name: "Jane Doe" }) })} />);
    expect(screen.getByText("Are you sure you want to remove Jane Doe from the team?")).toBeTruthy();
  });

  it("cancel button exists", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-member-removal-cancel")).toBeTruthy();
  });

  it("remove button exists", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-member-removal-confirm")).toBeTruthy();
  });

  it('both buttons use type="button"', () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect((screen.getByTestId("team-member-removal-cancel") as HTMLButtonElement).type).toBe("button");
    expect((screen.getByTestId("team-member-removal-confirm") as HTMLButtonElement).type).toBe("button");
  });

  it("both buttons retain 44px minimum targets", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-member-removal-cancel").className).toMatch(/min-h-11/);
    expect(screen.getByTestId("team-member-removal-confirm").className).toMatch(/min-h-11/);
  });

  it("stable dialog/action test IDs are present", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(screen.getByTestId("team-member-removal-dialog")).toBeTruthy();
    expect(screen.getByTestId("team-member-removal-cancel")).toBeTruthy();
    expect(screen.getByTestId("team-member-removal-confirm")).toBeTruthy();
  });
});

describe("TeamMemberRemovalDialog — interaction", () => {
  it("cancel invokes only onCancel", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<TeamMemberRemovalDialog {...makeDialogProps({ onCancel, onConfirm })} />);
    fireEvent.click(screen.getByTestId("team-member-removal-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirm invokes only onConfirm", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<TeamMemberRemovalDialog {...makeDialogProps({ onCancel, onConfirm })} />);
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("escape invokes only onCancel", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<TeamMemberRemovalDialog {...makeDialogProps({ onCancel, onConfirm })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("backdrop invokes only onCancel", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { container } = render(<TeamMemberRemovalDialog {...makeDialogProps({ onCancel, onConfirm })} />);
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("focus moves into the dialog", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-member-removal-cancel"));
  });

  it("cancel receives initial focus", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps()} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-member-removal-cancel"));
  });

  it("focus returns to the trigger after cancellation when possible", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(<TeamMemberRemovalDialog {...makeDialogProps({ isOpen: false })} />);
    // Opening happens after the trigger already has focus, mirroring real usage.
    trigger.focus();
    rerender(<TeamMemberRemovalDialog {...makeDialogProps({ isOpen: true })} />);
    expect(document.activeElement).toBe(screen.getByTestId("team-member-removal-cancel"));

    rerender(<TeamMemberRemovalDialog {...makeDialogProps({ isOpen: false })} />);
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });
});

describe("TeamMemberRemovalDialog — pending state", () => {
  it('dialog exposes aria-busy="true"', () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps({ pending: true })} />);
    expect(screen.getByTestId("team-member-removal-dialog").getAttribute("aria-busy")).toBe("true");
  });

  it("confirm label becomes Removing…", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps({ pending: true })} />);
    expect(screen.getByTestId("team-member-removal-confirm").textContent).toContain("Removing…");
  });

  it("confirm is disabled", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps({ pending: true })} />);
    expect((screen.getByTestId("team-member-removal-confirm") as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancel is disabled", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps({ pending: true })} />);
    expect((screen.getByTestId("team-member-removal-cancel") as HTMLButtonElement).disabled).toBe(true);
  });

  it("backdrop cannot dismiss", () => {
    const onCancel = jest.fn();
    const { container } = render(<TeamMemberRemovalDialog {...makeDialogProps({ pending: true, onCancel })} />);
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("escape cannot dismiss", () => {
    const onCancel = jest.fn();
    render(<TeamMemberRemovalDialog {...makeDialogProps({ pending: true, onCancel })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("disabled controls do not invoke callbacks", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<TeamMemberRemovalDialog {...makeDialogProps({ pending: true, onCancel, onConfirm })} />);
    fireEvent.click(screen.getByTestId("team-member-removal-cancel"));
    fireEvent.click(screen.getByTestId("team-member-removal-confirm"));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("layout test classes remain present while pending", () => {
    render(<TeamMemberRemovalDialog {...makeDialogProps({ pending: true })} />);
    expect(screen.getByTestId("team-member-removal-cancel").className).toMatch(/min-h-11/);
    expect(screen.getByTestId("team-member-removal-confirm").className).toMatch(/min-h-11/);
  });
});

describe("TeamMemberRemovalDialog — purity", () => {
  it("source contains no direct fetch(", () => {
    expect(SOURCE).not.toMatch(/\bfetch\(/);
  });

  it("source contains no useSession", () => {
    expect(SOURCE).not.toMatch(/useSession/);
  });

  it("source contains no useRouter", () => {
    expect(SOURCE).not.toMatch(/useRouter/);
  });

  it("source contains no .sort(", () => {
    expect(SOURCE).not.toMatch(/\.sort\(/);
  });

  it("supplied member is not mutated during rendering or interaction", () => {
    const member = makeMember();
    const snapshot = JSON.parse(JSON.stringify(member));
    render(<TeamMemberRemovalDialog {...makeDialogProps({ member })} />);
    fireEvent.click(screen.getByTestId("team-member-removal-cancel"));
    expect(member).toEqual(snapshot);
  });
});
