import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { shortenClueText } from "@/lib/crosswordClueText";

type TopicEntry = {
  answer: string;
  text: string;
  source: string;
};

type DatamuseWord = {
  word?: unknown;
  defs?: unknown;
  score?: unknown;
  tags?: unknown;
};

type WikipediaPage = {
  title?: unknown;
  extract?: unknown;
  index?: unknown;
};

const MIN_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 12;
const DEFAULT_COUNT = 48;
const MAX_COUNT = 80;

const RANDOM_TOPIC_ALIASES = new Set(["", "any", "anything", "general", "mixed", "random", "surprise"]);

const RANDOM_ANSWER_POOL = [
  "ACORN", "ANCHOR", "ARROW", "ARTIST", "AVENUE", "BAKERY", "BALCONY", "BARREL", "BEACON", "BICYCLE",
  "BOTTLE", "BRANCH", "BRIDGE", "BUTTON", "CABIN", "CAMERA", "CANDLE", "CARPET", "CASTLE", "CIRCLE",
  "CLOUD", "COFFEE", "COMPASS", "COPPER", "CORNER", "COTTON", "DANCER", "DESERT", "DIAMOND", "DRAGON",
  "ECHO", "ENGINE", "FARMER", "FEATHER", "FIRE", "FLOWER", "FOREST", "FOSSIL", "FROST", "GARDEN",
  "GHOST", "GLACIER", "HAMMER", "HARBOR", "HARMONY", "HELMET", "HONEY", "ISLAND", "JACKET", "JOURNAL",
  "JUNGLE", "KETTLE", "LADDER", "LANTERN", "LIBRARY", "LIGHT", "MAGNET", "MARKET", "MARBLE", "MEADOW",
  "MIRROR", "MOUNTAIN", "MUSEUM", "NEEDLE", "ORCHARD", "PALACE", "PENCIL", "PIANO", "PLANET", "POCKET",
  "PRAIRIE", "PUZZLE", "QUARTZ", "RABBIT", "RAINBOW", "RIVER", "ROCKET", "SAILOR", "SCARF", "SHADOW",
  "SHELL", "SILVER", "SKETCH", "SPARK", "SPIDER", "SPONGE", "SPRING", "SQUARE", "STATUE", "STREAM",
  "SUNSET", "TEMPLE", "THREAD", "THUNDER", "TICKET", "TOWER", "TUNNEL", "UMBRELLA", "VALLEY", "VELVET",
  "VIOLET", "VOYAGE", "WALNUT", "WINDOW", "WINTER", "WIZARD", "YELLOW", "ZIPPER", "BREEZE", "COBWEB",
  "CANYON", "CHEESE", "CHERRY", "CLOVER", "COBALT", "COOKIE", "CRAYON", "DOLPHIN", "EMBER", "FALCON",
  "FLUTE", "GARLIC", "GUITAR", "HORIZON", "IGLOO", "KAYAK", "LEMON", "LOBSTER", "MELON", "NICKEL",
  "OYSTER", "PEPPER", "PILLOW", "PIRATE", "ROBOT", "SADDLE", "SAPPHIRE", "SCOOTER", "TEAPOT", "TURTLE",
  "VIOLIN", "WAGON", "WHALE", "YOGURT", "ZEBRA",
  // Expanded pool (added to reduce repeat clues across regenerated "Random"-topic crosswords).
  "AIRPORT", "ALMOND", "ALPHABET", "AMBER", "ANTLER", "APRON", "AQUARIUM", "ARBOR", "ARCADE", "ARENA",
  "ARMOR", "ASTEROID", "ATTIC", "AUTUMN", "BADGE", "BALLOON", "BAMBOO", "BANDANA", "BANJO", "BARGE",
  "BASIL", "BASKET", "BATTERY", "BEAKER", "BEAVER", "BELLOWS", "BENCH", "BERRY", "BINDER", "BIRCH",
  "BISCUIT", "BLANKET", "BLIZZARD", "BLOSSOM", "BOBCAT", "BONFIRE", "BOOKCASE", "BOOMERANG", "BOULDER", "BOUQUET",
  "BRACELET", "BRAID", "BRASS", "BRICK", "BROOCH", "BROOK", "BROOM", "BUCKET", "BUCKLE", "BUFFALO",
  "BUGGY", "BULLET", "BUNGALOW", "BURROW", "CABBAGE", "CACTUS", "CAMPFIRE", "CANAL", "CANOE", "CANOPY",
  "CANTEEN", "CAPSULE", "CARAMEL", "CARIBOU", "CARNIVAL", "CARROT", "CASCADE", "CASSETTE", "CATALOG", "CATERPILLAR",
  "CAULDRON", "CAVERN", "CEDAR", "CELLAR", "CHALK", "CHAMBER", "CHANDELIER", "CHAPEL", "CHARCOAL", "CHARIOT",
  "CHASM", "CHATEAU", "CHECKERS", "CHIMNEY", "CHIPMUNK", "CHISEL", "CHOWDER", "CIDER", "CINEMA", "CINNAMON",
  "CITADEL", "CLAMP", "CLASP", "CLIFF", "CLINIC", "CLOAK", "CLOSET", "COACH", "COCONUT", "COLONY",
  "COLUMN", "COMET", "CONDOR", "CONFETTI", "CONTINENT", "COOLER", "CORAL", "CORRIDOR", "COTTAGE", "COUGAR",
  "COURTYARD", "COWBOY", "CRADLE", "CRATER", "CRATE", "CREEK", "CRESCENT", "CREVICE", "CRICKET", "CROWN",
  "CRUTCH", "CRYSTAL", "CUCUMBER", "CUPBOARD", "CURTAIN", "CUSHION", "CYCLONE", "CYLINDER", "CYPRESS", "DAFFODIL",
  "DAGGER", "DAIRY", "DANDELION", "DEPOT", "DERRICK", "DIALECT", "DIARY", "DINGHY", "DINOSAUR", "DITCH",
  "DOMINO", "DONKEY", "DOORKNOB", "DOORWAY", "DOWNPOUR", "DRIFTWOOD", "DRUMSTICK", "DUCKLING", "DUGOUT", "DUNGEON",
  "EAGLE", "EARRING", "EASEL", "EBONY", "ECLIPSE", "EMERALD", "EMPIRE", "ENVELOPE", "EQUATOR", "ESTUARY",
  "FABRIC", "FACTORY", "FAUCET", "FENCE", "FERRY", "FESTIVAL", "FIDDLE", "FIREFLY", "FIREPLACE", "FJORD",
  "FLAGPOLE", "FLANNEL", "FLASK", "FLEECE", "FLIPPER", "FLOOD", "FOGHORN", "FOLDER", "FOUNTAIN", "FOYER",
  "FRESCO", "FRIDGE", "FRONTIER", "FUNNEL", "FURNACE", "GALAXY", "GALLERY", "GALLEY", "GARLAND", "GAZEBO",
  "GAZELLE", "GEYSER", "GIRAFFE", "GLADE", "GLOBE", "GOBLET", "GONDOLA", "GOPHER", "GORGE", "GRANITE",
  "GRAVEL", "GREENHOUSE", "GRIDDLE", "GRIZZLY", "GROTTO", "HABITAT", "HALIBUT", "HALLWAY", "HAMSTER", "HARNESS",
  "HARPOON", "HATCHET", "HAYSTACK", "HEDGEHOG", "HEMLOCK", "HERMIT", "HICKORY", "HIGHWAY", "HILLSIDE", "HOLSTER",
  "HOMESTEAD", "HONEYCOMB", "HORNET", "HOSTEL", "HOURGLASS", "HURRICANE", "HUSKY", "HYACINTH", "HYDRANT", "ICEBERG",
  "ICICLE", "IMPALA", "INCENSE", "INKWELL", "INSECT", "IVORY", "JACKAL", "JASMINE", "JAVELIN", "JETTY",
  "JOCKEY", "JOURNEY", "JUKEBOX", "JUNIPER", "KANGAROO", "KELP", "KENNEL", "KESTREL", "KIMONO", "KIOSK",
  "KITTEN", "KNAPSACK", "KNIGHT", "KNOLL", "LABYRINTH", "LACQUER", "LAGOON", "LANDMARK", "LARK", "LATTICE",
  "LAUNDRY", "LAVENDER", "LEATHER", "LEDGE", "LEOPARD", "LETTUCE", "LICHEN", "LIGHTHOUSE", "LILAC", "LIMESTONE",
  "LINEN", "LOBBY", "LOCOMOTIVE", "LOFT", "LOTUS", "LOUNGE", "LUMBER", "LYNX", "MAGPIE", "MAHOGANY",
  "MALLET", "MAMMOTH", "MANGO", "MANOR", "MANTLE", "MAPLE", "MARIGOLD", "MARSH", "MASCOT", "MATTRESS",
  "MELODY", "MERMAID", "METEOR", "MIDNIGHT", "MILLSTONE", "MINARET", "MINNOW", "MISTLETOE", "MITTEN", "MOCCASIN",
  "MONASTERY", "MONOCLE", "MONSOON", "MOSAIC", "MOSQUITO", "MOTORBIKE", "MUFFIN", "MURAL", "MUSTANG", "NARWHAL",
  "NECTAR", "NIGHTFALL", "NIMBUS", "NOMAD", "NOODLE", "NUTSHELL", "OASIS", "OATMEAL", "OBELISK", "OCELOT",
  "OCTOPUS", "ODYSSEY", "OMELET", "ONYX", "OPAL", "OPOSSUM", "ORACLE", "ORCHID", "ORIGAMI", "OSPREY",
  "OSTRICH", "OTTER", "OUTPOST", "OVERCOAT", "PADDOCK", "PAGODA", "PAJAMAS", "PANCAKE", "PANDA", "PANTHER",
  "PAPAYA", "PARACHUTE", "PARADE", "PARAKEET", "PARASOL", "PARCHMENT", "PARKA", "PARROT", "PARSNIP", "PASTURE",
  "PATCHWORK", "PATIO", "PEACOCK", "PEBBLE", "PELICAN", "PENDANT", "PENGUIN", "PENINSULA", "PENNANT", "PERFUME",
  "PERISCOPE", "PHANTOM", "PHEASANT", "PICKAXE", "PICNIC", "PIGEON", "PILGRIM", "PINECONE", "PIPELINE", "PISTON",
  "PLATEAU", "PLAYGROUND", "PLUMAGE", "PODIUM", "PONCHO", "POPPY", "PORCUPINE", "PORTHOLE", "POTTERY", "PRAWN",
  "PRETZEL", "PRISM", "PROPELLER", "PUDDLE", "PUFFIN", "PULLEY", "PUMPKIN", "PYRAMID", "QUAIL", "QUARRY",
  "QUICKSAND", "QUILL", "QUILT", "QUIVER", "RACCOON", "RADIATOR", "RADISH", "RAFTER", "RAINCOAT", "RAMPART",
  "RANCH", "RASPBERRY", "RATTLE", "RAVINE", "REEF", "REINDEER", "RELIC", "RESERVOIR", "RHUBARB", "RIBBON",
  "RIDGE", "ROBIN", "ROOSTER", "ROUTER", "ROWBOAT", "RUBBLE", "RUCKSACK", "RUNWAY", "SABLE", "SAFARI",
  "SALAMANDER", "SALOON", "SANCTUARY", "SANDBAR", "SANDCASTLE", "SAPLING", "SASH", "SATCHEL", "SAUCER", "SAUSAGE",
  "SAVANNA", "SAWDUST", "SCABBARD", "SCAFFOLD", "SCARECROW", "SCONCE", "SCORPION", "SCRAPBOOK", "SCROLL", "SCULPTURE",
  "SEAHORSE", "SEASHELL", "SEAWEED", "SEEDLING", "SENTRY", "SEQUOIA", "SERPENT", "SHACK", "SHAMROCK", "SHEARS",
  "SHEPHERD", "SHINGLE", "SHIPWRECK", "SHOWER", "SHRINE", "SHRUB", "SHUTTER", "SICKLE", "SIDECAR", "SIESTA",
  "SIGNAL", "SILO", "SINKHOLE", "SIREN", "SKELETON", "SKILLET", "SKYLIGHT", "SKYSCRAPER", "SLEDGE", "SLEIGH",
  "SLOTH", "SMOKESTACK", "SNAIL", "SNORKEL", "SNOWFLAKE", "SNOWMAN", "SNOWPLOW", "SOMBRERO", "SOUVENIR", "SPARROW",
  "SPATULA", "SPEAKER", "SPECTACLE", "SPHINX", "SPINDLE", "SPIRAL", "SPOOL", "SPORE", "SPRINKLER", "SPROUT",
  "SPRUCE", "SQUIRREL", "STABLE", "STADIUM", "STAGECOACH", "STARFISH", "STATION", "STEEPLE", "STENCIL", "STIRRUP",
  "STOCKING", "STORAGE", "STORK", "STOVE", "STRAINER", "STUMP", "SUBWAY", "SUITCASE", "SULTAN", "SUNDIAL",
  "SUNFLOWER", "SURFBOARD", "SWAMP", "SWALLOW", "SWAN", "SYCAMORE", "SYRUP", "TABLECLOTH", "TACKLE", "TADPOLE",
  "TAILOR", "TALON", "TAMBOURINE", "TANGERINE", "TAPESTRY", "TARMAC", "TASSEL", "TATTOO", "TAVERN", "TELESCOPE",
  "TEMPEST", "TENDRIL", "TERRACE", "THATCH", "THISTLE", "THORN", "THRESHOLD", "THRONE", "THRUSH", "TIGER",
  "TIMBER", "TINDER", "TOADSTOOL", "TOBOGGAN", "TOFFEE", "TOOLBOX", "TOPAZ", "TORNADO", "TORTOISE", "TOTEM",
  "TOUCAN", "TRACTOR", "TRAMPOLINE", "TREASURE", "TRELLIS", "TRIBUTE", "TRINKET", "TRIPOD", "TROLLEY", "TROPHY",
  "TROUGH", "TRUFFLE", "TRUMPET", "TUMBLEWEED", "TUNDRA", "TURBINE", "TURNIP", "TURQUOISE", "TUSK", "TUXEDO",
  "TWEEZERS", "TWILIGHT", "TYPEWRITER", "UKULELE", "UNICORN", "URCHIN", "VENDOR", "VERANDA", "VESSEL", "VILLAGE",
  "VINEYARD", "VIPER", "VOLCANO", "VULTURE", "WAFFLE", "WALLET", "WALRUS", "WARDROBE", "WAREHOUSE", "WASP",
  "WATERFALL", "WATERMELON", "WEASEL", "WHISKER", "WHISTLE", "WICKER", "WIGWAM", "WILDFIRE", "WILLOW", "WINDMILL",
  "WOLVERINE", "WOODCHUCK", "WOODPECKER", "WORKBENCH", "WORKSHOP", "WREATH", "YACHT", "YARDSTICK", "ZEPPELIN", "ZINNIA",
];

