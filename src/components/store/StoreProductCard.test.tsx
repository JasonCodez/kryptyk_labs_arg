/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import StoreProductCard, { type StoreProductItem, type StoreProductCardProps } from "./StoreProductCard";

const BASE_ITEM: StoreProductItem = {
  id: "item-1",
  key: "hint_token",
  name: "Hint Token",
  description: "Reveals a hint on any puzzle without a point penalty.",
  category: "puzzle",
  subcategory: "token",
  price: 200,
  isConsumable: true,
  iconEmoji: "💡",
  metadata: null,
  owned: 0,
};

function noopHandlers() {
  return {
    onPreview: jest.fn(),
    onPurchase: jest.fn(),
    onEquip: jest.fn(),
    onUnequip: jest.fn(),
    onActivateTriple: jest.fn(),
    onDeactivateTriple: jest.fn(),
  };
}

function renderCard(overrides: Partial<StoreProductCardProps> = {}) {
  const handlers = noopHandlers();
  const props: StoreProductCardProps = {
    item: BASE_ITEM,
    displayName: BASE_ITEM.name,
    equipped: false,
    canAfford: true,
    isBuying: false,
    isEquipping: false,
    tripleOrNothingActive: false,
    activatingTriple: false,
    ...handlers,
    ...overrides,
  };
  const utils = render(<StoreProductCard {...props} />);
  return { ...utils, handlers, props };
}

afterEach(() => {
  cleanup();
});

describe("StoreProductCard — basic product information (Test A)", () => {
  it("renders name, description, subcategory label, localized price, and icon inside a semantic article", () => {
    renderCard();

    const article = screen.getByRole("article", { name: "Hint Token" });
    expect(article).toBeTruthy();
    expect(within(article).getByRole("heading", { name: "Hint Token" })).toBeTruthy();
    expect(screen.getByText(/Reveals a hint on any puzzle/)).toBeTruthy();
    expect(screen.getByText("Token · Consumable")).toBeTruthy();
    expect(screen.getByText("200 pts")).toBeTruthy();
    expect(screen.getByText("💡")).toBeTruthy();
  });
});

describe("StoreProductCard — buy action (Test B)", () => {
  it("shows Buy for an unowned item and invokes only onPurchase when clicked", () => {
    const { handlers } = renderCard({ item: { ...BASE_ITEM, isConsumable: false, owned: 0 } });

    const buyBtn = screen.getByRole("button", { name: "Buy" });
    fireEvent.click(buyBtn);

    expect(handlers.onPurchase).toHaveBeenCalledTimes(1);
    expect(handlers.onEquip).not.toHaveBeenCalled();
    expect(handlers.onUnequip).not.toHaveBeenCalled();
    expect(handlers.onActivateTriple).not.toHaveBeenCalled();
    expect(handlers.onDeactivateTriple).not.toHaveBeenCalled();
  });
});

describe("StoreProductCard — unaffordable state (Test C)", () => {
  it("keeps price and content visible while disabling Buy", () => {
    renderCard({ canAfford: false });

    expect(screen.getByText("200 pts")).toBeTruthy();
    const buyBtn = screen.getByRole("button", { name: "Buy" });
    expect(buyBtn).toBeTruthy();
    expect((buyBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Reveals a hint on any puzzle/)).toBeTruthy();
  });
});

describe("StoreProductCard — preview action (Test D)", () => {
  it("shows Preview for a supported subcategory and invokes onPreview once", () => {
    const { handlers } = renderCard({
      item: { ...BASE_ITEM, subcategory: "theme", category: "cosmetic", isConsumable: false, metadata: { primaryColor: "#FDE74C" } },
    });

    const previewBtn = screen.getByRole("button", { name: /Preview/ });
    fireEvent.click(previewBtn);
    expect(handlers.onPreview).toHaveBeenCalledTimes(1);
  });

  it("hides Preview for an unsupported subcategory", () => {
    renderCard({ item: { ...BASE_ITEM, subcategory: "token" } });
    expect(screen.queryByRole("button", { name: /Preview/ })).toBeNull();
  });
});

describe("StoreProductCard — owned and equip (Test E)", () => {
  it("shows Owned and Equip for an owned, non-equipped cosmetic, and calls onEquip once", () => {
    const { handlers } = renderCard({
      item: { ...BASE_ITEM, subcategory: "frame", category: "cosmetic", isConsumable: false, owned: 1, metadata: { value: "gold" } },
      equipped: false,
    });

    expect(screen.getByText("Owned")).toBeTruthy();
    const equipBtn = screen.getByRole("button", { name: "Equip" });
    fireEvent.click(equipBtn);
    expect(handlers.onEquip).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
  });
});

describe("StoreProductCard — equipped and unequip (Test F)", () => {
  it("shows Equipped and Unequip for an equipped cosmetic, and calls onUnequip once", () => {
    const { handlers } = renderCard({
      item: { ...BASE_ITEM, subcategory: "frame", category: "cosmetic", isConsumable: false, owned: 1, metadata: { value: "gold" } },
      equipped: true,
    });

    expect(screen.getByText("Equipped")).toBeTruthy();
    const unequipBtn = screen.getByRole("button", { name: "Unequip" });
    fireEvent.click(unequipBtn);
    expect(handlers.onUnequip).toHaveBeenCalledTimes(1);
  });
});

