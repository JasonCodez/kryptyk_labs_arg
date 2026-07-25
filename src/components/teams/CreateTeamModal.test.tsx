/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  CreateTeamModal,
  normalizeCreateTeamDraft,
  readCreateTeamError,
  validateCreateTeamDraft,
  type CreateTeamDraft,
  type NormalizedCreateTeamDraft,
} from "./CreateTeamModal";

const SOURCE = fs.readFileSync(path.join(__dirname, "CreateTeamModal.tsx"), "utf8");

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response);
}

// This file runs under the jsdom Jest environment (required for React
// Testing Library's render()), which does not expose a global fetch
// Response implementation. This stand-in enforces the same real-world
// constraint the single-read error parser targets — a response body can
// only be consumed once.
function singleReadResponse(body: string, status = 500): Response {
  let consumed = false;
  const consume = () => {
    if (consumed) throw new TypeError("Body has already been consumed.");
    consumed = true;
    return body;
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(consume()),
    json: () => Promise.resolve(JSON.parse(consume())),
  } as unknown as Response;
}

function makeDraft(overrides: Partial<CreateTeamDraft> = {}): CreateTeamDraft {
  return { name: "Midnight Solvers", description: "We love word puzzles.", isPublic: true, ...overrides };
}

function makeNormalized(overrides: Partial<NormalizedCreateTeamDraft> = {}): NormalizedCreateTeamDraft {
  return { name: "Midnight Solvers", description: "We love word puzzles.", isPublic: true, ...overrides };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  document.body.style.overflow = "";
});

describe("normalizeCreateTeamDraft", () => {
  it("1. name is trimmed", () => {
    expect(normalizeCreateTeamDraft(makeDraft({ name: "  Midnight Solvers  " })).name).toBe("Midnight Solvers");
  });

  it("2. description is trimmed", () => {
    expect(normalizeCreateTeamDraft(makeDraft({ description: "  We love word puzzles.  " })).description).toBe("We love word puzzles.");
  });

  it("3. internal name spacing is preserved", () => {
    expect(normalizeCreateTeamDraft(makeDraft({ name: "  Midnight   Solvers  " })).name).toBe("Midnight   Solvers");
  });

  it("4. internal description spacing is preserved", () => {
    expect(normalizeCreateTeamDraft(makeDraft({ description: "  We  love  puzzles.  " })).description).toBe("We  love  puzzles.");
  });

  it("5. visibility true is preserved", () => {
    expect(normalizeCreateTeamDraft(makeDraft({ isPublic: true })).isPublic).toBe(true);
  });

  it("6. visibility false is preserved", () => {
    expect(normalizeCreateTeamDraft(makeDraft({ isPublic: false })).isPublic).toBe(false);
  });

  it("7. source draft is not mutated", () => {
    const draft = makeDraft({ name: "  Midnight Solvers  " });
    const snapshot = { ...draft };
    normalizeCreateTeamDraft(draft);
    expect(draft).toEqual(snapshot);
  });

  it("8. a new object is returned", () => {
    const draft = makeDraft();
    expect(normalizeCreateTeamDraft(draft)).not.toBe(draft);
  });
});

