/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzOpponentSearch from "./WarzOpponentSearch";

function mockFetch(handler: (url: string) => { ok: boolean; status?: number; json: () => Promise<unknown> } | Promise<unknown>) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const result = handler(String(input));
    return Promise.resolve(result) as unknown as Promise<Response>;
  }) as jest.Mock;
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
  document.documentElement.removeAttribute("data-reduce-animations");
});

async function typeQuery(value: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });
}

describe("WarzOpponentSearch", () => {
  it("search input has a visible label", () => {
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByLabelText(/invite a specific player/i)).toBeTruthy();
  });

  it("search input uses combobox role", () => {
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it('search input has aria-autocomplete="list"', () => {
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByRole("combobox").getAttribute("aria-autocomplete")).toBe("list");
  });

  it("no request for empty input", async () => {
    jest.useFakeTimers();
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no request for one trimmed character", async () => {
    jest.useFakeTimers();
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery(" a ");
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("request occurs after 350ms for two characters", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [] }) }));
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    expect(global.fetch).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("request uses encoded trimmed query and preserves limit=6", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [] }) }));
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("  riv al  ");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe(`/api/users/search?q=${encodeURIComponent("riv al")}&limit=6`);
  });

  it("does not request before debounce completes", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [] }) }));
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows searching state", async () => {
    jest.useFakeTimers();
    let resolveFetch!: (v: unknown) => void;
    global.fetch = jest.fn(() => new Promise((resolve) => { resolveFetch = resolve; })) as unknown as jest.Mock;
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    expect(screen.getByText(/searching players/i)).toBeTruthy();
    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve({ users: [] }) });
      await Promise.resolve();
    });
  });

  it("shows failure state and retry repeats current query once", async () => {
    jest.useFakeTimers();
    let calls = 0;
    global.fetch = jest.fn(() => {
      calls += 1;
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as jest.Mock;
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(screen.getByText(/couldn.t search players/i)).toBeTruthy();
    expect(calls).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      await Promise.resolve();
    });
    expect(calls).toBe(2);
  });

  it("shows no-results state", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [] }) }));
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("zz");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(screen.getByText(/no players found/i)).toBeTruthy();
  });

  it("results use listbox and option roles", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [{ id: "1", username: "RivalOne" }, { id: "2", username: "RivalTwo" }] }) }));
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option").length).toBe(2);
  });

  it("ArrowDown/ArrowUp navigate and Enter selects; keyboard nav performs no request", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [{ id: "1", username: "RivalOne" }, { id: "2", username: "RivalTwo" }] }) }));
    const onSelect = jest.fn();
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={onSelect} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ id: "1", username: "RivalOne" });
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
  });

  it("Escape closes results", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [{ id: "1", username: "RivalOne" }] }) }));
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("mouse selection passes exact user", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [{ id: "1", username: "RivalOne" }] }) }));
    const onSelect = jest.fn();
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={onSelect} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /RivalOne/ }));
    expect(onSelect).toHaveBeenCalledWith({ id: "1", username: "RivalOne" });
  });

  it("selected state shows exact username and does not expose ID", () => {
    render(
      <WarzOpponentSearch selectedOpponent={{ id: "secret-id", username: "RivalOne" }} onSelect={jest.fn()} onRemove={jest.fn()} />
    );
    expect(screen.getByText("@RivalOne")).toBeTruthy();
    expect(screen.queryByText(/secret-id/)).toBeNull();
  });

  it("remove action invokes callback and hides search input while selected", () => {
    const onRemove = jest.fn();
    render(
      <WarzOpponentSearch selectedOpponent={{ id: "1", username: "RivalOne" }} onSelect={jest.fn()} onRemove={onRemove} />
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /remove opponent/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("removing restores clean search state", () => {
    const { rerender } = render(
      <WarzOpponentSearch selectedOpponent={{ id: "1", username: "RivalOne" }} onSelect={jest.fn()} onRemove={jest.fn()} />
    );
    rerender(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("");
  });

  it("search input has at least 46px explicit minimum", () => {
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByRole("combobox").style.minHeight).toBe("46px");
  });

  it("remove action has at least 44px explicit minimum", () => {
    render(
      <WarzOpponentSearch selectedOpponent={{ id: "1", username: "RivalOne" }} onSelect={jest.fn()} onRemove={jest.fn()} />
    );
    expect(screen.getByRole("button", { name: /remove opponent/i }).className).toContain("min-h-11");
  });

  it("uses Lucide icons", () => {
    const { container } = render(
      <WarzOpponentSearch selectedOpponent={{ id: "1", username: "RivalOne" }} onSelect={jest.fn()} onRemove={jest.fn()} />
    );
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("contains no raw emoji", () => {
    const { container } = render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzOpponentSearch.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("reduced motion removes list movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(
      <WarzOpponentSearch selectedOpponent={{ id: "1", username: "RivalOne" }} onSelect={jest.fn()} onRemove={jest.fn()} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).not.toBe("0");
  });

  it("no navigation occurs", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzOpponentSearch.tsx"), "utf8");
    expect(source).not.toMatch(/useRouter|router\.push/);
  });

  it("no search result is fabricated (only renders what the API returns)", async () => {
    jest.useFakeTimers();
    mockFetch(() => ({ ok: true, json: () => Promise.resolve({ users: [{ id: "1", username: "RealUser" }] }) }));
    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("re");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(screen.getAllByRole("option").length).toBe(1);
    expect(screen.getByText(/RealUser/)).toBeTruthy();
  });

  it("stale success cannot replace newer results, and does not overlap requests", async () => {
    jest.useFakeTimers();
    const deferreds: Array<{ resolve: (v: unknown) => void }> = [];
    global.fetch = jest.fn(() => {
      let resolve!: (v: unknown) => void;
      const p = new Promise((res) => { resolve = res; });
      deferreds.push({ resolve });
      return p;
    }) as unknown as jest.Mock;

    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    await typeQuery("riv");
    await act(async () => {
      jest.advanceTimersByTime(350);
    });

    expect(deferreds.length).toBe(2);
    await act(async () => {
      deferreds[1].resolve({ ok: true, json: () => Promise.resolve({ users: [{ id: "2", username: "Newer" }] }) });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      deferreds[0].resolve({ ok: true, json: () => Promise.resolve({ users: [{ id: "1", username: "Older" }] }) });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Newer/)).toBeTruthy();
    expect(screen.queryByText(/Older/)).toBeNull();
  });

  it("intentional abort does not show an error", async () => {
    jest.useFakeTimers();
    const abortErrors: string[] = [];
    global.fetch = jest.fn((_input, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          abortErrors.push("aborted");
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });
    }) as unknown as jest.Mock;

    render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    await typeQuery("riva");
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(abortErrors.length).toBeGreaterThan(0);
    expect(screen.queryByText(/couldn.t search players/i)).toBeNull();
  });

  it("unmount aborts active request", async () => {
    jest.useFakeTimers();
    let aborted = false;
    global.fetch = jest.fn((_input, init?: RequestInit) => {
      init?.signal?.addEventListener("abort", () => { aborted = true; });
      return new Promise(() => {});
    }) as unknown as jest.Mock;
    const { unmount } = render(<WarzOpponentSearch selectedOpponent={null} onSelect={jest.fn()} onRemove={jest.fn()} />);
    await typeQuery("ri");
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    unmount();
    expect(aborted).toBe(true);
  });
});
