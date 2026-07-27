/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { THEME_CONFIGS } from "@/lib/profileThemes";
import FollowListModal, {
  getFollowListDisplayName,
  normalizeFollowListPayload,
  type FollowListUser,
} from "./FollowListModal";

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const THEME = THEME_CONFIGS.default;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

const VALID_USER: FollowListUser = {
  id: "player-2",
  name: "Alpha Player",
  image: null,
  isSelf: false,
  isFollowing: false,
};

function authenticated() {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "me" } } });
}

function unauthenticated() {
  mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockUseSession.mockReset();
  authenticated();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("normalizeFollowListPayload", () => {
  const VALID_PAYLOAD = { users: [VALID_USER], nextCursor: "cursor-30" };

  test("non-object top-level payload returns null", () => {
    expect(normalizeFollowListPayload("nope")).toBeNull();
    expect(normalizeFollowListPayload(42)).toBeNull();
    expect(normalizeFollowListPayload(null)).toBeNull();
    expect(normalizeFollowListPayload(undefined)).toBeNull();
  });

  test("array top-level payload returns null", () => {
    expect(normalizeFollowListPayload([VALID_PAYLOAD])).toBeNull();
  });

  test("missing users returns null", () => {
    expect(normalizeFollowListPayload({ nextCursor: null })).toBeNull();
  });

  test("non-array users returns null", () => {
    expect(normalizeFollowListPayload({ users: "nope", nextCursor: null })).toBeNull();
  });

  test("invalid nextCursor returns null", () => {
    expect(normalizeFollowListPayload({ users: [], nextCursor: 42 })).toBeNull();
    expect(normalizeFollowListPayload({ users: [], nextCursor: {} })).toBeNull();
  });

  test("blank cursor normalizes to null", () => {
    expect(normalizeFollowListPayload({ users: [], nextCursor: "" })?.nextCursor).toBeNull();
    expect(normalizeFollowListPayload({ users: [], nextCursor: "   " })?.nextCursor).toBeNull();
  });

  test("non-object user rows are dropped", () => {
    const result = normalizeFollowListPayload({ users: [null, "invalid", 42, VALID_USER], nextCursor: null });
    expect(result?.users).toEqual([VALID_USER]);
  });

  test("blank IDs are dropped", () => {
    const result = normalizeFollowListPayload({
      users: [{ ...VALID_USER, id: "" }, { ...VALID_USER, id: "   " }],
      nextCursor: null,
    });
    expect(result?.users).toEqual([]);
  });

  test("invalid names are dropped", () => {
    const result = normalizeFollowListPayload({ users: [{ ...VALID_USER, name: 42 }], nextCursor: null });
    expect(result?.users).toEqual([]);
  });

  test("invalid images are dropped", () => {
    const result = normalizeFollowListPayload({ users: [{ ...VALID_USER, image: 42 }], nextCursor: null });
    expect(result?.users).toEqual([]);
  });

  test("invalid boolean flags are dropped", () => {
    expect(
      normalizeFollowListPayload({ users: [{ ...VALID_USER, isSelf: "yes" }], nextCursor: null })?.users
    ).toEqual([]);
    expect(
      normalizeFollowListPayload({ users: [{ ...VALID_USER, isFollowing: 1 }], nextCursor: null })?.users
    ).toEqual([]);
  });

  test("valid order is preserved", () => {
    const second = { ...VALID_USER, id: "player-3" };
    const result = normalizeFollowListPayload({ users: [VALID_USER, second], nextCursor: null });
    expect(result?.users.map((u) => u.id)).toEqual(["player-2", "player-3"]);
  });

  test("input is not mutated", () => {
    const original = JSON.parse(JSON.stringify(VALID_PAYLOAD));
    normalizeFollowListPayload(VALID_PAYLOAD);
    expect(VALID_PAYLOAD).toEqual(original);
  });

  test("public fields normalize correctly", () => {
    expect(normalizeFollowListPayload(VALID_PAYLOAD)).toEqual(VALID_PAYLOAD);
  });

  test("privacy: unexpected private fields at every depth do not survive", () => {
    const contaminated = {
      email: "root.private@example.test",
      accountId: "root-account-private",
      nextCursor: "cursor-30",
      users: [
        {
          id: "player-2",
          name: "Alpha Player",
          image: null,
          isSelf: false,
          isFollowing: false,
          email: "player-private@example.test",
          isHidden: false,
          role: "admin",
          followerId: "leak-follower",
          followingId: "leak-following",
          createdAt: "2026-01-01T00:00:00.000Z",
          nested: { email: "nested.private@example.test" },
        },
      ],
    };

    const result = normalizeFollowListPayload(contaminated);
    expect(result?.users).toEqual([
      { id: "player-2", name: "Alpha Player", image: null, isSelf: false, isFollowing: false },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private@example\.test|leak-|root-account/);
  });
});

describe("getFollowListDisplayName", () => {
  test.each([
    ["Alpha Player", "Alpha Player"],
    ["  Alpha Player  ", "Alpha Player"],
    [null, "Player"],
    ["", "Player"],
    ["   ", "Player"],
  ])("%p -> %p", (name, expected) => {
    expect(getFollowListDisplayName({ name })).toBe(expected);
  });

  test("does not use email or ID as a fallback", () => {
    expect(getFollowListDisplayName({ name: null })).not.toMatch(/@/);
    expect(getFollowListDisplayName({ name: null })).toBe("Player");
  });
});

describe("<FollowListModal /> rendering", () => {
  test("followers request uses the expected URL and credentials, renders title and player", async () => {
    const fetchMock = jest.fn(() => jsonResponse({ users: [VALID_USER], nextCursor: null }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/users/profile-1/followers", { credentials: "same-origin" });
    expect(screen.getByText("Followers")).toBeTruthy();
    expect(screen.getByText("Alpha Player")).toBeTruthy();
    const link = screen.getByText("Alpha Player").closest("a");
    expect(link?.getAttribute("href")).toBe("/profile/player-2");
  });

  test("following request uses the expected URL and title", async () => {
    global.fetch = jest.fn(() => jsonResponse({ users: [], nextCursor: null })) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="following" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(global.fetch).toHaveBeenCalledWith("/api/users/profile-1/following", { credentials: "same-origin" });
    expect(screen.getByText("Following")).toBeTruthy();
  });

  test("null and blank names both display Player, including avatar alt text", async () => {
    const nullNameUser: FollowListUser = { id: "player-3", name: null, image: null, isSelf: false, isFollowing: true };
    const blankNameUser: FollowListUser = { id: "player-4", name: "   ", image: "https://example.test/a.png", isSelf: false, isFollowing: false };
    global.fetch = jest.fn(() =>
      jsonResponse({ users: [nullNameUser, blankNameUser], nextCursor: null })
    ) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    const playerLabels = screen.getAllByText("Player");
    expect(playerLabels.length).toBeGreaterThanOrEqual(2);
    const avatarImg = screen.getByAltText("Player");
    expect(avatarImg).toBeTruthy();
    expect(screen.queryByText("player-3")).toBeNull();
    expect(screen.queryByText(/private@example\.test/)).toBeNull();
  });

  test("non-OK response shows the existing error copy without leaking raw details", async () => {
    global.fetch = jest.fn(() =>
      jsonResponse({ error: "Internal error for leak.private@example.test" }, 500)
    ) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(screen.getByText("Failed to load list.")).toBeTruthy();
    expect(screen.queryByText(/leak\.private@example\.test/)).toBeNull();
  });

  test("malformed successful response reaches the same safe error state", async () => {
    global.fetch = jest.fn(() => jsonResponse({ notTheRightShape: true })) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(screen.getByText("Failed to load list.")).toBeTruthy();
  });

  test("empty followers list shows the existing copy", async () => {
    global.fetch = jest.fn(() => jsonResponse({ users: [], nextCursor: null })) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(screen.getByText("No followers yet.")).toBeTruthy();
  });

  test("empty following list shows the existing copy", async () => {
    global.fetch = jest.fn(() => jsonResponse({ users: [], nextCursor: null })) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="following" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(screen.getByText("Not following anyone yet.")).toBeTruthy();
  });

  test("Load More requests the stored cursor and appends users without leaking injected fields", async () => {
    const page1 = {
      users: [VALID_USER],
      nextCursor: "cursor-30",
    };
    const page2Contaminated = {
      users: [
        {
          id: "player-3",
          name: "Beta Player",
          image: null,
          isSelf: false,
          isFollowing: false,
          email: "page-two.private@example.test",
        },
      ],
      nextCursor: null,
    };

    const calls: string[] = [];
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("cursor=cursor-30")) return jsonResponse(page2Contaminated);
      return jsonResponse(page1);
    }) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(screen.getByText("Alpha Player")).toBeTruthy();
    fireEvent.click(screen.getByText("Load more"));
    await flush();

    expect(calls.some((u) => u.includes("?cursor=cursor-30"))).toBe(true);
    expect(screen.getByText("Alpha Player")).toBeTruthy();
    expect(screen.getByText("Beta Player")).toBeTruthy();
    expect(screen.queryByText(/page-two\.private@example\.test/)).toBeNull();
    expect(screen.queryByText("Load more")).toBeNull();
  });

  test("Load more button shows Loading… while pending", async () => {
    let resolvePage2: (v: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("cursor=")) {
        return new Promise<Response>((resolve) => {
          resolvePage2 = resolve;
        });
      }
      return jsonResponse({ users: [VALID_USER], nextCursor: "cursor-30" });
    }) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    fireEvent.click(screen.getByText("Load more"));
    await flush();
    expect(screen.getByText("Loading…")).toBeTruthy();

    await act(async () => {
      resolvePage2(await jsonResponse({ users: [], nextCursor: null }));
      await Promise.resolve();
    });
  });

  test("unauthenticated viewer sees no follow/unfollow buttons", async () => {
    unauthenticated();
    global.fetch = jest.fn(() => jsonResponse({ users: [VALID_USER], nextCursor: null })) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(screen.queryByText("Follow")).toBeNull();
    expect(screen.queryByText("Unfollow")).toBeNull();
  });

  test("self row shows no action button", async () => {
    const selfUser: FollowListUser = { id: "me", name: "Me", image: null, isSelf: true, isFollowing: false };
    global.fetch = jest.fn(() => jsonResponse({ users: [selfUser], nextCursor: null })) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    expect(screen.queryByText("Follow")).toBeNull();
    expect(screen.queryByText("Unfollow")).toBeNull();
  });

  test("follow action sends the exact request and updates the label", async () => {
    const onFollowChange = jest.fn();
    const followCalls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/follow")) {
        followCalls.push({ url, init });
        return jsonResponse({ message: "Successfully followed user" });
      }
      return jsonResponse({ users: [VALID_USER], nextCursor: null });
    }) as unknown as typeof fetch;

    render(
      <FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} onFollowChange={onFollowChange} />
    );
    await flush();

    fireEvent.click(screen.getByText("Follow"));
    await flush();

    expect(followCalls).toHaveLength(1);
    expect(followCalls[0].url).toBe("/api/users/player-2/follow");
    expect(followCalls[0].init?.method).toBe("POST");
    expect((followCalls[0].init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(followCalls[0].init?.credentials).toBe("same-origin");
    expect(JSON.parse(String(followCalls[0].init?.body))).toEqual({ action: "follow" });

    expect(screen.getByText("Unfollow")).toBeTruthy();
    expect(onFollowChange).toHaveBeenCalledTimes(1);
  });

  test("unfollow action sends action: unfollow and updates the label", async () => {
    const followingUser: FollowListUser = { ...VALID_USER, isFollowing: true };
    const followCalls: Array<{ body?: string }> = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/follow")) {
        followCalls.push({ body: init?.body as string });
        return jsonResponse({ message: "Successfully unfollowed user" });
      }
      return jsonResponse({ users: [followingUser], nextCursor: null });
    }) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    fireEvent.click(screen.getByText("Unfollow"));
    await flush();

    expect(JSON.parse(String(followCalls[0].body))).toEqual({ action: "unfollow" });
    expect(screen.getByText("Follow")).toBeTruthy();
  });

  test("failed follow action leaves the row state unchanged", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/follow")) return jsonResponse({ error: "fail" }, 500);
      return jsonResponse({ users: [VALID_USER], nextCursor: null });
    }) as unknown as typeof fetch;

    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={jest.fn()} />);
    await flush();

    fireEvent.click(screen.getByText("Follow"));
    await flush();

    expect(screen.getByText("Follow")).toBeTruthy();
    expect(screen.queryByText("Unfollow")).toBeNull();
  });

  test("close button, backdrop, and profile link all call onClose", async () => {
    global.fetch = jest.fn(() => jsonResponse({ users: [VALID_USER], nextCursor: null })) as unknown as typeof fetch;
    const onCloseA = jest.fn();
    const { unmount } = render(
      <FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={onCloseA} />
    );
    await flush();

    fireEvent.click(screen.getByText("✕"));
    expect(onCloseA).toHaveBeenCalledTimes(1);
    unmount();

    const onCloseB = jest.fn();
    const { container: containerB, unmount: unmountB } = render(
      <FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={onCloseB} />
    );
    await flush();
    const backdrop = containerB.querySelector(".bg-black\\/60") as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCloseB).toHaveBeenCalledTimes(1);
    unmountB();

    const onCloseC = jest.fn();
    render(<FollowListModal userId="profile-1" type="followers" theme={THEME} onClose={onCloseC} />);
    await flush();
    fireEvent.click(screen.getByText("Alpha Player"));
    expect(onCloseC).toHaveBeenCalledTimes(1);
  });
});
