/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import JigsawSystemMessage from "./JigsawSystemMessage";

afterEach(cleanup);

describe("JigsawSystemMessage — loading", () => {
  it("renders its title", () => {
    render(<JigsawSystemMessage variant="loading" title="Preparing puzzle" message="Loading the image and building your pieces." />);
    expect(screen.getByText("Preparing puzzle")).toBeTruthy();
  });

  it("renders its supporting text", () => {
    render(<JigsawSystemMessage variant="loading" title="Preparing puzzle" message="Loading the image and building your pieces." />);
    expect(screen.getByText("Loading the image and building your pieces.")).toBeTruthy();
  });

  it("renders no action button", () => {
    const { container } = render(<JigsawSystemMessage variant="loading" title="Preparing puzzle" />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("does not receive callbacks", () => {
    const props = { variant: "loading" as const, title: "Preparing puzzle" };
    render(<JigsawSystemMessage {...props} />);
    expect(typeof (props as Record<string, unknown>).onAction).toBe("undefined");
  });
});

describe("JigsawSystemMessage — image-error", () => {
  it("renders its title", () => {
    render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" message="Check your connection and try loading the puzzle again." />);
    expect(screen.getByText("Image couldn't load")).toBeTruthy();
  });

  it("renders its supporting text", () => {
    render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" message="Check your connection and try loading the puzzle again." />);
    expect(screen.getByText("Check your connection and try loading the puzzle again.")).toBeTruthy();
  });

  it("renders Try Again when callback is supplied", () => {
    render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" actionLabel="Try Again" onAction={() => {}} />);
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });

  it("renders no button when actionLabel is supplied without onAction", () => {
    const { container } = render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" actionLabel="Try Again" />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("calls the callback once when Try Again is clicked", () => {
    const onAction = jest.fn();
    render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" actionLabel="Try Again" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("is keyboard accessible", () => {
    const onAction = jest.fn();
    render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" actionLabel="Try Again" onAction={onAction} />);
    const button = screen.getByRole("button", { name: "Try Again" }) as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("disables the retry action while actionPending is true", () => {
    render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" actionLabel="Try Again" onAction={() => {}} actionPending />);
    expect((screen.getByRole("button", { name: "Try Again" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not fire the retry callback while pending", () => {
    const onAction = jest.fn();
    render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" actionLabel="Try Again" onAction={onAction} actionPending />);
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("uses a native button element for the action", () => {
    render(<JigsawSystemMessage variant="image-error" title="Image couldn't load" actionLabel="Try Again" onAction={() => {}} />);
    const button = screen.getByRole("button", { name: "Try Again" });
    expect(button.tagName).toBe("BUTTON");
  });
});

describe("JigsawSystemMessage — restored", () => {
  it("renders 'Progress restored'", () => {
    render(<JigsawSystemMessage variant="restored" title="Progress restored" message="Your puzzle is ready where you left off." />);
    expect(screen.getByText("Progress restored")).toBeTruthy();
  });

  it("renders its supporting text", () => {
    render(<JigsawSystemMessage variant="restored" title="Progress restored" message="Your puzzle is ready where you left off." />);
    expect(screen.getByText("Your puzzle is ready where you left off.")).toBeTruthy();
  });

  it("contains no focusable elements", () => {
    const { container } = render(<JigsawSystemMessage variant="restored" title="Progress restored" message="Your puzzle is ready where you left off." />);
    expect(container.querySelectorAll("button, a, input, select, textarea, [tabindex]").length).toBe(0);
  });

  it("does not receive callbacks", () => {
    const props = { variant: "restored" as const, title: "Progress restored" };
    render(<JigsawSystemMessage {...props} />);
    expect(typeof (props as Record<string, unknown>).onAction).toBe("undefined");
  });
});

describe("JigsawSystemMessage — completion-error", () => {
  const dynamicError = "Temporary completion failure: server returned 503 while attempting to persist your solve";

  it("renders the supplied dynamic error text", () => {
    render(
      <JigsawSystemMessage
        variant="completion-error"
        title="Puzzle solved — save pending"
        message={dynamicError}
        actionLabel="Retry Completion"
        onAction={() => {}}
      />
    );
    expect(screen.getByText(dynamicError)).toBeTruthy();
  });

  it("renders 'Retry Completion'", () => {
    render(
      <JigsawSystemMessage
        variant="completion-error"
        title="Puzzle solved — save pending"
        message={dynamicError}
        actionLabel="Retry Completion"
        onAction={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Retry Completion" })).toBeTruthy();
  });

  it("calls its callback once on retry", () => {
    const onAction = jest.fn();
    render(
      <JigsawSystemMessage
        variant="completion-error"
        title="Puzzle solved — save pending"
        message={dynamicError}
        actionLabel="Retry Completion"
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry Completion" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("supports long error text without inserting unsafe HTML", () => {
    const longError = "<img src=x onerror=alert(1)> ".repeat(20) + "Completion could not be saved.";
    const { container } = render(
      <JigsawSystemMessage
        variant="completion-error"
        title="Puzzle solved — save pending"
        message={longError}
        actionLabel="Retry Completion"
        onAction={() => {}}
      />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(longError)).toBeTruthy();
  });

  it("uses a native button element for the action", () => {
    render(
      <JigsawSystemMessage
        variant="completion-error"
        title="Puzzle solved — save pending"
        message={dynamicError}
        actionLabel="Retry Completion"
        onAction={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Retry Completion" }).tagName).toBe("BUTTON");
  });
});

describe("JigsawSystemMessage — shared behavior", () => {
  it("gives every decorative SVG aria-hidden=true", () => {
    for (const variant of ["loading", "image-error", "restored", "completion-error"] as const) {
      const { container, unmount } = render(<JigsawSystemMessage variant={variant} title="Title" message="Message" />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
      for (const svg of svgs) expect(svg.getAttribute("aria-hidden")).toBe("true");
      unmount();
    }
  });

  it("gives every decorative SVG focusable=false", () => {
    for (const variant of ["loading", "image-error", "restored", "completion-error"] as const) {
      const { container, unmount } = render(<JigsawSystemMessage variant={variant} title="Title" message="Message" />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
      for (const svg of svgs) expect(svg.getAttribute("focusable")).toBe("false");
      unmount();
    }
  });

  it("contains no emoji", () => {
    for (const variant of ["loading", "image-error", "restored", "completion-error"] as const) {
      const { container, unmount } = render(
        <JigsawSystemMessage variant={variant} title="Title" message="Message" actionLabel="Go" onAction={() => {}} />
      );
      expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
      unmount();
    }
  });

  it("contains no purple, pink, or magenta styling", () => {
    for (const variant of ["loading", "image-error", "restored", "completion-error"] as const) {
      const { container, unmount } = render(<JigsawSystemMessage variant={variant} title="Title" message="Message" />);
      expect(container.innerHTML).not.toMatch(/purple|pink|magenta/i);
      unmount();
    }
  });

  it("does not expose unrelated controls beyond the single action button", () => {
    const { container } = render(
      <JigsawSystemMessage variant="image-error" title="Title" message="Message" actionLabel="Try Again" onAction={() => {}} />
    );
    expect(container.querySelectorAll("button").length).toBe(1);
    expect(container.querySelectorAll("a, input, select, textarea").length).toBe(0);
  });
});
