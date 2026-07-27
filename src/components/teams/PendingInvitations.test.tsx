/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import PendingInvitations, {
  normalizePendingInvitations,
  type TeamInvitation,
} from "./PendingInvitations";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

const FAR_FUTURE = "2099-01-07T00:00:00.000Z";
const PAST_CREATED = "2026-01-01T00:00:00.000Z";

const VALID_INVITATION = {
  id: "inv-1",
  teamId: "team-1",
  status: "pending",
  expiresAt: FAR_FUTURE,
  createdAt: PAST_CREATED,
  team: {
    id: "team-1",
    name: "Alpha Team",
    description: "A team of solvers",
    members: [
      { id: "member-row-1", user: { id: "member-1", name: "Member One", image: null } },
    ],
  },
};

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("normalizePendingInvitations", () => {
  test("non-array payload returns []", () => {
    expect(normalizePendingInvitations({ not: "an array" })).toEqual([]);
    expect(normalizePendingInvitations(null)).toEqual([]);
    expect(normalizePendingInvitations(undefined)).toEqual([]);
  });

  test("non-object rows are dropped", () => {
    expect(normalizePendingInvitations([null, "invalid", 42, VALID_INVITATION])).toEqual([
      VALID_INVITATION,
    ]);
  });

  test("missing or blank invitation IDs are dropped", () => {
    expect(
      normalizePendingInvitations([
        { ...VALID_INVITATION, id: "" },
        { ...VALID_INVITATION, id: "   " },
        { ...VALID_INVITATION, id: undefined },
      ])
    ).toEqual([]);
  });

  test("invalid dates are dropped safely", () => {
    expect(
      normalizePendingInvitations([{ ...VALID_INVITATION, expiresAt: "not-a-date" }])
    ).toEqual([]);
    expect(
      normalizePendingInvitations([{ ...VALID_INVITATION, createdAt: "not-a-date" }])
    ).toEqual([]);
  });

  test("malformed teams are dropped", () => {
    expect(normalizePendingInvitations([{ ...VALID_INVITATION, team: null }])).toEqual([]);
    expect(
      normalizePendingInvitations([{ ...VALID_INVITATION, team: { ...VALID_INVITATION.team, id: "" } }])
    ).toEqual([]);
    expect(
      normalizePendingInvitations([
        { ...VALID_INVITATION, team: { ...VALID_INVITATION.team, members: "nope" } },
      ])
    ).toEqual([]);
  });

  test("malformed member rows are dropped", () => {
    const result = normalizePendingInvitations([
      {
        ...VALID_INVITATION,
        team: {
          ...VALID_INVITATION.team,
          members: [
            { id: "member-row-1", user: { id: "member-1", name: "Member One", image: null } },
            { id: "member-row-2", user: null },
            null,
          ],
        },
      },
    ]);
    expect(result[0].team.members).toEqual([
      { id: "member-row-1", user: { id: "member-1", name: "Member One", image: null } },
    ]);
  });

  test("valid invitation order is preserved", () => {
    const second = { ...VALID_INVITATION, id: "inv-2" };
    const result = normalizePendingInvitations([VALID_INVITATION, second]);
    expect(result.map((inv) => inv.id)).toEqual(["inv-1", "inv-2"]);
  });

  test("valid member order is preserved", () => {
    const invitation = {
      ...VALID_INVITATION,
      team: {
        ...VALID_INVITATION.team,
        members: [
          { id: "m1", user: { id: "u1", name: "A", image: null } },
          { id: "m2", user: { id: "u2", name: "B", image: null } },
        ],
      },
    };
    const result = normalizePendingInvitations([invitation]);
    expect(result[0].team.members.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  test("input objects are not mutated", () => {
    const original = JSON.parse(JSON.stringify(VALID_INVITATION));
    normalizePendingInvitations([VALID_INVITATION]);
    expect(VALID_INVITATION).toEqual(original);
  });

  test("public fields normalize correctly", () => {
    const result = normalizePendingInvitations([VALID_INVITATION]);
    expect(result).toEqual([VALID_INVITATION]);
  });

  test("privacy normalizer strips all injected private fields", () => {
    const contaminated = {
      id: "inv-1",
      teamId: "team-1",
      userId: "root-private@example.test",
      invitedBy: "admin-private@example.test",
      status: "pending",
      expiresAt: FAR_FUTURE,
      createdAt: PAST_CREATED,
      user: { id: "invitee-1", name: "Invitee", email: "invitee-private@example.test" },
      team: {
        id: "team-1",
        name: "Alpha Team",
        description: "A team",
        email: "team-private@example.test",
        members: [
          {
            id: "member-row-1",
            email: "member-row-private@example.test",
            user: {
              id: "member-1",
              name: "Member One",
              email: "member-private@example.test",
              image: null,
              password: "shh",
              provider: "credentials",
              token: "secret-token",
            },
          },
        ],
      },
    };

    const result = normalizePendingInvitations([contaminated]);
    expect(result).toEqual([
      {
        id: "inv-1",
        teamId: "team-1",
        status: "pending",
        expiresAt: FAR_FUTURE,
        createdAt: PAST_CREATED,
        team: {
          id: "team-1",
          name: "Alpha Team",
          description: "A team",
          members: [
            { id: "member-row-1", user: { id: "member-1", name: "Member One", image: null } },
          ],
        },
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private@example\.test/);
  });
});

describe("<PendingInvitations />", () => {
  test("closed tray renders nothing and performs no fetch", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(<PendingInvitations isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("open tray fetches, renders team info, and hides private fields", async () => {
    const fetchMock = jest.fn(() => jsonResponse([VALID_INVITATION]));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<PendingInvitations isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/teams/invitations");
    expect(screen.getByText("Alpha Team")).toBeTruthy();
    expect(screen.getByText("A team of solvers")).toBeTruthy();
    expect(screen.getByText("1 member")).toBeTruthy();
  });

  test("nameless member avatar uses 'Member' fallback", async () => {
    const namelessInvitation: TeamInvitation = {
      ...VALID_INVITATION,
      team: {
        ...VALID_INVITATION.team,
        members: [{ id: "member-row-1", user: { id: "member-1", name: null, image: null } }],
      },
    };
    global.fetch = jest.fn(() => jsonResponse([namelessInvitation])) as unknown as typeof fetch;

    render(<PendingInvitations isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    const avatar = screen.getByAltText("Member");
    expect(avatar).toBeTruthy();
    expect(avatar.getAttribute("title")).toBe("Member");
  });

  test("non-OK response clears invitations and shows the empty state", async () => {
    global.fetch = jest.fn(() => jsonResponse({ error: "fail" }, 500)) as unknown as typeof fetch;

    render(<PendingInvitations isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("No pending invitations")).toBeTruthy();
  });

  test("accept sends the exact request and removes/refreshes the invitation", async () => {
    let callCount = 0;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/teams/invitations")) {
        callCount += 1;
        return jsonResponse(callCount === 1 ? [VALID_INVITATION] : []);
      }
      return jsonResponse({ message: "Invitation accepted", teamId: "team-1" });
    }) as unknown as typeof fetch;

    render(<PendingInvitations isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Accept"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const actionCall = calls.find((c) => c.url.endsWith("/api/teams/invitations/inv-1"));
    expect(actionCall).toBeTruthy();
    expect(actionCall!.init?.method).toBe("POST");
    expect((actionCall!.init?.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
    expect(JSON.parse(String(actionCall!.init?.body))).toEqual({
      invitationId: "inv-1",
      action: "accept",
    });
    expect(screen.getByText("No pending invitations")).toBeTruthy();
  });

  test("decline sends the exact request with action decline", async () => {
    let callCount = 0;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/teams/invitations")) {
        callCount += 1;
        return jsonResponse(callCount === 1 ? [VALID_INVITATION] : []);
      }
      return jsonResponse({ message: "Invitation declined" });
    }) as unknown as typeof fetch;

    render(<PendingInvitations isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Decline"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const actionCall = calls.find((c) => c.url.endsWith("/api/teams/invitations/inv-1"));
    expect(JSON.parse(String(actionCall!.init?.body))).toEqual({
      invitationId: "inv-1",
      action: "decline",
    });
  });

  test("processing state disables the action buttons for that invitation", async () => {
    let resolveAction: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/teams/invitations")) {
        return jsonResponse([VALID_INVITATION]);
      }
      return new Promise<Response>((resolve) => {
        resolveAction = resolve;
      });
    }) as unknown as typeof fetch;

    render(<PendingInvitations isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText("Accept"));
    await act(async () => {
      await Promise.resolve();
    });

    expect((screen.getByText("Accept").closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Decline").closest("button") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      resolveAction(await jsonResponse({ message: "Invitation accepted", teamId: "team-1" }));
      await Promise.resolve();
    });
  });

  test("privacy rendering: injected emails never reach the DOM", async () => {
    const contaminated = {
      id: "inv-1",
      teamId: "team-1",
      userId: "root-private@example.test",
      status: "pending",
      expiresAt: FAR_FUTURE,
      createdAt: PAST_CREATED,
      user: { id: "invitee-1", email: "invitee-private@example.test" },
      team: {
        id: "team-1",
        name: "Alpha Team",
        description: "A team",
        email: "team-private@example.test",
        members: [
          {
            id: "member-row-1",
            email: "member-row-private@example.test",
            user: {
              id: "member-1",
              name: "Member One",
              email: "member-private@example.test",
              image: null,
            },
          },
        ],
      },
    };
    global.fetch = jest.fn(() => jsonResponse([contaminated])) as unknown as typeof fetch;

    const { container } = render(<PendingInvitations isOpen={true} onClose={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Alpha Team")).toBeTruthy();
    expect(container.textContent).not.toMatch(/private@example\.test/);
    const images = Array.from(container.querySelectorAll("img"));
    for (const img of images) {
      expect(img.getAttribute("alt") ?? "").not.toMatch(/private@example\.test/);
      expect(img.getAttribute("title") ?? "").not.toMatch(/private@example\.test/);
    }
  });
});