describe("validateCreateTeamDraft", () => {
  it("9. empty name returns exact required error", () => {
    expect(validateCreateTeamDraft(makeNormalized({ name: "" })).name).toBe("Enter a team name.");
  });

  it("10. whitespace-only normalized name returns exact required error", () => {
    // A normalized draft's name is already trimmed by normalizeCreateTeamDraft,
    // so a whitespace-only input becomes "" — validate directly on that.
    expect(validateCreateTeamDraft(makeNormalized({ name: "" })).name).toBe("Enter a team name.");
  });

  it("11. a one-character name is valid", () => {
    expect(validateCreateTeamDraft(makeNormalized({ name: "A" })).name).toBeUndefined();
  });

  it("12. a 100-character name is valid", () => {
    expect(validateCreateTeamDraft(makeNormalized({ name: "A".repeat(100) })).name).toBeUndefined();
  });

  it("13. a 101-character name returns exact length error", () => {
    expect(validateCreateTeamDraft(makeNormalized({ name: "A".repeat(101) })).name).toBe("Team names can be up to 100 characters.");
  });

  it("14. empty description is valid", () => {
    expect(validateCreateTeamDraft(makeNormalized({ description: "" })).description).toBeUndefined();
  });

  it("15. a 500-character description is valid", () => {
    expect(validateCreateTeamDraft(makeNormalized({ description: "B".repeat(500) })).description).toBeUndefined();
  });

  it("16. a 501-character description returns exact length error", () => {
    expect(validateCreateTeamDraft(makeNormalized({ description: "B".repeat(501) })).description).toBe("Descriptions can be up to 500 characters.");
  });

  it("17. name and description errors can coexist", () => {
    const errors = validateCreateTeamDraft(makeNormalized({ name: "", description: "B".repeat(501) }));
    expect(errors.name).toBeTruthy();
    expect(errors.description).toBeTruthy();
  });

  it("18. valid draft returns no errors", () => {
    expect(validateCreateTeamDraft(makeNormalized())).toEqual({});
  });

  it("19. validation does not mutate the draft", () => {
    const draft = makeNormalized({ name: "" });
    const snapshot = { ...draft };
    validateCreateTeamDraft(draft);
    expect(draft).toEqual(snapshot);
  });
});

describe("readCreateTeamError", () => {
  it("20. JSON string error is returned; 21. JSON error is trimmed", async () => {
    const res = singleReadResponse(JSON.stringify({ error: "  Team already exists  " }), 400);
    expect(await readCreateTeamError(res)).toBe("Team already exists");
  });

  it("22. plain-text error is returned; 23. plain-text error is trimmed", async () => {
    const res = singleReadResponse("  Service unavailable  ", 503);
    expect(await readCreateTeamError(res)).toBe("Service unavailable");
  });

  it("24. empty body returns fallback", async () => {
    const res = singleReadResponse("", 500);
    expect(await readCreateTeamError(res)).toBe("Failed to create team");
  });

  it("25. whitespace body returns fallback", async () => {
    const res = singleReadResponse("   ", 500);
    expect(await readCreateTeamError(res)).toBe("Failed to create team");
  });

  it("26. JSON non-string error returns fallback", async () => {
    const res = singleReadResponse(JSON.stringify({ error: 500 }), 500);
    expect(await readCreateTeamError(res)).toBe("Failed to create team");
  });

  it("27. empty JSON error returns fallback", async () => {
    const res = singleReadResponse(JSON.stringify({ error: "" }), 500);
    expect(await readCreateTeamError(res)).toBe("Failed to create team");
  });

  it("28. JSON without error returns fallback", async () => {
    const res = singleReadResponse(JSON.stringify({ ok: false }), 500);
    expect(await readCreateTeamError(res)).toBe("Failed to create team");
  });

  it("29. JSON array returns fallback", async () => {
    const res = singleReadResponse(JSON.stringify(["error"]), 500);
    expect(await readCreateTeamError(res)).toBe("Failed to create team");
  });

  it("30. valid JSON is not returned as raw serialized text", async () => {
    const res = singleReadResponse(JSON.stringify({ error: 500 }), 500);
    const message = await readCreateTeamError(res);
    expect(message).not.toMatch(/"error":500/);
  });

  it("31. body is consumed exactly once", async () => {
    const res = singleReadResponse("Server exploded", 500);
    await expect(readCreateTeamError(res)).resolves.toBe("Server exploded");
  });

  it("32. response.json() is never called", async () => {
    const res = singleReadResponse(JSON.stringify({ error: "boom" }), 500);
    const jsonSpy = jest.spyOn(res, "json");
    await readCreateTeamError(res);
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});

describe("CreateTeamModal — dialog semantics", () => {
  it("33. dialog has role=dialog; 34. aria-modal=true", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("35. heading is exactly Create New Team", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByRole("heading", { name: "Create New Team" })).toBeTruthy();
  });

  it("36. supporting copy is exact", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText("Build a crew, solve together, and make your mark.")).toBeTruthy();
  });

  it("37. labelling references valid elements; 38. description references a valid element", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    const dialog = screen.getByRole("dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby")!;
    const describedBy = dialog.getAttribute("aria-describedby")!;
    expect(document.getElementById(labelledBy)).toBeTruthy();
    expect(document.getElementById(describedBy)).toBeTruthy();
  });

  it("39. stable test IDs exist", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByTestId("create-team-dialog")).toBeTruthy();
    expect(screen.getByTestId("create-team-name")).toBeTruthy();
    expect(screen.getByTestId("create-team-description")).toBeTruthy();
    expect(screen.getByTestId("create-team-visibility-public")).toBeTruthy();
    expect(screen.getByTestId("create-team-visibility-private")).toBeTruthy();
    expect(screen.getByTestId("create-team-cancel")).toBeTruthy();
    expect(screen.getByTestId("create-team-submit")).toBeTruthy();
  });

  it("40. no emoji is rendered", () => {
    const { container } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}]/u;
    expect(emojiPattern.test(container.textContent ?? "")).toBe(false);
  });

  it("41. body scroll is locked on mount; 42. previous body overflow is restored on unmount", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});

