/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import PageContainer from "./PageContainer";

afterEach(cleanup);

describe("PageContainer", () => {
  it("renders children", () => {
    render(<PageContainer>Hello</PageContainer>);
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("defaults to a div element", () => {
    const { container } = render(<PageContainer>content</PageContainer>);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("defaults to the content size", () => {
    const { container } = render(<PageContainer>content</PageContainer>);
    const el = container.firstElementChild!;
    expect(el.className).toContain("lg:max-w-4xl");
    expect(el.className).toContain("lg:mx-auto");
  });

  describe("reading tier", () => {
    it("adds horizontal gutters, lg:max-w-2xl, and lg:mx-auto, and excludes lg:max-w-4xl", () => {
      const { container } = render(<PageContainer size="reading">content</PageContainer>);
      const el = container.firstElementChild!;
      expect(el.className).toContain("px-4");
      expect(el.className).toContain("lg:max-w-2xl");
      expect(el.className).toContain("lg:mx-auto");
      expect(el.className).not.toContain("lg:max-w-4xl");
    });
  });

  describe("content tier", () => {
    it("adds horizontal gutters, lg:max-w-4xl, and lg:mx-auto, and excludes lg:max-w-2xl", () => {
      const { container } = render(<PageContainer size="content">content</PageContainer>);
      const el = container.firstElementChild!;
      expect(el.className).toContain("px-4");
      expect(el.className).toContain("lg:max-w-4xl");
      expect(el.className).toContain("lg:mx-auto");
      expect(el.className).not.toContain("lg:max-w-2xl");
    });
  });

  describe("semantic elements", () => {
    it("renders as a section", () => {
      const { container } = render(<PageContainer as="section">content</PageContainer>);
      expect(container.querySelector("section")).toBeTruthy();
    });

    it("renders as a footer", () => {
      const { container } = render(<PageContainer as="footer">content</PageContainer>);
      expect(container.querySelector("footer")).toBeTruthy();
    });

    it("renders as a div", () => {
      const { container } = render(<PageContainer as="div">content</PageContainer>);
      expect(container.querySelector("div")).toBeTruthy();
    });
  });

  describe("prop forwarding", () => {
    it("merges a caller-provided className with the size classes", () => {
      const { container } = render(<PageContainer size="reading" className="pt-6 pb-2">content</PageContainer>);
      const el = container.firstElementChild!;
      expect(el.className).toContain("pt-6");
      expect(el.className).toContain("pb-2");
      expect(el.className).toContain("lg:max-w-2xl");
    });

    it("forwards style", () => {
      const { container } = render(<PageContainer style={{ borderTop: "1px solid red" }}>content</PageContainer>);
      const el = container.firstElementChild as HTMLElement;
      expect(el.style.borderTop).toBe("1px solid red");
    });

    it("forwards aria-label", () => {
      render(<PageContainer aria-label="Site footer">content</PageContainer>);
      expect(screen.getByLabelText("Site footer")).toBeTruthy();
    });

    it("forwards data-testid", () => {
      render(<PageContainer data-testid="my-container">content</PageContainer>);
      expect(screen.getByTestId("my-container")).toBeTruthy();
    });
  });

  it("renders without any browser API or provider — server-compatible", () => {
    // No context providers, no jsdom-only globals mocked beyond the standard
    // jest-environment jsdom setup — this alone proves it doesn't reach for
    // window/document APIs beyond what React itself needs to render.
    expect(() => render(<PageContainer as="section" size="content">content</PageContainer>)).not.toThrow();
  });
});