const STOP_WORDS = new Set([
  "ABOUT", "ABOVE", "AFTER", "AGAIN", "ALONG", "ALSO", "AMONG", "AND", "ARE", "BECAUSE", "BEEN",
  "BEFORE", "BEING", "BETWEEN", "BOTH", "COULD", "DID", "DOES", "DOING", "DOWN", "DURING",
  "EACH", "FROM", "HAVE", "HAVING", "INTO", "LIKE", "MADE", "MAKE", "MANY", "MORE", "MOST",
  "OTHER", "OVER", "PART", "SAME", "SHOULD", "SINCE", "SUCH", "THAN", "THAT", "THE", "THEIR",
  "THEM", "THEN", "THERE", "THESE", "THEY", "THIS", "THOSE", "THROUGH", "UNDER", "UNTIL", "USED",
  "USING", "WERE", "WHAT", "WHEN", "WHERE", "WHICH", "WHILE", "WITH", "WITHIN", "WITHOUT", "WOULD",
  "YOUR",
  "ALBUM", "AMERICAN", "BAND", "BRITISH", "CITY", "COUNTY", "FILM", "NOVEL", "PLAY", "SERIES", "SONG",
  "STUDIO", "TELEVISION", "TOWN", "UNITED",
  "ALL", "AROUND", "CAN", "DAY", "FIRST", "TIME",
]);

