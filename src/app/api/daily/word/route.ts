import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTodayDayNumber } from "@/lib/dailyPuzzle";

const WORDS = [
  // Days 1–13 fixed (already played)
  "ADEPT","AGILE","ALARM","ALBUM","ALERT","ALGAE","ALIBI","ALIEN","ALOFT","AMBLE",
  "AMEND","AMPLE","ANGEL",
  // Days 14–480 shuffled (seed 20260413, Fisher-Yates)
  "INPUT","SCOUT","PIECE","PILOT","RABID","DRUMN","BARGE",
  "GNASH","BRINE","MOTOR","AWASH","MAGIC","EXERT","QUEST","NYMPH","BUNCH","SPIRE",
  "TIGER","GIZMO","CRASH","DROVE","SMASH","HARDY","RUDDY","DUSKY","AXIOM","BROTH",
  "EXCEL","JAUNT","GUILE","CHAOS","SPELL","STALK","SOLAR","CROSS","EMBER","SWAMP",
  "BLUSH","UMBRA","BULKY","GROAN","BLURB","MANOR","EVICT","EIGHT","SHAKE","AROMA",
  "KNOLL","CHEWY","LASER","CHEST","EXTRA","VIPER","EAGLE","BLUFF","ELITE","ASHEN",
  "VENOM","GLYPH","DRIFT","BRAVE","MELON","KUDOS","BRAZE","LANCE","BLUNT","EVENT",
  "VYING","ANVIL","SOOTH","SLEET","BLISS","TITLE","FORUM","BONUS","ANIME","CHILI",
  "STASH","YEARN","LUNAR","ATONE","IDYLL","BURST","PROXY","GIRTH","TACIT","LEAPT",
  "LEAKY","BEACH","USHER","BRAKE","SPOUT","PERKY","BRAIN","SWEPT","BRAID","GUSTO",
  "FROZE","ULTRA","GRUFF","BRASS","CROAK","RUMMY","LEARN","MURKY","CHEAT","BOOST",
  "REBEL","MOUNT","SPOOL","FORGE","IMAGE","FROTH","FAITH","SOLVE","GRACE","EERIE",
  "COMET","VAULT","FRESH","IVORY","WALTZ","PLAID","BANAL","INFER","IMPLY","STRAP",
  "THORN","GLOSS","TRAIL","FRAIL","CIVIC","SMEAR","WHACK","TAPIR","BOXER","RIVET",
  "PRIME","GROWL","HAUNT","DENSE","FLANK","CRISP","ELECT","EVADE","HOUSE","HOMER",
  "RULER","APRON","HELIX","TULIP","WHALE","WHEAT","COBRA","LIGHT","SIXTY","FLEET",
  "BORAX","INBOX","SMOKE","SWEAR","QUOTA","TARDY","CRIMP","PRIVY","FLAME","STERN",
  "TOKEN","QUIRK","UNITY","FLUKE","MIRTH","CRAMP","CREED","INEPT","ETHOS","MAUVE",
  "KNACK","AZURE","LYRIC","PENNY","ROCKY","DRIVE","BIRCH","JUMBO","BREAM","BATON",
  "VIGOR","BALMY","RELIC","TRIPE","FERRY","EPOCH","BEVEL","GAVEL","CURVE","DINGO",
  "BLAZE","DELTA","DIGIT","BENCH","PIXEL","ENVOY","BARON","BLOOD","ASKEW","WEAVE",
  "DWARF","LEDGE","SLIM","AVIAN","LATCH","GIANT","SMILE","CARGO","HUMAN","RURAL",
  "ANKLE","QUERY","AROSE","JUICY","NOTCH","RESIN","IRONY","INGOT","BRAVO","NOBLE",
  "TRYST","CLAMP","STEED","SIREN","OCCUR","GHOUL","TAWNY","MORSE","PLUMB","NINJA",
  "NOVEL","AUDIT","FLASK","BRAND","STEAK","ULCER","BISON","POLAR","SIEGE","ATLAS",
  "GAUZE","NAIVE","NIFTY","OCEAN","GRIPE","PRISM","OTHER","BULLY","FEAST","ANTIC",
  "FERAL","NITRO","ORBIT","SLOPE","TURBO","OLIVE","SPICE","FUNGI","LLAMA","HAIKU",
  "BRINK","FLOSS","TRAWL","KNELT","FABLE","CANDY","LARGE","DRONE","BEIGE","AVAIL",
  "HOIST","DROOL","STING","FRAME","NEXUS","MONTH","CEDAR","ARENA","PLUME","ANNEX",
  "TABOO","CRANE","CLOVE","AORTA","FJORD","CREAK","MURAL","LOFTY","STOMP","NIGHT",
  "LILAC","DRILL","CLOAK","BROOD","SPRAY","DODGE","HUMID","SHRUB","GECKO","CLASP",
  "VALID","OPTIC","SPEAR","GYPSY","SCAMP","JEWEL","MOOSE","RAVEN","COULD","FATWA",
  "YACHT","BRINY","GLARE","EQUIP","JIFFY","PROBE","PLACE","HARSH","BLEAK","BAYOU",
  "IDEAL","BRASH","PSALM","BRISK","DEPTH","ARROW","BONGO","HERON","GRAIL","GLOOM",
  "BLOOM","ASCOT","ROOST","ARGON","WATER","HIPPO","TROUT","ARDOR","KIOSK","BLURT",
  "ASDIC","BEARD","PEACE","CLOUD","GLADE","BEGIN","FLUTE","HASTE","QUEEN","STORM",
  "PERCH","SPARK","SCALP","SNAKE","HYENA","SHARP","WITCH","GORGE","BLOWN","VOICE",
  "EXACT","BLADE","BLOKE","BADGE","SPOOK","CROOK","VINYL","FLARE","BEAST","EXPEL",
  "BLAND","WOKEN","GLEAN","QUEUE","GLOVE","APHID","OKAPI","HAVEN","VERVE","JOUST",
  "ONSET","BYLAW","DEPOT","THEME","ROYAL","CHECK","CLONE","FANCY","ATTIC","CHESS",
  "BUDGE","AWFUL","DIZZY","FLOAT","UNTIE","COURT","FORAY","MERCY","FACET","TWIRL",
  "VIVID","ZESTY","AVOID","BROWS","VERGE","RAINY","GROUT","LATHE","BRAWN","OZONE",
  "PRANK","TORCH","LOCAL","PURSE","SLUNK","SHAME","JAZZY","MOIST","ARBOR","AWOKE",
  "SCONE","ARTSY","CHEAP","FETCH","EXILE","SPOKE","SPADE","SHADE","BASIL","CORAL",
  "CAROL","DROLL","GRIME","FLINT","DUSTY","DREAD","LUSTY","HOLLY","CHARM","CINCH",
  "FLORA","SKUNK","STALE","CRYPT","CLING","SHIFT","YIELD","PLANE","BLOAT","SHEEP",
  "ROGUE","CADET","WRATH","MAXIM","LAPSE","APPLE","HOUND","BUNNY","APTLY","CAMEL",
];

export async function GET() {
  const now = new Date();
  const dayNumber = getTodayDayNumber();
  const date = now.toISOString().slice(0, 10);

  // An admin can assign a specific word_crack puzzle to today via the daily scheduler —
  // that takes precedence over the fixed word list below, which remains the fallback for
  // every day nobody has explicitly scheduled.
  const slot = await prisma.dailyPuzzleSlot.findUnique({
    where: { puzzleType_dayNumber: { puzzleType: "word_crack", dayNumber } },
    select: { puzzle: { select: { data: true } } },
  });
  const assignedWord = slot?.puzzle?.data && typeof slot.puzzle.data === "object"
    ? String((slot.puzzle.data as { word?: string }).word ?? "").toUpperCase().trim()
    : "";

  const word = assignedWord || WORDS[((dayNumber - 1) % WORDS.length + WORDS.length) % WORDS.length];

  return NextResponse.json(
    { word, number: dayNumber, date },
    {
      headers: {
        // Cache until midnight UTC
        "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=60",
      },
    }
  );
}
