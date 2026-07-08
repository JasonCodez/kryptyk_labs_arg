export interface WitnessQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface DebriefScenario {
  id: string;
  caseNumber: string;
  classification: string;
  dateTime: string;
  report: string;
  questions: WitnessQuestion[];
}

// ── Witness Scenarios ─────────────────────────────────────────────────────────

export const DEBRIEF_SCENARIOS: DebriefScenario[] = [
  {
    id: "w-001",
    caseNumber: "047",
    classification: "RESTRICTED",
    dateTime: "March 14, 2026 — 23:42",
    report: `Subject: Marcus Holt, 38, male.

Holt arrived at the Ashwood Hotel at approximately 21:15 using a key card registered under the name "Elena Voss." He was observed by the night concierge carrying a brown leather briefcase and a gray umbrella. He proceeded directly to the elevator and ascended to the seventh floor.

At 23:30, hotel security received a noise complaint from room 714. Upon arriving within four minutes, officers found the room vacant. The window was unlatched. The leather briefcase remained on the bed — empty. A single playing card, the eight of clubs, had been left face-up on the pillow.

Hotel CCTV captured a woman in a red coat exiting through the service entrance at 23:18 — twelve minutes before the complaint was filed. No guests reported hearing an argument. The room had been booked for three nights under a corporate card.

No sign of forced entry. No blood. No note.`,
    questions: [
      {
        question: "What floor was Marcus Holt's room on?",
        options: ["Sixth", "Seventh", "Eighth", "Fourteenth"],
        correctIndex: 1,
      },
      {
        question: "Under what name was the room booked?",
        options: ["Marcus Holt", "Elena Voss", "Marcus Voss", "The report doesn't say"],
        correctIndex: 1,
      },
      {
        question: "What did security find left on the pillow?",
        options: ["A room key", "A note", "Eight of clubs", "Seven of spades"],
        correctIndex: 2,
      },
      {
        question: "At what time was the noise complaint filed?",
        options: ["23:18", "23:30", "23:42", "21:15"],
        correctIndex: 1,
      },
      {
        question: "What did the CCTV capture?",
        options: [
          "Holt escaping via the fire escape",
          "A woman in a red coat leaving through the service entrance",
          "Two men arguing in the lobby",
          "The CCTV was offline",
        ],
        correctIndex: 1,
      },
      // Extended pool — daily rotation picks 5 of 8
      {
        question: "At what time did Marcus Holt arrive at the Ashwood Hotel?",
        options: ["20:45", "21:00", "21:15", "21:30"],
        correctIndex: 2,
      },
      {
        question: "How long after the noise complaint did security arrive at the room?",
        options: ["Two minutes", "Four minutes", "Eight minutes", "Twelve minutes"],
        correctIndex: 1,
      },
      {
        question: "For how many nights had the room been booked?",
        options: ["One", "Two", "Three", "Four"],
        correctIndex: 2,
      },
    ],
  },
  {
    id: "w-002",
    caseNumber: "112",
    classification: "EYES ONLY",
    dateTime: "November 3, 2025 — 07:08",
    report: `Subject: Unnamed courier, female, approximately 30 years old.

At 06:50, transit police responded to platform 9 at Central Station following reports of an unattended bag. The bag — a black canvas duffel — was found on the third bench from the northern entrance. A folded newspaper from two days prior was on top of the bag. Inside: three sealed envelopes addressed to different cities (Lyon, Oslo, and Reykjavik), a burner phone with a single sent message reading "it's done," and a pair of latex gloves still in their packaging.

Platform CCTV showed a woman in a yellow rain jacket leaving the duffel at 06:44 and exiting through turnstile 7. She paused briefly at a vending machine, purchasing nothing, and then disappeared into the westbound tunnel.

A transit worker confirmed the bag had not been there at 06:30 during his sweep. The phone was registered to no one. The envelopes contained only blank paper. Forensics found no prints.`,
    questions: [
      {
        question: "Where was the unattended bag found?",
        options: [
          "Near the ticket machines",
          "On the third bench from the northern entrance",
          "On the second bench from the southern exit",
          "On platform 11",
        ],
        correctIndex: 1,
      },
      {
        question: "What was on top of the duffel bag?",
        options: [
          "A burner phone",
          "A pair of gloves",
          "A folded newspaper",
          "A transit map",
        ],
        correctIndex: 2,
      },
      {
        question: "What time did the woman place the bag and leave?",
        options: ["06:30", "06:44", "06:50", "07:08"],
        correctIndex: 1,
      },
      {
        question: "What were the envelopes found to contain?",
        options: [
          "Cash",
          "Classified documents",
          "Blank paper",
          "The report doesn't say",
        ],
        correctIndex: 2,
      },
      {
        question: "Which turnstile did the woman exit through?",
        options: ["Turnstile 3", "Turnstile 5", "Turnstile 7", "Turnstile 9"],
        correctIndex: 2,
      },
      // Extended pool — daily rotation picks 5 of 8
      {
        question: "Which cities were the envelopes addressed to?",
        options: [
          "London, Paris, and Berlin",
          "Lyon, Oslo, and Reykjavik",
          "Oslo, Z\u00FCrich, and Madrid",
          "The envelopes had no addresses",
        ],
        correctIndex: 1,
      },
      {
        question: "What two additional items were found inside the duffel bag besides the envelopes?",
        options: [
          "A burner phone and a transit map",
          "Latex gloves and a prepaid card",
          "A burner phone and latex gloves in their packaging",
          "A laptop and a burner phone",
        ],
        correctIndex: 2,
      },
      {
        question: "Which platform was the unattended bag reported on?",
        options: ["Platform 7", "Platform 9", "Platform 11", "The report doesn't specify"],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "w-003",
    caseNumber: "231",
    classification: "CLASSIFIED",
    dateTime: "July 29, 2025 — 14:55",
    report: `Subject: Dr. Irene Calloway, 52, professor of applied mathematics.

Calloway failed to appear for a scheduled 14:00 department meeting at Whitmore University. Her office on the fourth floor of the Hargreaves Building was found unlocked. Her laptop was open to a partially written email addressed to a "V. Renko" — the body read only: "They know. Burn the Linz files before—". The email was never sent.

A half-eaten sandwich and an untouched cup of coffee still warm to the touch indicated a recent departure. Her phone, wallet, and car keys were on her desk. The window overlooking the east courtyard was open six inches.

A junior colleague reported hearing raised voices from the corridor at approximately 13:45. A visitor's badge, issued at 13:31 for a "Dr. P. Marsh," was recovered near the stairwell. University records show no scheduled visit from any Dr. Marsh. Campus CCTV failed for the Hargreaves wing between 13:30 and 15:00 due to a network fault.`,
    questions: [
      {
        question: "What floor was Calloway's office on?",
        options: ["Second", "Third", "Fourth", "Fifth"],
        correctIndex: 2,
      },
      {
        question: "Who was Calloway's unsent email addressed to?",
        options: ["Dr. P. Marsh", "V. Renko", "The Department Chair", "The email had no recipient"],
        correctIndex: 1,
      },
      {
        question: "What time was the visitor's badge issued?",
        options: ["13:30", "13:31", "13:45", "14:00"],
        correctIndex: 1,
      },
      {
        question: "Why was there no CCTV footage available?",
        options: [
          "The cameras had been disabled manually",
          "The recording had been deleted",
          "A network fault took the Hargreaves wing cameras offline",
          "There are no cameras in that wing",
        ],
        correctIndex: 2,
      },
      {
        question: "What did Calloway leave behind on her desk?",
        options: [
          "Only her laptop",
          "Her phone and wallet, but not her keys",
          "Her phone, wallet, and car keys",
          "Nothing — the desk was cleared",
        ],
        correctIndex: 2,
      },      // Extended pool — daily rotation picks 5 of 8
      {
        question: "What was the partial body of Calloway's unsent email?",
        options: [
          "Destroy everything before they arrive",
          "They know. Burn the Linz files before\u2014",
          "Do not trust V. Renko with this information",
          "The transfer is complete. Meet at 22:00",
        ],
        correctIndex: 1,
      },
      {
        question: "When were raised voices heard in the corridor?",
        options: ["13:00", "13:31", "13:45", "14:00"],
        correctIndex: 2,
      },
      {
        question: "What subject does Dr. Calloway teach?",
        options: [
          "Applied physics",
          "Applied mathematics",
          "Theoretical chemistry",
          "Computational linguistics",
        ],
        correctIndex: 1,
      },    ],
  },
];

// Rotate by day of year so the daily scenario changes
export function getTodaysDebriefScenario(): DebriefScenario {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DEBRIEF_SCENARIOS[dayOfYear % DEBRIEF_SCENARIOS.length];
}

/** Deterministic daily shuffle — everyone gets the same 5-of-8 questions on a given day. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(48271, s) + 1) | 0;
    return (s >>> 0) / 0x100000000;
  };
}

export function getTodaysDebriefQuestionIndices(
  scenario: DebriefScenario,
  count = 5
): number[] {
  // Seed = today's ISO date string + scenario id (e.g. "2026-04-08w-001")
  const seedStr = new Date().toISOString().slice(0, 10) + scenario.id;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash + seedStr.charCodeAt(i)) | 0;
  }

  const rand = seededRandom(hash);
  const indices = scenario.questions.map((_, i) => i);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, count);
}