const BANNED_WORDS = new Set([
  "ARSEHOLE", "ARSEHOLES", "BUGGER", "BUGGERS", "CARNAL", "FLESHLY", "IDIOT", "IDIOTS", "SENSUAL",
  "ANIMALES", "BRUTE", "BRUTES", "BULLIES", "FLOWERS", "FOOL", "FOOLS", "FREAKS", "INDIVIDUALS", "SAVAGES", "STUFFS",
]);

const NOISY_DEFINITION_TERMS = [
  "album", "band", "barbershop", "baseball", "city", "coarse", "commercial", "computer", "county seat",
  "derogatory", "dim-witted", "directed by", "documentary", "drama", "duo", "extended play", "feature film",
  "festival", "film", "football", "foreign country", "greyhound racing", "kouse", "manga", "metallic element",
  "mildly vulgar", "missile", "munition", "nickname", "nobility", "novel", "novella", "offensive",
  "optical phenomenon", "play by", "poor judgment", "portugal", "puppet sitcom", "re-released", "scheme",
  "science fiction", "series", "sexual", "slang", "song", "soundtrack", "state or other national symbol",
  "relating to animals", "studio album", "television", "terms relating", "town", "unincorporated community", "universities", "watertight hatch",
  "transportation system", "video game", "wolverhampton", "written by",
];