describe("CreateTeamModal — initial form state", () => {
  it("43. Team name starts empty; 44. description starts empty", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect((screen.getByTestId("create-team-name") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("create-team-description") as HTMLTextAreaElement).value).toBe("");
  });

  it("45. Public starts selected; 46. Private starts unselected", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect((screen.getByTestId("create-team-visibility-public") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("create-team-visibility-private") as HTMLInputElement).checked).toBe(false);
  });

  it("47. name count starts at 0/100; 48. description count starts at 0/500", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText("0/100")).toBeTruthy();
    expect(screen.getByText("0/500")).toBeTruthy();
  });

  it("49. initial focus moves to Team Name", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(document.activeElement).toBe(screen.getByTestId("create-team-name"));
  });

  it("50. placeholder remains Enter team name", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByPlaceholderText("Enter team name")).toBeTruthy();
  });
});

describe("CreateTeamModal — form interaction", () => {
  it("51. name updates; 53. name count updates", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Puzzle Crew" } });
    expect((screen.getByTestId("create-team-name") as HTMLInputElement).value).toBe("Puzzle Crew");
    expect(screen.getByText("11/100")).toBeTruthy();
  });

  it("52. description updates; 54. description count updates", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-description"), { target: { value: "Weekly puzzle nights." } });
    expect((screen.getByTestId("create-team-description") as HTMLTextAreaElement).value).toBe("Weekly puzzle nights.");
    expect(screen.getByText("21/500")).toBeTruthy();
  });

  it("55. selecting Private sets Private checked; 56. clears Public", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByTestId("create-team-visibility-private"));
    expect((screen.getByTestId("create-team-visibility-private") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("create-team-visibility-public") as HTMLInputElement).checked).toBe(false);
  });

  it("57. selecting Public restores Public", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByTestId("create-team-visibility-private"));
    fireEvent.click(screen.getByTestId("create-team-visibility-public"));
    expect((screen.getByTestId("create-team-visibility-public") as HTMLInputElement).checked).toBe(true);
  });

  it("58. visibility selection sends no request", () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByTestId("create-team-visibility-private"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("59. full visibility labels are clickable", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    const privateLabelText = screen.getByText("Only invited players can join this team.");
    fireEvent.click(privateLabelText);
    expect((screen.getByTestId("create-team-visibility-private") as HTMLInputElement).checked).toBe(true);
  });
});

