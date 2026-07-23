/** @jest-environment jsdom */
import { formatCountdown } from "./page";
jest.mock("next-auth/react", () => ({ useSession: () => ({ status: "loading", data: null }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
describe("leaderboards page helpers", () => {
  it("formats valid, expired, and invalid schedules safely", () => {
    const now = Date.parse("2026-07-23T00:00:00Z");
    expect(formatCountdown("2026-07-25T04:00:00Z", now)).toBe("2d 4h remaining");
    expect(formatCountdown("2026-07-22T00:00:00Z", now)).toBe("Ended");
    expect(formatCountdown("invalid", now)).toBe("Schedule unavailable");
  });
});