const ANIMAL_TOPIC_TERMS = ["animal", "animals", "fauna", "wildlife", "beast", "beasts", "mammal", "mammals", "bird", "birds", "fish", "dinosaur", "dinosaurs"];
const ANIMAL_DEFINITION_TERMS = [
  "animal", "animals", "beast", "beasts", "bird", "birds", "bovid", "canidae", "canine", "cattle", "cetacea",
  "cetacean", "cow", "creature", "domestic", "equidae", "fauna", "felidae", "feline", "fish", "genus",
  "herbivorous", "hoofed", "livestock", "mammal", "mammals", "marine", "non-human", "pig", "pinniped",
  "rodent", "ruminant", "seal", "species", "ursidae", "vertebrate", "wild", "wildlife", "zoology",
];

const IRREGULAR_SINGULARS: Record<string, string> = {
  CALVES: "CALF",
  CHILDREN: "CHILD",
  CATTLE: "COW",
  FEET: "FOOT",
  GEESE: "GOOSE",
  MICE: "MOUSE",
  OXEN: "OX",
  TEETH: "TOOTH",
};

const UNCHANGED_SINGULARS = new Set(["BISON", "DEER", "FISH", "MOOSE", "SERIES", "SHEEP", "SPECIES"]);

const GENERIC_CLUE_TERMS = [
  "word strongly associated",
  "relating to",
  "related term",
  "information about",
];

const datamuseDefinitionCache = new Map<string, Promise<string[]>>();