describe("StoreProductCard — consumable quantity (Test G)", () => {
  it("shows a localized quantity, keeps Buy present, and hides Equip/Unequip", () => {
    renderCard({ item: { ...BASE_ITEM, isConsumable: true, owned: 12500 } });

    expect(screen.getByText(/Owned ×12,500/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buy" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Equip" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unequip" })).toBeNull();
  });
});

describe("StoreProductCard — rarity thresholds (Test H)", () => {
  const cosmeticBase: StoreProductItem = {
    ...BASE_ITEM,
    subcategory: "theme",
    category: "cosmetic",
    isConsumable: false,
    metadata: { primaryColor: "#FDE74C" },
  };

  it("shows Legendary at 3500", () => {
    renderCard({ item: { ...cosmeticBase, price: 3500 } });
    expect(screen.getByText("Legendary")).toBeTruthy();
  });

  it("shows Epic at 2500", () => {
    renderCard({ item: { ...cosmeticBase, price: 2500 } });
    expect(screen.getByText("Epic")).toBeTruthy();
  });

  it("shows Rare at 1750", () => {
    renderCard({ item: { ...cosmeticBase, price: 1750 } });
    expect(screen.getByText("Rare")).toBeTruthy();
  });

  it("shows no rarity label at 1749", () => {
    renderCard({ item: { ...cosmeticBase, price: 1749 } });
    expect(screen.queryByText("Legendary")).toBeNull();
    expect(screen.queryByText("Epic")).toBeNull();
    expect(screen.queryByText("Rare")).toBeNull();
  });
});

describe("StoreProductCard — Triple-or-Nothing actions (Test I)", () => {
  const tripleItem: StoreProductItem = {
    ...BASE_ITEM,
    key: "triple_or_nothing",
    name: "Triple-or-Nothing",
    subcategory: "boost",
    category: "puzzle",
    isConsumable: false,
    owned: 1,
  };

  it("shows Activate when inactive and calls onActivateTriple once", () => {
    const { handlers } = renderCard({ item: tripleItem, tripleOrNothingActive: false });
    const btn = screen.getByRole("button", { name: /Activate/ });
    fireEvent.click(btn);
    expect(handlers.onActivateTriple).toHaveBeenCalledTimes(1);
  });

  it("shows Active — Cancel when active and calls onDeactivateTriple once", () => {
    const { handlers } = renderCard({ item: tripleItem, tripleOrNothingActive: true });
    const btn = screen.getByRole("button", { name: /Active — Cancel/ });
    fireEvent.click(btn);
    expect(handlers.onDeactivateTriple).toHaveBeenCalledTimes(1);
  });
});

describe("StoreProductCard — team-theme rule (Test J)", () => {
  it("shows Owned but hides Equip, Unequip, and Buy for an owned non-consumable team theme", () => {
    renderCard({
      item: { ...BASE_ITEM, subcategory: "team_theme", category: "social", isConsumable: false, owned: 1, metadata: { primaryColor: "#FDE74C" } },
      equipped: false,
    });

    expect(screen.getByText("Owned")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Equip" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unequip" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
  });
});

describe("StoreProductCard — stress values remain rendered (Test K)", () => {
  it("keeps a long name, long description, large price, and large quantity present", () => {
    renderCard({
      item: {
        id: "stress-item",
        key: "stress_cosmetic",
        name: "Legendary Maximum-Width Cosmetic Reward",
        description:
          "This deliberately long product description verifies that card content remains readable and contained on the narrowest supported mobile layout without hiding important information.",
        category: "cosmetic",
        subcategory: "theme",
        price: 12_345_678,
        isConsumable: false,
        iconEmoji: "✨",
        metadata: { value: "stress", primaryColor: "#FFC93C", accentColor: "#8B3DFF" },
        owned: 999_999,
      },
      displayName: "Legendary Maximum-Width Cosmetic Reward",
      equipped: true,
    });

    expect(screen.getByRole("heading", { name: "Legendary Maximum-Width Cosmetic Reward" })).toBeTruthy();
    expect(screen.getByText(/deliberately long product description/)).toBeTruthy();
    expect(screen.getByText("12,345,678 pts")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unequip" })).toBeTruthy();
  });

  it("keeps a large consumable quantity present", () => {
    renderCard({ item: { ...BASE_ITEM, isConsumable: true, owned: 999_999 } });
    expect(screen.getByText(/Owned ×999,999/)).toBeTruthy();
  });
});

describe("StoreProductCard — reduced-motion-safe rendering (Test L)", () => {
  it("renders without throwing when reduced motion is preferred", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    expect(() => renderCard()).not.toThrow();
    expect(screen.getByRole("article", { name: "Hint Token" })).toBeTruthy();

    window.matchMedia = originalMatchMedia;
  });
});
