// Authoring-only draft for The Midnight Exhibition.
// Not imported by the player-facing application.
// Publishing is intentionally deferred to a later pass.
//
// This module exists purely so its own test file can prove — via the frozen offline uniqueness
// analyzer — that the seven authored structured clues below have exactly one solution before any
// publishing pass ever touches the database, catalog, or UI. No production file may import from
// this module.

import type { LogicGridDataInput, LogicGridSolution } from "@/lib/logicGridCore";

export const MIDNIGHT_EXHIBITION_TITLE = "The Midnight Exhibition";

export const MIDNIGHT_EXHIBITION_MYSTERY_QUESTION =
  "Who entered the Vault carrying the stolen Silver Key?";

export const MIDNIGHT_EXHIBITION_EXPECTED_ANSWER = "Lena";

const MIDNIGHT_EXHIBITION_INTRO =
  "At 9:35 p.m., the curator of the Midnight Exhibition discovered that the Silver Key had vanished from its display. Four guests had entered four different rooms at different times, each carrying one unusual object. Determine who entered the Vault carrying the stolen Silver Key.";

const MIDNIGHT_EXHIBITION_CATEGORIES = [
  {
    id: "person",
    name: "Guests",
    entries: ["Maya", "Jordan", "Lena", "Theo"],
  },
  {
    id: "room",
    name: "Rooms",
    entries: ["Observatory", "Library", "Vault", "Gallery"],
  },
  {
    id: "time",
    name: "Arrival Times",
    entries: ["8:00", "8:30", "9:00", "9:30"],
  },
  {
    id: "object",
    name: "Objects",
    entries: ["Brass Compass", "Silver Key", "Red Journal", "Glass Eye"],
  },
];

export const MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION: LogicGridSolution = {
  Maya: { room: "Observatory", time: "8:00", object: "Brass Compass" },
  Jordan: { room: "Library", time: "8:30", object: "Glass Eye" },
  Lena: { room: "Vault", time: "9:30", object: "Silver Key" },
  Theo: { room: "Gallery", time: "9:00", object: "Red Journal" },
};

const MIDNIGHT_EXHIBITION_CLUES = [
  {
    id: "midnight-01-compass",
    text: "Maya carried the Brass Compass.",
    type: "same",
    operands: [
      { categoryId: "person", entry: "Maya" },
      { categoryId: "object", entry: "Brass Compass" },
    ],
  },
  {
    id: "midnight-02-observatory-eye",
    text: "The guest in the Observatory did not carry the Glass Eye.",
    type: "notSame",
    operands: [
      { categoryId: "room", entry: "Observatory" },
      { categoryId: "object", entry: "Glass Eye" },
    ],
  },
  {
    id: "midnight-03-theo-object",
    text: "Theo carried either the Silver Key or the Red Journal.",
    type: "eitherOr",
    operands: [
      { categoryId: "person", entry: "Theo" },
      { categoryId: "object", entry: "Silver Key" },
      { categoryId: "object", entry: "Red Journal" },
    ],
  },
  {
    id: "midnight-04-journal-before-lena",
    text: "The guest carrying the Red Journal arrived before Lena.",
    type: "before",
    operands: [
      { categoryId: "object", entry: "Red Journal" },
      { categoryId: "person", entry: "Lena" },
    ],
    orderedCategoryId: "time",
  },
  {
    id: "midnight-05-gallery-after-eye",
    text: "The guest in the Gallery arrived after the guest carrying the Glass Eye.",
    type: "after",
    operands: [
      { categoryId: "room", entry: "Gallery" },
      { categoryId: "object", entry: "Glass Eye" },
    ],
    orderedCategoryId: "time",
  },
  {
    id: "midnight-06-gallery-before-vault",
    text: "The Gallery guest arrived immediately before the Vault guest.",
    type: "immediatelyBefore",
    operands: [
      { categoryId: "room", entry: "Gallery" },
      { categoryId: "room", entry: "Vault" },
    ],
    orderedCategoryId: "time",
  },
  {
    id: "midnight-07-library-after-maya",
    text: "The Library guest arrived immediately after Maya.",
    type: "immediatelyAfter",
    operands: [
      { categoryId: "room", entry: "Library" },
      { categoryId: "person", entry: "Maya" },
    ],
    orderedCategoryId: "time",
  },
];

export const MIDNIGHT_EXHIBITION_DRAFT_DATA = {
  intro: MIDNIGHT_EXHIBITION_INTRO,
  categories: MIDNIGHT_EXHIBITION_CATEGORIES,
  clues: MIDNIGHT_EXHIBITION_CLUES,
  solution: MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION,
} satisfies LogicGridDataInput;