const normalizeAnswer = (value: unknown): string => {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
};

const cleanTopic = (value: unknown): string => {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
};

const isGoodAnswer = (answer: string): boolean => {
  return answer.length >= MIN_WORD_LENGTH
    && answer.length <= MAX_WORD_LENGTH
    && !STOP_WORDS.has(answer)
    && !BANNED_WORDS.has(answer)
    && /^[A-Z]+$/.test(answer);
};

const humanizeAnswer = (answer: string): string => {
  return answer.charAt(0) + answer.slice(1).toLowerCase();
};

const unique = <T,>(items: T[]): T[] => Array.from(new Set(items));

const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = out[index];
    out[index] = out[swapIndex];
    out[swapIndex] = temp;
  }
  return out;
};

const isRandomTopic = (topic: string): boolean => RANDOM_TOPIC_ALIASES.has(topic.toLowerCase());

const sentenceCase = (value: string): string => {
  const text = value.replace(/\s+/g, " ").replace(/\[[^\]]*\]/g, "").trim();
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const stripDefinitionPrefix = (value: string): string => {
  const withoutPartOfSpeech = value.replace(/^[a-z]+\s+/i, "").trim();
  return withoutPartOfSpeech
    .replace(/^\([^)]*\)\s*/, "")
    .trim();
};

const isUsefulDefinition = (definition: string): boolean => {
  const cleaned = stripDefinitionPrefix(definition);
  const lower = cleaned.toLowerCase();
  return cleaned.length >= 18 && !NOISY_DEFINITION_TERMS.some((term) => lower.includes(term));
};

const isAnimalTopic = (topic: string): boolean => {
  const lower = topic.toLowerCase();
  return ANIMAL_TOPIC_TERMS.some((term) => lower.includes(term));
};

const isTopicalDefinition = (topic: string, definition: string): boolean => {
  if (!isAnimalTopic(topic)) return true;
  const lower = stripDefinitionPrefix(definition).toLowerCase();
  return ANIMAL_DEFINITION_TERMS.some((term) => lower.includes(term));
};

const isNounDefinition = (definition: string): boolean => /^n\b/i.test(definition.trim());

const findBestDefinition = (topic: string, definitions: string[]): string => {
  const useful = definitions.filter(isUsefulDefinition);
  if (isAnimalTopic(topic)) {
    return useful.find((definition) => isNounDefinition(definition) && isTopicalDefinition(topic, definition)) ?? "";
  }

  return useful.find(isNounDefinition) ?? useful[0] ?? "";
};

const getSingularAnswerCandidates = (answer: string): string[] => {
  if (UNCHANGED_SINGULARS.has(answer)) return [];

  const variants: string[] = [];
  const irregular = IRREGULAR_SINGULARS[answer];
  if (irregular) variants.push(irregular);

  if (answer.endsWith("IES") && answer.length > 4 && !answer.endsWith("EIES")) {
    variants.push(`${answer.slice(0, -3)}Y`);
  }

  if (answer.endsWith("VES") && answer.length > 4) {
    variants.push(`${answer.slice(0, -3)}F`);
    variants.push(`${answer.slice(0, -3)}FE`);
  }

  if (answer.endsWith("ES") && answer.length > 4 && /(CH|SH|X|Z|S)ES$/.test(answer)) {
    variants.push(answer.slice(0, -2));
  } else if (answer.endsWith("ES") && answer.length > 4) {
    variants.push(answer.slice(0, -1));
    variants.push(answer.slice(0, -2));
  }

  if (answer.endsWith("S") && !answer.endsWith("SS") && answer.length > 3) {
    variants.push(answer.slice(0, -1));
  }

  return unique(variants)
    .filter((term) => term !== answer)
    .filter((term) => term.length >= MIN_WORD_LENGTH && /^[A-Z]+$/.test(term));
};

const getDefinitionLookupTerms = (answer: string): string[] => {
  const variants = getSingularAnswerCandidates(answer);
  variants.push(answer);
  return unique(variants)
    .filter((term) => term.length >= MIN_WORD_LENGTH && /^[A-Z]+$/.test(term))
    .map((term) => term.toLowerCase());
};

const getPreferredAnswerForms = (topic: string, answer: string): string[] => {
  const singularCandidates = getSingularAnswerCandidates(answer);
  if (singularCandidates.length === 0) return [answer];

  if (isAnimalTopic(topic)) {
    return unique([...singularCandidates, answer]);
  }

  return [answer];
};