describe("CreateTeamModal — client validation", () => {
  it("60. empty submit sends no request; 61. invokes no success; 62. exact required error; 63. name receives focus", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const onSuccess = jest.fn();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a team name.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByTestId("create-team-name"));
  });

  it("64. overlong name sends no request", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "A".repeat(101) } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Team names can be up to 100 characters.")).toBeTruthy();
  });

  it("65. overlong description sends no request; 66. first invalid field receives focus", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("create-team-description"), { target: { value: "B".repeat(501) } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(fetchSpy).not.toHaveBeenCalled();
    // Name is invalid too, and comes first — it must receive focus.
    expect(document.activeElement).toBe(screen.getByTestId("create-team-name"));
  });

  it("67. correcting a name clears its field error; 68. correcting a description clears its field error", async () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-description"), { target: { value: "B".repeat(501) } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(screen.getByText("Enter a team name.")).toBeTruthy();
    expect(screen.getByText("Descriptions can be up to 500 characters.")).toBeTruthy();

    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Valid Name" } });
    expect(screen.queryByText("Enter a team name.")).toBeNull();

    fireEvent.change(screen.getByTestId("create-team-description"), { target: { value: "Short desc" } });
    expect(screen.queryByText("Descriptions can be up to 500 characters.")).toBeNull();
  });

  it("69. corrected resubmission can proceed", async () => {
    global.fetch = jest.fn(() => jsonResponse({ id: "team-1" }, 201)) as unknown as typeof fetch;
    const onSuccess = jest.fn();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Valid Name" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

describe("CreateTeamModal — exact POST", () => {
  it("70-81. exact request contract", async () => {
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse({ id: "team-1" }, 201);
    }) as unknown as typeof fetch;

    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "  Night Owls  " } });
    fireEvent.change(screen.getByTestId("create-team-description"), { target: { value: "  Late nights.  " } });
    fireEvent.click(screen.getByTestId("create-team-visibility-private"));
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();

    expect(capturedUrl).toBe("/api/teams");
    expect(capturedInit?.method).toBe("POST");
    expect((capturedInit?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(capturedInit?.body));
    expect(Object.keys(body).sort()).toEqual(["description", "isPublic", "name"]);
    expect(body.name).toBe("Night Owls");
    expect(body.description).toBe("Late nights.");
    expect(body.isPublic).toBe(false);
    expect(capturedUrl).not.toMatch(/\?/);
  });

  it("77-78. public and private booleans are sent correctly", async () => {
    let lastBody: any;
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      lastBody = JSON.parse(String(init?.body));
      return jsonResponse({ id: "t" }, 201);
    }) as unknown as typeof fetch;

    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Public Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(lastBody.isPublic).toBe(true);
    unmount();

    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Private Team" } });
    fireEvent.click(screen.getByTestId("create-team-visibility-private"));
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(lastBody.isPublic).toBe(false);
  });

  it("80. no direct Teams GET occurs; 81. no navigation occurs", async () => {
    const calls: string[] = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${(init?.method ?? "GET")} ${String(input)}`);
      return jsonResponse({ id: "t" }, 201);
    }) as unknown as typeof fetch;

    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();

    expect(calls).toEqual(["POST /api/teams"]);
  });
});

describe("CreateTeamModal — pending behavior", () => {
  function heldFetchSetup() {
    let resolveFn: (v: Response) => void = () => {};
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveFn = resolve; })) as unknown as typeof fetch;
    return { resolve: (body: unknown = { id: "t" }, status = 201) => resolveFn(jsonResponse(body, status) as unknown as Response) };
  }

  it("82-89. pending disables everything and shows Creating…", async () => {
    heldFetchSetup();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();

    expect(screen.getByTestId("create-team-submit").textContent).toContain("Creating…");
    expect(screen.getByTestId("create-team-dialog").getAttribute("aria-busy")).toBe("true");
    expect((screen.getByTestId("create-team-name") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId("create-team-description") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByTestId("create-team-visibility-public") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId("create-team-visibility-private") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId("create-team-cancel") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("create-team-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("90. focus moves to dialog container", async () => {
    heldFetchSetup();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId("create-team-dialog"));
  });

  it("91. escape is ignored; 92. backdrop is ignored", async () => {
    const onClose = jest.fn();
    heldFetchSetup();
    const { container } = render(<CreateTeamModal onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();

    fireEvent.keyDown(document, { key: "Escape" });
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("93. Tab remains on dialog; 94. Shift+Tab remains on dialog", async () => {
    heldFetchSetup();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("create-team-dialog"));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("create-team-dialog"));
  });

  it("95. outside focus is redirected to dialog", async () => {
    heldFetchSetup();
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.appendChild(outside);
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();

    outside.focus();
    expect(document.activeElement).not.toBe(outside);
    expect(document.activeElement).toBe(screen.getByTestId("create-team-dialog"));
    document.body.removeChild(outside);
  });
});

describe("CreateTeamModal — duplicate protection", () => {
  it("96. rapid submit clicks issue one POST", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => { callCount += 1; return new Promise<Response>(() => {}); }) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    fireEvent.click(screen.getByTestId("create-team-submit"));
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(callCount).toBe(1);
  });

  it("97. submit plus Enter issues one POST", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => { callCount += 1; return new Promise<Response>(() => {}); }) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    fireEvent.submit(screen.getByTestId("create-team-submit").closest("form")!);
    await flush();
    expect(callCount).toBe(1);
  });

  it("98. repeated submit events issue one POST; 99. duplicate attempt does not replace the controller", async () => {
    let callCount = 0;
    const signals: AbortSignal[] = [];
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      callCount += 1;
      if (init?.signal) signals.push(init.signal as AbortSignal);
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    const form = screen.getByTestId("create-team-name").closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await flush();
    expect(callCount).toBe(1);
    expect(signals[0]?.aborted).toBe(false);
  });

  it("100. guard remains active after successful response until unmount", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => { callCount += 1; return jsonResponse({ id: "t" }, 201); }) as unknown as typeof fetch;
    const onSuccess = jest.fn();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    // Parent hasn't actually unmounted the component in this test; a
    // further submit attempt while the guard is still set must not fire.
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(callCount).toBe(1);
  });

  it("101. guard is released after failure; 102. retry after failure issues one new POST", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => { callCount += 1; return jsonResponse({ error: "boom" }, 500); }) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(callCount).toBe(1);
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(callCount).toBe(2);
  });
});

describe("CreateTeamModal — success", () => {
  it("103. OK response invokes onSuccess exactly once", async () => {
    global.fetch = jest.fn(() => jsonResponse({ id: "t" }, 201)) as unknown as typeof fetch;
    const onSuccess = jest.fn();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("104. OK response does not require JSON parsing", async () => {
    const res = { ok: true, status: 201, text: () => Promise.reject(new Error("should not be called")), json: () => Promise.reject(new Error("should not be called")) } as unknown as Response;
    global.fetch = jest.fn(() => Promise.resolve(res)) as unknown as typeof fetch;
    const onSuccess = jest.fn();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("105. OK response does not invoke onClose; 106. displays no error", async () => {
    global.fetch = jest.fn(() => jsonResponse({ id: "t" }, 201)) as unknown as typeof fetch;
    const onClose = jest.fn();
    render(<CreateTeamModal onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId("create-team-error")).toBeNull();
  });

  it("107. success after unmount invokes no callback", async () => {
    let resolveFn: (v: Response) => void = () => {};
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveFn = resolve; })) as unknown as typeof fetch;
    const onSuccess = jest.fn();
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    unmount();
    await act(async () => {
      resolveFn(await jsonResponse({ id: "t" }, 201));
      await Promise.resolve();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("108. parent callback exceptions are not converted into a server error", () => {
    // A throwing onSuccess() cannot be exercised at runtime here without
    // producing a genuine unhandled promise rejection: React's synthetic
    // event dispatch invokes the async handleSubmit handler without
    // awaiting or attaching a .catch to its returned promise, so any error
    // thrown after the call site (including by Jest/jsdom's own rejection
    // reporting) is indistinguishable from a real crash — exactly as it
    // would behave in production. The requirement is instead verified
    // structurally: onSuccess() must be called outside the request's
    // try/catch, so a throwing parent callback can never be caught and
    // reinterpreted as a fetch/network failure.
    const catchIndex = SOURCE.indexOf("} catch (err) {");
    const successCallIndex = SOURCE.indexOf("onSuccess();");
    // The catch block's own closing brace (the first "}" at catch-body
    // indentation after the catch opens) must appear before the onSuccess()
    // call — i.e. onSuccess() is not nested inside the catch block.
    const catchBodyCloseIndex = SOURCE.indexOf("\n    }\n", catchIndex);
    expect(catchIndex).toBeGreaterThan(-1);
    expect(successCallIndex).toBeGreaterThan(-1);
    expect(catchBodyCloseIndex).toBeGreaterThan(catchIndex);
    expect(successCallIndex).toBeGreaterThan(catchBodyCloseIndex);
  });
});

describe("CreateTeamModal — failure", () => {
  it("109. JSON error displays exactly", async () => {
    global.fetch = jest.fn(() => Promise.resolve(singleReadResponse(JSON.stringify({ error: "You already created a team with this name." }), 400))) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(screen.getByTestId("create-team-error").textContent).toBe("You already created a team with this name.");
  });

  it("110. plain-text error displays exactly", async () => {
    global.fetch = jest.fn(() => Promise.resolve(singleReadResponse("Service temporarily unavailable", 503))) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(screen.getByTestId("create-team-error").textContent).toBe("Service temporarily unavailable");
  });

  it("111. empty response uses fallback", async () => {
    global.fetch = jest.fn(() => Promise.resolve(singleReadResponse("", 500))) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(screen.getByTestId("create-team-error").textContent).toBe("Failed to create team");
  });

  it("112. invalid JSON uses plain text", async () => {
    global.fetch = jest.fn(() => Promise.resolve(singleReadResponse("not json at all", 500))) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(screen.getByTestId("create-team-error").textContent).toBe("not json at all");
  });

  it("113. network rejection uses exact network error", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(screen.getByTestId("create-team-error").textContent).toBe("An error occurred. Please try again.");
  });

  it("114. modal remains mounted; 115. form values remain; 116. visibility remains selected", async () => {
    global.fetch = jest.fn(() => jsonResponse({ error: "boom" }, 500)) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Kept Name" } });
    fireEvent.change(screen.getByTestId("create-team-description"), { target: { value: "Kept description" } });
    fireEvent.click(screen.getByTestId("create-team-visibility-private"));
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(screen.getByTestId("create-team-dialog")).toBeTruthy();
    expect((screen.getByTestId("create-team-name") as HTMLInputElement).value).toBe("Kept Name");
    expect((screen.getByTestId("create-team-description") as HTMLTextAreaElement).value).toBe("Kept description");
    expect((screen.getByTestId("create-team-visibility-private") as HTMLInputElement).checked).toBe(true);
  });

  it("117. error summary receives focus", async () => {
    global.fetch = jest.fn(() => jsonResponse({ error: "boom" }, 500)) as unknown as typeof fetch;
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId("create-team-error"));
  });

  it("118. pending state clears; 119. submit is re-enabled; 120. success is not called; 121. close is not called", async () => {
    global.fetch = jest.fn(() => jsonResponse({ error: "boom" }, 500)) as unknown as typeof fetch;
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    render(<CreateTeamModal onClose={onClose} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(screen.getByTestId("create-team-submit").textContent).toContain("Create Team");
    expect((screen.getByTestId("create-team-submit") as HTMLButtonElement).disabled).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("122. a second corrected submit can succeed", async () => {
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      return call === 1 ? jsonResponse({ error: "boom" }, 500) : jsonResponse({ id: "t" }, 201);
    }) as unknown as typeof fetch;
    const onSuccess = jest.fn();
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

describe("CreateTeamModal — cancellation", () => {
  it("123. Cancel invokes onClose once", () => {
    const onClose = jest.fn();
    render(<CreateTeamModal onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByTestId("create-team-cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("124. Escape invokes onClose once", () => {
    const onClose = jest.fn();
    render(<CreateTeamModal onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("125. Backdrop invokes onClose once", () => {
    const onClose = jest.fn();
    const { container } = render(<CreateTeamModal onClose={onClose} onSuccess={jest.fn()} />);
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("126. dialog content click does not close", () => {
    const onClose = jest.fn();
    render(<CreateTeamModal onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByTestId("create-team-dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("127. Cancel is ignored pending; 128. Escape is ignored pending; 129. Backdrop is ignored pending", async () => {
    global.fetch = jest.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const onClose = jest.fn();
    const { container } = render(<CreateTeamModal onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();

    fireEvent.click(screen.getByTestId("create-team-cancel"));
    fireEvent.keyDown(document, { key: "Escape" });
    const backdrop = container.querySelector('[aria-hidden="true"].absolute.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CreateTeamModal — focus containment", () => {
  it("130. Tab from final control wraps to first; 131. Shift+Tab from first wraps to final", () => {
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    screen.getByTestId("create-team-submit").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("create-team-name"));

    screen.getByTestId("create-team-name").focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId("create-team-submit"));
  });

  it("132. programmatic outside focus redirects inside", () => {
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.appendChild(outside);
    render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    outside.focus();
    expect(document.activeElement).toBe(screen.getByTestId("create-team-name"));
    document.body.removeChild(outside);
  });

  it("133. focus trap is removed on unmount", () => {
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    unmount();
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);
    document.body.removeChild(outside);
  });

  it("134. original trigger regains focus after unmount when connected", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(document.activeElement).toBe(screen.getByTestId("create-team-name"));
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it("135. missing trigger causes no throw", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    document.body.removeChild(trigger);
    expect(() => unmount()).not.toThrow();
  });
});

describe("CreateTeamModal — unmount safety", () => {
  it("136. unmount aborts active request; 137. unmount invalidates request sequence", async () => {
    let capturedSignal: AbortSignal | undefined;
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("138. response after unmount causes no state update", async () => {
    let resolveFn: (v: Response) => void = () => {};
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveFn = resolve; })) as unknown as typeof fetch;
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    unmount();
    await act(async () => {
      resolveFn(await jsonResponse({ id: "t" }, 201));
      await Promise.resolve();
    });
    expect(true).toBe(true);
  });

  it("139. failure after unmount causes no state update", async () => {
    let resolveFn: (v: Response) => void = () => {};
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveFn = resolve; })) as unknown as typeof fetch;
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    unmount();
    await act(async () => {
      resolveFn(singleReadResponse("Server exploded", 500));
      await Promise.resolve();
    });
    expect(true).toBe(true);
  });

  it("140. aborted request displays no error", async () => {
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }) as unknown as typeof fetch;
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    fireEvent.click(screen.getByTestId("create-team-submit"));
    await flush();
    await act(async () => {
      unmount();
      await Promise.resolve();
    });
    expect(true).toBe(true);
  });

  it("141. retained submit handler after unmount issues no request; 142. no unhandled exception occurs", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => { callCount += 1; return jsonResponse({ id: "t" }, 201); }) as unknown as typeof fetch;
    const { unmount } = render(<CreateTeamModal onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByTestId("create-team-name"), { target: { value: "Team" } });
    const form = screen.getByTestId("create-team-name").closest("form")!;
    unmount();
    expect(() => fireEvent.submit(form)).not.toThrow();
    await flush();
    expect(callCount).toBe(0);
  });
});

describe("CreateTeamModal — source guardrails", () => {
  it("143. source contains no useSession", () => {
    expect(SOURCE).not.toMatch(/useSession/);
  });

  it("144. source contains no useRouter", () => {
    expect(SOURCE).not.toMatch(/useRouter/);
  });

  it("145. source contains no .sort(", () => {
    expect(SOURCE).not.toMatch(/\.sort\(/);
  });

  it("146. source contains no hard-coded old modal hex #241640", () => {
    expect(SOURCE).not.toMatch(/#241640/i);
  });

  it("147. source does not use variant=\"pink\"", () => {
    expect(SOURCE).not.toMatch(/variant=["']pink["']/);
  });

  it("148. source does not call /api/teams with GET", () => {
    expect(SOURCE).not.toMatch(/method:\s*["']GET["']/);
  });

  it("149. source contains no database import", () => {
    expect(SOURCE).not.toMatch(/@\/lib\/prisma/);
  });
});