const pluralizeDefinitionForAnswer = (answer: string, sourceAnswer: string, definition: string): string => {
  if (answer === sourceAnswer || !answer.endsWith("S")) return definition;

  return definition
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\ba member\b/gi, "members")
    .replace(/\banimal\b/gi, "animals")
    .replace(/\bbeast\b/gi, "beasts")
    .replace(/\bbird\b/gi, "birds")
    .replace(/\bbovid\b/gi, "bovids")
    .replace(/\bcetacean\b/gi, "cetaceans")
    .replace(/\bcreature\b/gi, "creatures")
    .replace(/\bfish\b/gi, "fish")
    .replace(/\binvertebrate\b/gi, "invertebrates")
    .replace(/\bmammal\b/gi, "mammals")
    .replace(/\breptile\b/gi, "reptiles")
    .replace(/\brodent\b/gi, "rodents")
    .replace(/\bvertebrate\b/gi, "vertebrates");
};

const isNoisyWikipediaPage = (title: string, extract: string): boolean => {
  const combined = `${title}. ${extract}`.toLowerCase();
  return NOISY_DEFINITION_TERMS.some((term) => combined.includes(term));
};

const redactAnswer = (sentence: string, answer: string, alternateAnswers: string[] = []): string => {
  return unique([answer, ...alternateAnswers]).reduce((current, term) => {
    const label = humanizeAnswer(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pluralSuffix = label.toLowerCase().endsWith("s") ? "" : "s?";
    return current.replace(new RegExp(`\\b${label}${pluralSuffix}\\b`, "gi"), "____");
  }, sentence);
};

const isSpecificClue = (text: string): boolean => {
  const lower = text.toLowerCase();
  return text.length >= 16 && !GENERIC_CLUE_TERMS.some((term) => lower.includes(term));
};

const makeDefinitionClue = (answer: string, definition: string, sourceAnswer = answer): string | null => {
  const source = normalizeAnswer(sourceAnswer);
  const baseDefinition = stripDefinitionPrefix(definition);
  const clueDefinition = pluralizeDefinitionForAnswer(answer, source, baseDefinition);
  const cleaned = sentenceCase(clueDefinition).replace(/\s*:+\s*$/, "");
  if (cleaned.length >= 12) {
    const redacted = redactAnswer(cleaned, answer, source ? [source] : []);
    const shortened = shortenClueText(redacted);
    const clue = shortened.endsWith(".") ? shortened : `${shortened}.`;
    return isSpecificClue(clue) ? clue : null;
  }
  return null;
};

const splitSentences = (value: string): string[] => {
  return value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24 && sentence.length <= 190);
};

const isSingleWordTitle = (title: string): boolean => /^[A-Za-z]+$/.test(title.trim());

const makeWikipediaClue = (answer: string, pageTitle: string, extract: string): string | null => {
  const answerLabel = humanizeAnswer(answer).toLowerCase();
  const sentence = splitSentences(extract).find((candidate) => {
    return candidate.toLowerCase().includes(answerLabel);
  }) ?? splitSentences(extract)[0];

  if (sentence) {
    const redacted = redactAnswer(sentenceCase(sentence), answer);
    const shortened = shortenClueText(redacted);
    const clue = shortened.endsWith(".") ? shortened : `${shortened}.`;
    return isSpecificClue(clue) ? clue : null;
  }

  return null;
};

const addEntry = (entries: Map<string, TopicEntry>, entry: TopicEntry): void => {
  if (!isGoodAnswer(entry.answer)) return;
  if (!isSpecificClue(entry.text)) return;
  if (entries.has(entry.answer)) return;
  entries.set(entry.answer, entry);
};

async function fetchDatamuseDefinitionsForTerm(term: string): Promise<string[]> {
  const normalizedTerm = normalizeAnswer(term);
  if (!isGoodAnswer(normalizedTerm)) return [];

  const cacheKey = normalizedTerm.toLowerCase();
  const cached = datamuseDefinitionCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const url = new URL("https://api.datamuse.com/words");
    url.searchParams.set("sp", cacheKey);
    url.searchParams.set("max", "8");
    url.searchParams.set("md", "d");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return [];

    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];

    return (data as DatamuseWord[])
      .filter((raw) => normalizeAnswer(raw.word) === normalizedTerm)
      .flatMap((raw) => Array.isArray(raw.defs) ? raw.defs.map((item) => String(item ?? "")).filter(Boolean) : []);
  })();

  datamuseDefinitionCache.set(cacheKey, promise);
  return promise;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));

  return results;
}

async function buildEntryFromLookup(topic: string, answer: string): Promise<TopicEntry | null> {
  for (const preferredAnswer of getPreferredAnswerForms(topic, answer)) {
    for (const lookupTerm of getDefinitionLookupTerms(preferredAnswer)) {
      const definitions = await fetchDatamuseDefinitionsForTerm(lookupTerm);
      const definition = findBestDefinition(topic, definitions);
      if (!definition) continue;

      const clue = makeDefinitionClue(preferredAnswer, definition, lookupTerm);
      if (!clue) continue;

      return {
        answer: preferredAnswer,
        text: clue,
        source: "Datamuse",
      };
    }
  }

  return null;
}

async function fetchDatamuseEntries(topic: string, count: number): Promise<TopicEntry[]> {
  const url = new URL("https://api.datamuse.com/words");
  url.searchParams.set("ml", topic);
  url.searchParams.set("topics", topic);
  url.searchParams.set("max", String(Math.max(count * 3, 90)));
  url.searchParams.set("md", "d");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return [];

  const data: unknown = await response.json();
  if (!Array.isArray(data)) return [];

  const entries = new Map<string, TopicEntry>();
  const needsLookup: string[] = [];
  for (const raw of data as DatamuseWord[]) {
    const rawWord = String(raw.word ?? "").trim();
    if (!/^[A-Za-z]+$/.test(rawWord)) continue;

    const answer = normalizeAnswer(raw.word);
    if (!isGoodAnswer(answer)) continue;

    const defs = Array.isArray(raw.defs)
      ? raw.defs.map((item) => String(item ?? "")).filter(Boolean)
      : [];
    const preferredAnswer = getPreferredAnswerForms(topic, answer)[0];
    if (preferredAnswer !== answer) {
      needsLookup.push(answer);
      continue;
    }

    const definition = findBestDefinition(topic, defs);
    const clue = definition ? makeDefinitionClue(answer, definition) : null;

    if (clue) {
      addEntry(entries, {
        answer,
        text: clue,
        source: "Datamuse",
      });
    } else {
      needsLookup.push(answer);
    }
  }

  const lookupCandidates = unique(needsLookup).slice(0, Math.max(80, count * 2));
  const lookedUpEntries = await mapWithConcurrency(
    lookupCandidates,
    8,
    async (answer) => buildEntryFromLookup(topic, answer)
  );

  for (const entry of lookedUpEntries) {
    if (entry) addEntry(entries, entry);
  }

  return Array.from(entries.values());
}

// "Random" mode picks a few of these broad, concrete themes each request and
// runs them through the same Datamuse/Wikipedia topic pipeline as a named
// topic. This gives far more variety than a fixed word list without drifting
// into the abstract/function-word junk that sorting the raw dictionary by
// text-corpus frequency produces (e.g. "also", "about", "process", "period").
const RANDOM_MODE_SEED_TOPICS = [
  "animals", "birds", "ocean life", "insects", "plants and flowers", "trees",
  "fruits and vegetables", "weather", "space and astronomy", "geography and landforms",
  "musical instruments", "tools", "vehicles and transportation", "clothing and accessories",
  "kitchen and cooking", "furniture", "sports and games", "school supplies",
  "buildings and architecture", "gemstones and minerals", "farm life", "camping and outdoors",
  "toys", "household objects", "holidays and celebrations",
];
const RANDOM_MODE_TOPICS_PER_REQUEST = 3;

// Fallback used only if the live Datamuse/Wikipedia sources are unavailable
// (network hiccup, rate limit, etc.) so "Random" mode still works offline.
async function fetchRandomEntriesFromStaticPool(count: number): Promise<TopicEntry[]> {
  const entries = new Map<string, TopicEntry>();
  const candidates = shuffle(unique(RANDOM_ANSWER_POOL))
    .map(normalizeAnswer)
    .filter(isGoodAnswer)
    .slice(0, Math.min(RANDOM_ANSWER_POOL.length, Math.max(count * 3, 90)));

  const lookedUpEntries = await mapWithConcurrency(
    candidates,
    8,
    async (answer) => buildEntryFromLookup("", answer)
  );

  for (const entry of lookedUpEntries) {
    if (entry) addEntry(entries, entry);
  }

  return Array.from(entries.values());
}

async function fetchRandomEntries(count: number): Promise<TopicEntry[]> {
  const seedTopics = shuffle([...RANDOM_MODE_SEED_TOPICS]).slice(0, RANDOM_MODE_TOPICS_PER_REQUEST);

  const groups = await Promise.all(
    seedTopics.flatMap((seedTopic) => [
      fetchDatamuseEntries(seedTopic, count),
      fetchWikipediaEntries(seedTopic, count),
    ])
  );

  const combined = new Map<string, TopicEntry>();
  for (const group of groups) {
    for (const entry of group) {
      if (!combined.has(entry.answer)) combined.set(entry.answer, entry);
    }
  }

  if (combined.size >= Math.min(20, count)) {
    return Array.from(combined.values());
  }

  // Live sources came back thin (offline/rate-limited) -- fall back to the
  // small curated pool rather than failing to generate at all.
  return fetchRandomEntriesFromStaticPool(count);
}

async function fetchWikipediaEntries(topic: string, count: number): Promise<TopicEntry[]> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", topic);
  url.searchParams.set("gsrlimit", "24");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exsentences", "3");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PuzzleWarzCrosswordTopicGenerator/1.0 (admin tool)",
    },
    cache: "no-store",
  });
  if (!response.ok) return [];

  const data: unknown = await response.json();
  const pagesRoot = (data as { query?: { pages?: Record<string, WikipediaPage> } })?.query?.pages;
  if (!pagesRoot || typeof pagesRoot !== "object") return [];

  const pages = Object.values(pagesRoot).sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
  const frequency = new Map<string, { score: number; title: string; extract: string }>();

  for (const page of pages) {
    const title = String(page.title ?? "").trim();
    const extract = String(page.extract ?? "").trim();
    if (!title || !extract) continue;
    if (isNoisyWikipediaPage(title, extract)) continue;

    if (!isSingleWordTitle(title)) continue;

    const answer = normalizeAnswer(title);
    if (!isGoodAnswer(answer)) continue;

    const current = frequency.get(answer) ?? { score: 0, title, extract };
    current.score += 10;
    frequency.set(answer, current);
  }

  const entries = new Map<string, TopicEntry>();
  const candidates = Array.from(frequency.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, count * 3);

  for (const [answer, meta] of candidates) {
    const clue = makeWikipediaClue(answer, meta.title, meta.extract);
    if (!clue) continue;

    addEntry(entries, {
      answer,
      text: clue,
      source: "Wikipedia",
    });
  }

  return Array.from(entries.values());
}

function mergeAndRankEntries(
  topic: string,
  count: number,
  groups: TopicEntry[][],
  usedAnswers: ReadonlySet<string> = new Set()
): TopicEntry[] {
  const topicAnswer = normalizeAnswer(topic);
  const unique = new Map<string, TopicEntry & { rank: number }>();

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    for (let index = 0; index < group.length; index += 1) {
      const entry = group[index];
      if (!isGoodAnswer(entry.answer)) continue;

      const sourceBonus = entry.source === "Datamuse" ? 8 : 4;
      const topicBonus = entry.answer === topicAnswer ? 12 : 0;
      const lengthBonus = entry.answer.length <= 6 ? 5 : entry.answer.length <= 9 ? 2 : 0;
      // Strongly deprioritize answers already used in an existing crossword so
      // repeat generations surface fresh words first -- but don't exclude them
      // outright, so a narrow topic can still fall back to a repeat rather than
      // failing to generate at all.
      const usedPenalty = usedAnswers.has(entry.answer) ? -1000 : 0;
      const rank = sourceBonus + topicBonus + lengthBonus + usedPenalty - index * 0.04 - groupIndex * 0.5;

      const existing = unique.get(entry.answer);
      if (!existing || rank > existing.rank) {
        unique.set(entry.answer, { ...entry, rank });
      }
    }
  }

  return Array.from(unique.values())
    .sort((a, b) => b.rank - a.rank)
    .slice(0, count)
    .map(({ answer, text, source }) => ({ answer, text, source }));
}

async function getUsedCrosswordAnswers(): Promise<Set<string>> {
  const puzzles = await prisma.puzzle.findMany({
    where: { puzzleType: "crossword" },
    select: { data: true },
  });

  const used = new Set<string>();
  for (const puzzle of puzzles) {
    const data = puzzle.data as { clues?: { across?: { answer?: unknown }[]; down?: { answer?: unknown }[] } } | null;
    if (!data?.clues) continue;
    for (const clue of [...(data.clues.across ?? []), ...(data.clues.down ?? [])]) {
      const answer = normalizeAnswer(clue.answer);
      if (answer) used.add(answer);
    }
  }
  return used;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const topic = cleanTopic((body as { topic?: unknown }).topic);
    const requestedCount = Number((body as { count?: unknown }).count);
    const count = Math.max(12, Math.min(MAX_COUNT, Number.isFinite(requestedCount) ? Math.floor(requestedCount) : DEFAULT_COUNT));

    if (topic.length < 2 && !isRandomTopic(topic)) {
      return NextResponse.json({ error: "Topic must be at least 2 characters." }, { status: 400 });
    }

    const randomMode = isRandomTopic(topic);
    const usedAnswers = await getUsedCrosswordAnswers();
    const entries = randomMode
      ? mergeAndRankEntries("", count, [shuffle(await fetchRandomEntries(count))], usedAnswers)
      : mergeAndRankEntries(topic, count, await Promise.all([
          fetchDatamuseEntries(topic, count),
          fetchWikipediaEntries(topic, count),
        ]), usedAnswers);

    if (entries.length < 4) {
      return NextResponse.json(
        { error: randomMode ? "Could not find enough random crossword-friendly words from public sources." : `Could not find enough crossword-friendly words for "${topic}" from public sources.` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      topic: randomMode ? "Random" : topic,
      entries,
      sources: Array.from(new Set(entries.map((entry) => entry.source))),
    });
  } catch (error) {
    console.error("[CROSSWORD TOPIC] Error:", error);
    return NextResponse.json({ error: "Failed to generate crossword topic words." }, { status: 500 });
  }
}