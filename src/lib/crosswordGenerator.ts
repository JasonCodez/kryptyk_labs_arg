import { validateCrosswordPuzzleData } from "@/lib/crosswordCore";

// ---------------------------------------------------------------------------
// Common English filler words (3-4 letters) with clue text.
// These are added to the generation pool automatically so the CSP can satisfy
// the 100%-double-checking constraint.  They are NOT required seeds, so they
// only appear in the final crossword when needed to fill crossing slots.
// ---------------------------------------------------------------------------
const COMMON_FILLER_BANK: readonly { answer: string; text: string }[] = [
  // 3-letter filler words.
  { answer: 'ACE', text: 'Top playing card; an expert.' },
  { answer: 'AGO', text: 'In the past.' },
  { answer: 'AID', text: 'Help or assistance.' },
  { answer: 'AIR', text: 'The atmosphere we breathe.' },
  { answer: 'ALE', text: 'Type of brewed beer.' },
  { answer: 'APT', text: 'Fitting; appropriate.' },
  { answer: 'ARC', text: 'Curved line or path.' },
  { answer: 'ARE', text: 'Plural form of "to be".' },
  { answer: 'ARM', text: 'Limb extending from the shoulder.' },
  { answer: 'ART', text: 'Creative expression.' },
  { answer: 'ASH', text: 'Residue after burning.' },
  { answer: 'AWE', text: 'Feeling of wonder.' },
  { answer: 'AXE', text: 'Chopping tool with a blade.' },
  { answer: 'BAD', text: 'Not good; below standard.' },
  { answer: 'BAR', text: 'Rod; place that serves drinks.' },
  { answer: 'BAY', text: 'Coastal inlet of water.' },
  { answer: 'BIG', text: 'Large in size.' },
  { answer: 'BIT', text: 'Small piece or amount.' },
  { answer: 'BOX', text: 'Rectangular container.' },
  { answer: 'BUD', text: 'Unopened flower; a friend.' },
  { answer: 'BUG', text: 'Small insect; software error.' },
  { answer: 'CAN', text: 'Metal container; to be able to.' },
  { answer: 'CAP', text: 'Hat with a brim or peak.' },
  { answer: 'CAR', text: 'Motor vehicle.' },
  { answer: 'COP', text: 'Informal word for a police officer.' },
  { answer: 'COT', text: 'Small portable bed.' },
  { answer: 'CRY', text: 'Shed tears; call out.' },
  { answer: 'CUP', text: 'Small drinking vessel.' },
  { answer: 'CUT', text: 'Divide with a blade.' },
  { answer: 'DAY', text: '24-hour period.' },
  { answer: 'DEN', text: 'Small cozy room; animal lair.' },
  { answer: 'DEW', text: 'Morning moisture on grass.' },
  { answer: 'DIM', text: 'Not bright; faint.' },
  { answer: 'DIP', text: 'Brief immersion; a sauce.' },
  { answer: 'EAR', text: 'Hearing organ.' },
  { answer: 'EGG', text: 'Oval object laid by birds.' },
  { answer: 'ELK', text: 'Large deer species.' },
  { answer: 'END', text: 'Final part; to conclude.' },
  { answer: 'ERA', text: 'Period of history.' },
  { answer: 'EVE', text: 'The evening before an event.' },
  { answer: 'FAD', text: 'Short-lived craze.' },
  { answer: 'FAR', text: 'At a great distance.' },
  { answer: 'FIG', text: 'Sweet Mediterranean fruit.' },
  { answer: 'FIN', text: 'Fish propulsion limb.' },
  { answer: 'FIT', text: 'In good shape; to be the right size.' },
  { answer: 'FLY', text: 'Travel through the air.' },
  { answer: 'FOG', text: 'Thick low-lying mist.' },
  { answer: 'FUN', text: 'Enjoyment; entertainment.' },
  { answer: 'FUR', text: 'Soft animal coat.' },
  { answer: 'GAP', text: 'Opening or space between things.' },
  { answer: 'GEM', text: 'Precious stone.' },
  { answer: 'GIN', text: 'Distilled spirit flavored with juniper.' },
  { answer: 'GOD', text: 'Supreme divine being.' },
  { answer: 'GUM', text: 'Sticky substance; chewing gum.' },
  { answer: 'GUN', text: 'Firearm.' },
  { answer: 'HAM', text: 'Cured leg of pork.' },
  { answer: 'HAT', text: 'Head covering.' },
  { answer: 'HAY', text: 'Dried grass used as animal feed.' },
  { answer: 'HEN', text: 'Female chicken.' },
  { answer: 'HIM', text: 'Objective case of "he".' },
  { answer: 'HIT', text: 'Strike; a popular success.' },
  { answer: 'HOP', text: 'Small jump; a plant used in brewing.' },
  { answer: 'HUB', text: 'Central point of activity.' },
  { answer: 'HUE', text: 'Color or shade.' },
  { answer: 'HUT', text: 'Small simple shelter.' },
  { answer: 'INK', text: 'Writing or printing fluid.' },
  { answer: 'INN', text: 'Small hotel or pub.' },
  { answer: 'IRE', text: 'Anger; wrath.' },
  { answer: 'JAM', text: 'Fruit preserve; traffic standstill.' },
  { answer: 'JAR', text: 'Glass or ceramic container.' },
  { answer: 'JAW', text: 'Bony structure of the mouth.' },
  { answer: 'JET', text: 'Fast aircraft; a stream of liquid.' },
  { answer: 'JOG', text: 'Slow run.' },
  { answer: 'JOY', text: 'Great happiness.' },
  { answer: 'JUG', text: 'Pitcher with a handle.' },
  { answer: 'KEG', text: 'Small barrel.' },
  { answer: 'KID', text: 'Child; young goat.' },
  { answer: 'KIT', text: 'Set of tools or supplies.' },
  { answer: 'LAB', text: 'Laboratory.' },
  { answer: 'LAP', text: 'Top of the thighs when seated.' },
  { answer: 'LAW', text: 'Legal rule.' },
  { answer: 'LEA', text: 'Open meadow.' },
  { answer: 'LEG', text: 'Limb used for walking.' },
  { answer: 'LET', text: 'Allow; permit.' },
  { answer: 'LID', text: 'Cover for a container.' },
  { answer: 'LIP', text: 'Edge of the mouth.' },
  { answer: 'LOG', text: 'Segment of a tree trunk.' },
  { answer: 'LOT', text: 'Large amount; a parcel of land.' },
  { answer: 'LOW', text: 'Not high; below average.' },
  { answer: 'MAD', text: 'Angry; insane.' },
  { answer: 'MAP', text: 'Geographic representation.' },
  { answer: 'MAT', text: 'Small floor covering.' },
  { answer: 'MET', text: 'Past tense of "meet".' },
  { answer: 'MOB', text: 'Unruly crowd.' },
  { answer: 'MOP', text: 'Floor cleaning tool.' },
  { answer: 'MUD', text: 'Wet dirt.' },
  { answer: 'NAP', text: 'Short sleep.' },
  { answer: 'NET', text: 'Mesh fabric; total after deductions.' },
  { answer: 'NOD', text: 'Head movement of agreement.' },
  { answer: 'NOR', text: '"And not"; neither.' },
  { answer: 'NUT', text: 'Hard-shelled seed; a fastener.' },
  { answer: 'OAK', text: 'Common hardwood tree.' },
  { answer: 'OAR', text: 'Paddle for rowing.' },
  { answer: 'OAT', text: 'Cereal grain used in porridge.' },
  { answer: 'ODE', text: 'Lyric poem of praise.' },
  { answer: 'OPT', text: 'Choose; decide.' },
  { answer: 'ORE', text: 'Rock containing metal.' },
  { answer: 'OWE', text: 'Be in debt to someone.' },
  { answer: 'OWL', text: 'Nocturnal bird of prey.' },
  { answer: 'OWN', text: 'Possess; belonging to oneself.' },
  { answer: 'PAD', text: 'Flat cushion; writing pad.' },
  { answer: 'PAN', text: 'Flat cooking vessel.' },
  { answer: 'PAR', text: 'Standard score in golf; equal level.' },
  { answer: 'PAT', text: 'Light gentle tap.' },
  { answer: 'PAW', text: 'Animal foot with claws.' },
  { answer: 'PAY', text: 'Give money in exchange.' },
  { answer: 'PEA', text: 'Small round green vegetable.' },
  { answer: 'PEG', text: 'Small pin or hook.' },
  { answer: 'PET', text: 'Tame animal kept at home.' },
  { answer: 'PIE', text: 'Baked dish in a pastry crust.' },
  { answer: 'PIN', text: 'Small sharp fastening nail.' },
  { answer: 'POD', text: 'Seed case of a plant.' },
  { answer: 'POP', text: 'Sudden burst; popular music.' },
  { answer: 'POT', text: 'Container for cooking or plants.' },
  { answer: 'PUB', text: 'Public house serving drinks.' },
  { answer: 'PUN', text: 'Play on words.' },
  { answer: 'PUP', text: 'Young dog.' },
  { answer: 'RAM', text: 'Male sheep; to strike hard.' },
  { answer: 'RAN', text: 'Past tense of "run".' },
  { answer: 'RAP', text: 'Sharp knock; a music genre.' },
  { answer: 'RAT', text: 'Common rodent.' },
  { answer: 'RAW', text: 'Uncooked; unprocessed.' },
  { answer: 'RAY', text: 'Beam of light.' },
  { answer: 'RED', text: 'Primary warm color.' },
  { answer: 'RID', text: 'Free from something unwanted.' },
  { answer: 'ROD', text: 'Thin straight stick.' },
  { answer: 'ROW', text: 'Line of items; to paddle a boat.' },
  { answer: 'RUG', text: 'Floor covering; a small carpet.' },
  { answer: 'RUN', text: 'Move quickly on foot.' },
  { answer: 'SAP', text: 'Plant fluid; to drain energy.' },
  { answer: 'SAW', text: 'Cutting tool; past tense of "see".' },
  { answer: 'SAY', text: 'Speak; utter words.' },
  { answer: 'SET', text: 'Collection; to place.' },
  { answer: 'SEW', text: 'Join fabric with needle and thread.' },
  { answer: 'SIN', text: 'Moral wrongdoing.' },
  { answer: 'SIP', text: 'Small drink.' },
  { answer: 'SIT', text: 'Rest on a seat.' },
  { answer: 'SOD', text: 'Grass-covered ground.' },
  { answer: 'SOY', text: 'Bean used in many Asian dishes.' },
  { answer: 'SPA', text: 'Relaxation and wellness retreat.' },
  { answer: 'SPY', text: 'Secret intelligence agent.' },
  { answer: 'SUB', text: 'Substitute; submarine.' },
  { answer: 'TAB', text: 'Small flap; a running bill.' },
  { answer: 'TAN', text: 'Light brown color; to sunbathe.' },
  { answer: 'TAP', text: 'Light touch; a faucet.' },
  { answer: 'TAR', text: 'Dark sticky substance.' },
  { answer: 'TAX', text: 'Required payment to government.' },
  { answer: 'TIP', text: 'End of something; a gratuity.' },
  { answer: 'TON', text: 'Unit of weight.' },
  { answer: 'TOP', text: 'Highest point.' },
  { answer: 'TOY', text: 'Object for play.' },
  { answer: 'TUB', text: 'Large container for bathing.' },
  { answer: 'TUG', text: 'Pull with force.' },
  { answer: 'URN', text: 'Vase-shaped container for ashes.' },
  { answer: 'USE', text: 'Put into service; employ.' },
  { answer: 'VAT', text: 'Large container for liquids.' },
  { answer: 'VET', text: 'Animal doctor.' },
  { answer: 'VIA', text: 'By way of; through.' },
  { answer: 'VOW', text: 'Solemn promise.' },
  { answer: 'WAX', text: 'Smooth coating; to grow larger.' },
  { answer: 'WEB', text: 'Network of threads; the internet.' },
  { answer: 'WED', text: 'To marry.' },
  { answer: 'WET', text: 'Damp; covered with water.' },
  { answer: 'WIN', text: 'Achieve victory.' },
  { answer: 'WIT', text: 'Cleverness; humor.' },
  { answer: 'WOE', text: 'Great sorrow or distress.' },
  { answer: 'YAM', text: 'Starchy root vegetable.' },
  { answer: 'YEA', text: 'Yes; an affirmative vote.' },
  { answer: 'YEN', text: 'Japanese currency; a strong desire.' },
  { answer: 'YEW', text: 'Evergreen tree with red berries.' },
  { answer: 'ZAP', text: 'Destroy with a burst of energy.' },
  { answer: 'ZIP', text: 'Fasten with a zipper; move fast.' },
  { answer: 'ZOO', text: 'Park where animals are kept.' },
  // 4-letter filler words.
  { answer: 'ABLE', text: 'Capable; having skill.' },
  { answer: 'ACNE', text: 'Skin condition causing pimples.' },
  { answer: 'ACRE', text: 'Unit of land area.' },
  { answer: 'AGED', text: 'Old; matured over time.' },
  { answer: 'AIDE', text: 'Assistant or helper.' },
  { answer: 'ALOE', text: 'Succulent plant with healing gel.' },
  { answer: 'ALSO', text: 'In addition; as well.' },
  { answer: 'ANTE', text: 'Bet placed before cards are dealt.' },
  { answer: 'ARCH', text: 'Curved structural element.' },
  { answer: 'AREA', text: 'Region or zone.' },
  { answer: 'ARIA', text: 'Solo in an opera.' },
  { answer: 'ARID', text: 'Extremely dry; lacking water.' },
  { answer: 'BALE', text: 'Bundle of compressed material.' },
  { answer: 'BAND', text: 'Group; a strip of material.' },
  { answer: 'BARE', text: 'Uncovered; naked.' },
  { answer: 'BARK', text: 'Tree outer covering; dog sound.' },
  { answer: 'BARN', text: 'Farm building for animals.' },
  { answer: 'BASS', text: 'Low musical note or voice.' },
  { answer: 'BEAM', text: 'Ray of light; structural support.' },
  { answer: 'BEAN', text: 'Legume seed.' },
  { answer: 'BEAT', text: 'Rhythm; to strike repeatedly.' },
  { answer: 'BELL', text: 'Ringing metal device.' },
  { answer: 'BEND', text: 'Curve; to flex.' },
  { answer: 'BIND', text: 'Fasten together.' },
  { answer: 'BIRD', text: 'Feathered winged creature.' },
  { answer: 'BITE', text: 'Use teeth to cut.' },
  { answer: 'BOLD', text: 'Brave; strong or dark in type.' },
  { answer: 'BOLT', text: 'Metal fastener; lightning flash.' },
  { answer: 'BOND', text: 'Connection; adhesive.' },
  { answer: 'BONE', text: 'Hard skeletal element.' },
  { answer: 'BORE', text: 'Dull; to drill a hole.' },
  { answer: 'BORN', text: 'Brought into existence.' },
  { answer: 'BREW', text: 'Make beer or tea.' },
  { answer: 'BROW', text: 'Forehead; eyebrow.' },
  { answer: 'BULL', text: 'Male bovine animal.' },
  { answer: 'BUSH', text: 'Woody shrubby plant.' },
  { answer: 'BUST', text: 'Break; sculpture of a head.' },
  { answer: 'CAGE', text: 'Enclosed space for animals.' },
  { answer: 'CAKE', text: 'Sweet baked dessert.' },
  { answer: 'CALM', text: 'Peaceful; not agitated.' },
  { answer: 'CAME', text: 'Past tense of "come".' },
  { answer: 'CAMP', text: 'Outdoor lodging; temporary base.' },
  { answer: 'CARD', text: 'Stiff paper rectangle.' },
  { answer: 'CARE', text: 'Concern; to look after.' },
  { answer: 'CAVE', text: 'Hollow space in rock.' },
  { answer: 'CELL', text: 'Basic unit of life; small room.' },
  { answer: 'CLAN', text: 'Family or tribal group.' },
  { answer: 'CLAW', text: 'Sharp curved nail on an animal.' },
  { answer: 'CLAY', text: 'Moldable earthy material.' },
  { answer: 'CLIP', text: 'Fasten; cut; a short video.' },
  { answer: 'CLUE', text: 'Hint that helps solve a puzzle.' },
  { answer: 'COAL', text: 'Black fossil fuel.' },
  { answer: 'CODE', text: 'System of symbols or rules.' },
  { answer: 'COIL', text: 'Spiral loop.' },
  { answer: 'COIN', text: 'Metal disc used as currency.' },
  { answer: 'COLD', text: 'Low in temperature.' },
  { answer: 'COOL', text: 'Slightly cold; fashionable.' },
  { answer: 'CORD', text: 'Thick rope or flexible cable.' },
  { answer: 'CORE', text: 'Central innermost part.' },
  { answer: 'CORN', text: 'Tall cereal crop with kernels.' },
  { answer: 'DAME', text: 'Respected woman; a title.' },
  { answer: 'DARE', text: 'Challenge boldly.' },
  { answer: 'DARK', text: 'Without light.' },
  { answer: 'DATA', text: 'Facts or information collected.' },
  { answer: 'DATE', text: 'Calendar day; a sweet fruit.' },
  { answer: 'DAWN', text: 'Beginning of daylight.' },
  { answer: 'DEAD', text: 'No longer alive.' },
  { answer: 'DEAL', text: 'Agreement; to distribute cards.' },
  { answer: 'DEAR', text: 'Cherished; expensive.' },
  { answer: 'DEBT', text: 'Money owed.' },
  { answer: 'DECK', text: 'Platform; set of playing cards.' },
  { answer: 'DEED', text: 'An action performed; legal document.' },
  { answer: 'DEEP', text: 'Extending far down.' },
  { answer: 'DEER', text: 'Graceful woodland mammal.' },
  { answer: 'DENY', text: 'Refuse to admit or grant.' },
  { answer: 'DESK', text: 'Writing or work table.' },
  { answer: 'DISC', text: 'Flat circular object.' },
  { answer: 'DISH', text: 'Plate; a food preparation.' },
  { answer: 'DOCK', text: 'Harbour berth for ships.' },
  { answer: 'DOME', text: 'Rounded roof or ceiling.' },
  { answer: 'DOSE', text: 'Measured amount of medicine.' },
  { answer: 'DOVE', text: 'Symbol of peace; a bird.' },
  { answer: 'DRIP', text: 'Fall in drops.' },
  { answer: 'DROP', text: 'Let fall; a small amount of liquid.' },
  { answer: 'DRUM', text: 'Percussion instrument.' },
  { answer: 'DUAL', text: 'Having two parts.' },
  { answer: 'DULL', text: 'Not sharp; boring.' },
  { answer: 'DUSK', text: 'Evening twilight.' },
  { answer: 'DUST', text: 'Fine dry particles.' },
  { answer: 'EACH', text: 'Every one considered individually.' },
  { answer: 'EARL', text: 'British nobleman.' },
  { answer: 'EASE', text: 'Comfort; to relax.' },
  { answer: 'EAST', text: 'Direction of sunrise.' },
  { answer: 'EMIT', text: 'Give off energy or a signal.' },
  { answer: 'EPIC', text: 'Grand in scale; heroic tale.' },
  { answer: 'EVEN', text: 'Level; equal; smooth.' },
  { answer: 'EVIL', text: 'Morally bad.' },
  { answer: 'EXAM', text: 'Formal test.' },
  { answer: 'EXIT', text: 'Way out.' },
  { answer: 'FACE', text: 'Front of the head.' },
  { answer: 'FACT', text: 'True statement.' },
  { answer: 'FADE', text: 'Lose color or strength gradually.' },
  { answer: 'FAIR', text: 'Just; a carnival.' },
  { answer: 'FARM', text: 'Agricultural land.' },
  { answer: 'FAST', text: 'Quick; to abstain from food.' },
  { answer: 'FATE', text: 'Destiny.' },
  { answer: 'FEAT', text: 'Impressive achievement.' },
  { answer: 'FEEL', text: 'Sense of touch; to experience.' },
  { answer: 'FILE', text: 'Organize; a document.' },
  { answer: 'FILL', text: 'Make full; occupy.' },
  { answer: 'FILM', text: 'Movie; a thin layer.' },
  { answer: 'FIND', text: 'Discover.' },
  { answer: 'FINE', text: 'Penalty payment; of high quality.' },
  { answer: 'FIRE', text: 'Flames; to dismiss from a job.' },
  { answer: 'FISH', text: 'Aquatic vertebrate.' },
  { answer: 'FLAG', text: 'Cloth symbol of a nation.' },
  { answer: 'FLAT', text: 'Level surface; an apartment.' },
  { answer: 'FLEW', text: 'Past tense of "fly".' },
  { answer: 'FLEX', text: 'Bend; show off muscles.' },
  { answer: 'FLOW', text: 'Move smoothly and steadily.' },
  { answer: 'FOAM', text: 'Frothy mass of bubbles.' },
  { answer: 'FOLD', text: 'Bend one part over another.' },
  { answer: 'FONT', text: 'Typography style; baptismal basin.' },
  { answer: 'FOOD', text: 'Nourishment.' },
  { answer: 'FOOT', text: 'Body part at the end of the leg.' },
  { answer: 'FORD', text: 'Shallow river crossing.' },
  { answer: 'FORK', text: 'Pronged eating utensil.' },
  { answer: 'FORM', text: 'Shape; a document to fill out.' },
  { answer: 'FORT', text: 'Military fortification.' },
  { answer: 'GAIN', text: 'Obtain; profit.' },
  { answer: 'GALE', text: 'Strong wind.' },
  { answer: 'GAME', text: 'Amusement; wild animals.' },
  { answer: 'GATE', text: 'Entrance barrier.' },
  { answer: 'GAZE', text: 'Look steadily.' },
  { answer: 'GEAR', text: 'Equipment; a toothed wheel.' },
  { answer: 'GERM', text: 'Microorganism causing disease.' },
  { answer: 'GIFT', text: 'Something given freely.' },
  { answer: 'GLAD', text: 'Pleased; happy.' },
  { answer: 'GLOW', text: 'Emit soft steady light.' },
  { answer: 'GLUE', text: 'Adhesive substance.' },
  { answer: 'GOAL', text: 'Target; a score in sport.' },
  { answer: 'GOLD', text: 'Precious yellow metal.' },
  { answer: 'GRAB', text: 'Seize quickly.' },
  { answer: 'GRIN', text: 'Broad smile.' },
  { answer: 'GRIP', text: 'Firm hold.' },
  { answer: 'GRIT', text: 'Courage; coarse particles.' },
  { answer: 'GROW', text: 'Increase in size.' },
  { answer: 'GULF', text: 'Large body of water; wide gap.' },
  { answer: 'HAIL', text: 'Icy precipitation; to greet.' },
  { answer: 'HALF', text: 'One of two equal parts.' },
  { answer: 'HALL', text: 'Corridor; large meeting room.' },
  { answer: 'HALT', text: 'Come to a stop.' },
  { answer: 'HAND', text: 'Body part at the end of the arm.' },
  { answer: 'HANG', text: 'Suspend from above.' },
  { answer: 'HARD', text: 'Firm; difficult.' },
  { answer: 'HARE', text: 'Long-eared rabbit-like animal.' },
  { answer: 'HARM', text: 'Injury; damage.' },
  { answer: 'HAZE', text: 'Slight mist or smoke.' },
  { answer: 'HEAL', text: 'Recover from injury.' },
  { answer: 'HEAT', text: 'Warmth; thermal energy.' },
  { answer: 'HEEL', text: 'Back of the foot.' },
  { answer: 'HERB', text: 'Aromatic plant used in cooking.' },
  { answer: 'HERO', text: 'Courageous person.' },
  { answer: 'HIDE', text: 'Conceal; animal skin.' },
  { answer: 'HILL', text: 'Raised landform smaller than a mountain.' },
  { answer: 'HINT', text: 'Indirect clue or suggestion.' },
  { answer: 'HOLE', text: 'Opening or hollow.' },
  { answer: 'HOME', text: 'Place where one lives.' },
  { answer: 'HOOK', text: 'Curved fastening device.' },
  { answer: 'HORN', text: 'Hard pointed growth; a musical instrument.' },
  { answer: 'HOST', text: 'Person who entertains guests.' },
  { answer: 'HULL', text: 'Body of a ship.' },
  { answer: 'HUNT', text: 'Search for prey.' },
  { answer: 'IDLE', text: 'Not active; lazy.' },
  { answer: 'INCH', text: 'Unit of length; to move slowly.' },
  { answer: 'IRON', text: 'Strong metal; to press clothes.' },
  { answer: 'ISLE', text: 'Island.' },
  { answer: 'JADE', text: 'Green precious stone.' },
  { answer: 'JOLT', text: 'Sudden sharp movement.' },
  { answer: 'JUNK', text: 'Discarded material; a type of boat.' },
  { answer: 'KEEN', text: 'Eager; sharp.' },
  { answer: 'KEPT', text: 'Past tense of "keep".' },
  { answer: 'KING', text: 'Male ruler of a kingdom.' },
  { answer: 'KITE', text: 'Wind-flown toy on a string.' },
  { answer: 'KNOW', text: 'Have knowledge of.' },
  { answer: 'LACE', text: 'Delicate fabric; a shoelace.' },
  { answer: 'LAMP', text: 'Device that produces light.' },
  { answer: 'LAND', text: 'Solid ground; to arrive.' },
  { answer: 'LANE', text: 'Narrow road or division of a road.' },
  { answer: 'LAST', text: 'Final; most recent.' },
  { answer: 'LATE', text: 'After the expected time.' },
  { answer: 'LAVA', text: 'Molten rock from a volcano.' },
  { answer: 'LEAF', text: 'Flat green part of a plant.' },
  { answer: 'LEAN', text: 'Thin; to tilt.' },
  { answer: 'LEND', text: 'Give temporarily.' },
  { answer: 'LENS', text: 'Curved glass for focusing light.' },
  { answer: 'LIME', text: 'Green citrus fruit; a mineral.' },
  { answer: 'LINE', text: 'Thin mark; a row.' },
  { answer: 'LINK', text: 'Connect; a chain element.' },
  { answer: 'LION', text: 'Large African big cat.' },
  { answer: 'LIVE', text: 'Be alive; reside.' },
  { answer: 'LORE', text: 'Body of traditional knowledge.' },
  { answer: 'LOST', text: 'Unable to find the way.' },
  { answer: 'LOUD', text: 'High in volume.' },
  { answer: 'LURE', text: 'Attract; something that tempts.' },
  { answer: 'LUST', text: 'Strong desire.' },
  { answer: 'MACE', text: 'Heavy club; a spice.' },
  { answer: 'MAIL', text: 'Postal letters and packages.' },
  { answer: 'MAIN', text: 'Most important; chief.' },
  { answer: 'MAKE', text: 'Create or produce.' },
  { answer: 'MALE', text: 'Of the sex that fertilizes eggs.' },
  { answer: 'MALL', text: 'Large shopping center.' },
  { answer: 'MALT', text: 'Germinated grain used in brewing.' },
  { answer: 'MASK', text: 'Face covering.' },
  { answer: 'MAST', text: 'Tall vertical pole on a ship.' },
  { answer: 'MATE', text: 'Partner; companion.' },
  { answer: 'MAZE', text: 'Network of confusing paths.' },
  { answer: 'MEAL', text: 'Food eaten at one time.' },
  { answer: 'MELT', text: 'Change from solid to liquid.' },
  { answer: 'MERE', text: 'Nothing more than; a lake.' },
  { answer: 'MESH', text: 'Network of wires or threads.' },
  { answer: 'MILD', text: 'Not extreme; gentle.' },
  { answer: 'MILK', text: 'White liquid from mammals.' },
  { answer: 'MILL', text: 'Building for grinding grain.' },
  { answer: 'MIND', text: 'Mental faculty; to care about.' },
  { answer: 'MINT', text: 'Aromatic herb; a place making coins.' },
  { answer: 'MIST', text: 'Light fog.' },
  { answer: 'MOAN', text: 'Low sound of pain.' },
  { answer: 'MOCK', text: 'Imitate; not genuine.' },
  { answer: 'MODE', text: 'Way or manner; a fashion.' },
  { answer: 'MOLD', text: 'Fungal growth; a shaping form.' },
  { answer: 'MOLE', text: 'Small burrowing mammal.' },
  { answer: 'MOOD', text: 'Emotional state.' },
  { answer: 'MOOR', text: 'Open upland; to secure a boat.' },
  { answer: 'MOTH', text: 'Nocturnal insect related to butterfly.' },
  { answer: 'MULE', text: 'Hybrid of donkey and horse.' },
  { answer: 'MUSK', text: 'Strong animal scent.' },
  { answer: 'MUTE', text: 'Unable to speak; silent.' },
  { answer: 'NAIL', text: 'Metal fastener; fingernail.' },
  { answer: 'NAME', text: 'Word by which someone is known.' },
  { answer: 'NEON', text: 'Bright glowing gas used in signs.' },
  { answer: 'NEST', text: 'Structure built by birds for eggs.' },
  { answer: 'NICE', text: 'Pleasant; agreeable.' },
  { answer: 'NODE', text: 'Point of connection in a network.' },
  { answer: 'NOON', text: 'Midday; twelve o\'clock.' },
  { answer: 'NORM', text: 'Standard or typical pattern.' },
  { answer: 'NOSE', text: 'Organ of smell.' },
  { answer: 'NOTE', text: 'Short written message; musical tone.' },
  { answer: 'NOUN', text: 'Word naming a person, place, or thing.' },
  { answer: 'OPEN', text: 'Not closed; to unlock.' },
  { answer: 'OVAL', text: 'Egg-shaped.' },
  { answer: 'OVEN', text: 'Heated chamber for cooking.' },
  { answer: 'OVER', text: 'Above; finished.' },
  { answer: 'PACE', text: 'Rate of walking; a step.' },
  { answer: 'PACK', text: 'Bundle; to fill.' },
  { answer: 'PAGE', text: 'One side of a leaf in a book.' },
  { answer: 'PAIN', text: 'Unpleasant sensation.' },
  { answer: 'PAIR', text: 'Two matching items.' },
  { answer: 'PEAK', text: 'Highest point of a mountain.' },
  { answer: 'PEAT', text: 'Decomposed vegetation used as fuel.' },
  { answer: 'PEEL', text: 'Remove the skin of.' },
  { answer: 'PILE', text: 'Stack; a heap.' },
  { answer: 'PINE', text: 'Evergreen conifer tree.' },
  { answer: 'PINK', text: 'Light red color.' },
  { answer: 'PLAN', text: 'Organized scheme; a diagram.' },
  { answer: 'PLOD', text: 'Walk heavily and slowly.' },
  { answer: 'PLOT', text: 'Plan secretly; story outline.' },
  { answer: 'PLUM', text: 'Purple-red stone fruit.' },
  { answer: 'POLE', text: 'Long thin rod; either end of an axis.' },
  { answer: 'POND', text: 'Small body of still water.' },
  { answer: 'PORE', text: 'Tiny opening in skin.' },
  { answer: 'POSE', text: 'Position; to present a question.' },
  { answer: 'POST', text: 'Upright support; mail.' },
  { answer: 'POUR', text: 'Cause liquid to flow.' },
  { answer: 'PULL', text: 'Apply force toward oneself.' },
  { answer: 'PUMP', text: 'Device to move fluids.' },
  { answer: 'PURE', text: 'Not mixed; clean.' },
  { answer: 'PUSH', text: 'Apply force away from oneself.' },
  { answer: 'RACK', text: 'Framework for storage.' },
  { answer: 'RAGE', text: 'Violent anger.' },
  { answer: 'RAIL', text: 'Horizontal bar; train track.' },
  { answer: 'RAIN', text: 'Water falling from clouds.' },
  { answer: 'RAKE', text: 'Garden tool with tines.' },
  { answer: 'RAMP', text: 'Sloping surface between levels.' },
  { answer: 'RASH', text: 'Skin irritation; hasty.' },
  { answer: 'RATE', text: 'Measure of something per unit.' },
  { answer: 'REAL', text: 'Actually existing; genuine.' },
  { answer: 'REEL', text: 'Spool for thread or film.' },
  { answer: 'RELY', text: 'Depend on with confidence.' },
  { answer: 'REST', text: 'Relaxation; the remainder.' },
  { answer: 'RIDE', text: 'Travel on or in something.' },
  { answer: 'RING', text: 'Circular band; to make a bell sound.' },
  { answer: 'RIOT', text: 'Violent public disturbance.' },
  { answer: 'RISE', text: 'Move upward.' },
  { answer: 'RISK', text: 'Possibility of danger.' },
  { answer: 'RITE', text: 'Ceremonial act.' },
  { answer: 'ROAM', text: 'Wander without fixed direction.' },
  { answer: 'ROAR', text: 'Deep loud sound.' },
  { answer: 'ROBE', text: 'Long loose garment.' },
  { answer: 'ROLE', text: 'Function or part played.' },
  { answer: 'ROOF', text: 'Top covering of a building.' },
  { answer: 'ROOT', text: 'Underground plant part; origin.' },
  { answer: 'ROPE', text: 'Thick twisted cord.' },
  { answer: 'ROSE', text: 'Flowering plant with thorns.' },
  { answer: 'RULE', text: 'Regulation; to govern.' },
  { answer: 'RUSH', text: 'Move with urgency.' },
  { answer: 'SACK', text: 'Large bag; to dismiss.' },
  { answer: 'SAFE', text: 'Free from danger; a strongbox.' },
  { answer: 'SAGE', text: 'Wise; an aromatic herb.' },
  { answer: 'SAIL', text: 'Fabric that catches wind.' },
  { answer: 'SAKE', text: 'Benefit; a Japanese rice wine.' },
  { answer: 'SALE', text: 'Exchange of goods for money.' },
  { answer: 'SALT', text: 'Mineral used to season food.' },
  { answer: 'SAME', text: 'Identical; unchanged.' },
  { answer: 'SAND', text: 'Fine granules of rock.' },
  { answer: 'SANE', text: 'Mentally sound.' },
  { answer: 'SEAL', text: 'Marine mammal; to close tightly.' },
  { answer: 'SEED', text: 'Plant embryo in a coating.' },
  { answer: 'SELF', text: 'One\'s own identity.' },
  { answer: 'SEND', text: 'Cause to go somewhere.' },
  { answer: 'SHED', text: 'Small storage building; to lose.' },
  { answer: 'SHOE', text: 'Foot covering.' },
  { answer: 'SHOW', text: 'Display; a performance.' },
  { answer: 'SICK', text: 'Unwell; ill.' },
  { answer: 'SIDE', text: 'Surface; a team.' },
  { answer: 'SILK', text: 'Smooth fine fabric.' },
  { answer: 'SING', text: 'Produce musical tones vocally.' },
  { answer: 'SITE', text: 'Location; a web address.' },
  { answer: 'SIZE', text: 'Extent or dimensions.' },
  { answer: 'SLAM', text: 'Shut with force.' },
  { answer: 'SLIM', text: 'Thin; to reduce.' },
  { answer: 'SLOT', text: 'Narrow opening.' },
  { answer: 'SLOW', text: 'Not fast.' },
  { answer: 'SNAP', text: 'Break sharply; a quick photo.' },
  { answer: 'SOCK', text: 'Foot garment; to punch.' },
  { answer: 'SOIL', text: 'Earth; to make dirty.' },
  { answer: 'SOLE', text: 'Only; bottom of a shoe.' },
  { answer: 'SONG', text: 'Musical composition for voice.' },
  { answer: 'SORT', text: 'Arrange in groups; a type.' },
  { answer: 'SOUL', text: 'Spiritual essence.' },
  { answer: 'SOUR', text: 'Having an acid taste.' },
  { answer: 'SPAN', text: 'Length; to extend across.' },
  { answer: 'SPIN', text: 'Rotate rapidly.' },
  { answer: 'SPOT', text: 'Location; a small mark.' },
  { answer: 'SPUR', text: 'Incentive; a horse-riding device.' },
  { answer: 'STIR', text: 'Mix; to cause activity.' },
  { answer: 'STOP', text: 'Cease movement or action.' },
  { answer: 'SUIT', text: 'Set of matching clothes; to be appropriate.' },
  { answer: 'SUNG', text: 'Past participle of "sing".' },
  { answer: 'SWAP', text: 'Exchange one thing for another.' },
  { answer: 'TALE', text: 'Story; a narrative.' },
  { answer: 'TALL', text: 'Of great height.' },
  { answer: 'TAME', text: 'Not wild; to domesticate.' },
  { answer: 'TAPE', text: 'Adhesive strip; a recording.' },
  { answer: 'TASK', text: 'Piece of work to do.' },
  { answer: 'TELL', text: 'Communicate; inform.' },
  { answer: 'TEND', text: 'Look after; incline.' },
  { answer: 'TENT', text: 'Portable canvas shelter.' },
  { answer: 'TERM', text: 'Period of time; a word or phrase.' },
  { answer: 'TEST', text: 'Examination; a trial.' },
  { answer: 'THAN', text: 'Used in comparisons.' },
  { answer: 'THEN', text: 'At that time; next.' },
  { answer: 'TIDE', text: 'Rise and fall of sea level.' },
  { answer: 'TIER', text: 'Row or level in a structure.' },
  { answer: 'TILT', text: 'Lean at an angle.' },
  { answer: 'TIME', text: 'Indefinite sequence of events.' },
  { answer: 'TIRE', text: 'Become weary; a rubber wheel covering.' },
  { answer: 'TOLD', text: 'Past tense of "tell".' },
  { answer: 'TOMB', text: 'Burial chamber.' },
  { answer: 'TONE', text: 'Quality of sound; a shade of color.' },
  { answer: 'TORN', text: 'Ripped; past participle of "tear".' },
  { answer: 'TOSS', text: 'Throw lightly.' },
  { answer: 'TOUR', text: 'Traveling visit.' },
  { answer: 'TOWN', text: 'Small urban settlement.' },
  { answer: 'TRAP', text: 'Device for catching animals.' },
  { answer: 'TRAY', text: 'Flat container for carrying items.' },
  { answer: 'TREE', text: 'Tall perennial woody plant.' },
  { answer: 'TREK', text: 'Long arduous journey on foot.' },
  { answer: 'TRIM', text: 'Cut neatly; in good condition.' },
  { answer: 'TRIP', text: 'Journey; to stumble.' },
  { answer: 'TRUE', text: 'In accordance with fact.' },
  { answer: 'TUBE', text: 'Hollow cylinder.' },
  { answer: 'TUNE', text: 'Musical melody.' },
  { answer: 'TURF', text: 'Grass-covered ground.' },
  { answer: 'TYPE', text: 'Category; to keyboard text.' },
  { answer: 'UGLY', text: 'Unpleasant to look at.' },
  { answer: 'UNIT', text: 'Single item; a measurement.' },
  { answer: 'UPON', text: 'On top of.' },
  { answer: 'URGE', text: 'Encourage strongly; a strong desire.' },
  { answer: 'VALE', text: 'Valley.' },
  { answer: 'VANE', text: 'Flat blade that spins in wind.' },
  { answer: 'VEIL', text: 'Thin covering.' },
  { answer: 'VEIN', text: 'Blood vessel; a streak in rock.' },
  { answer: 'VINE', text: 'Climbing plant.' },
  { answer: 'VOTE', text: 'Formal choice in an election.' },
  { answer: 'WADE', text: 'Walk through water.' },
  { answer: 'WAGE', text: 'Pay for work; to carry on.' },
  { answer: 'WAIT', text: 'Stay until something happens.' },
  { answer: 'WAKE', text: 'Stop sleeping; a watch over a body.' },
  { answer: 'WAND', text: 'Thin magic stick.' },
  { answer: 'WARD', text: 'Room in a hospital; to guard.' },
  { answer: 'WARE', text: 'Manufactured goods.' },
  { answer: 'WARM', text: 'Moderately hot.' },
  { answer: 'WAVE', text: 'Moving ridge on water; to beckon.' },
  { answer: 'WEAK', text: 'Lacking strength.' },
  { answer: 'WEED', text: 'Unwanted plant.' },
  { answer: 'WELL', text: 'In good health; a water source.' },
  { answer: 'WENT', text: 'Past tense of "go".' },
  { answer: 'WEST', text: 'Direction of sunset.' },
  { answer: 'WIDE', text: 'Extending far from side to side.' },
  { answer: 'WILD', text: 'Untamed; not cultivated.' },
  { answer: 'WILL', text: 'Future auxiliary; determination.' },
  { answer: 'WIND', text: 'Moving air; to coil.' },
  { answer: 'WINE', text: 'Fermented grape drink.' },
  { answer: 'WING', text: 'Limb for flight.' },
  { answer: 'WISE', text: 'Having good judgment.' },
  { answer: 'WISH', text: 'Desire something.' },
  { answer: 'WOKE', text: 'Past tense of "wake".' },
  { answer: 'WOLF', text: 'Wild canine predator.' },
  { answer: 'WOOD', text: 'Hard material from trees.' },
  { answer: 'WORD', text: 'Meaningful unit of language.' },
  { answer: 'WORE', text: 'Past tense of "wear".' },
  { answer: 'WORM', text: 'Soft elongated invertebrate.' },
  { answer: 'WRAP', text: 'Enclose in material.' },
  { answer: 'WREN', text: 'Small brown songbird.' },
  { answer: 'YELL', text: 'Cry out loudly.' },
  { answer: 'YOLK', text: 'Yellow part of an egg.' },
  { answer: 'ZEAL', text: 'Great enthusiasm.' },
  { answer: 'ZERO', text: 'The number nought.' },
  { answer: 'ZINC', text: 'Bluish-white metallic element.' },
  { answer: 'ZONE', text: 'Defined area or region.' },
] as const;

export type CrosswordDirection = "across" | "down";

export interface CrosswordGeneratorSeedEntry {
  answer: string;
  text: string;
}

interface CrosswordSlot {
  number: number;
  row: number;
  col: number;
  length: number;
}

interface CrosswordSlotGroup {
  across: CrosswordSlot[];
  down: CrosswordSlot[];
}

interface CrosswordFilledSlot extends CrosswordSlot {
  direction: CrosswordDirection;
  id: string;
  intersections: number;
}

export interface CrosswordGeneratedClue extends CrosswordSlot {
  direction: CrosswordDirection;
  answer: string;
  text: string;
}

export interface CrosswordGenerationResult {
  generatedLayout: string[];
  generatedRows: number;
  generatedCols: number;
  whiteCellCount: number;
  generatedAcross: CrosswordGeneratedClue[];
  generatedDown: CrosswordGeneratedClue[];
  usedSeedCount: number;
  unplacedSeedAnswers: string[];
  strategy: string;
}

export interface CrosswordGenerationRequest {
  seedEntries: CrosswordGeneratorSeedEntry[];
  fillPoolEntries?: CrosswordGeneratorSeedEntry[];
  /** Set to true to suppress the built-in common-word filler bank. */
  disableFillerBank?: boolean;
  gridRows?: number;
  gridCols?: number;
  minGrid?: number;
  maxGrid?: number;
  preferredSide?: number;
  maxLayoutAttemptsPerSide?: number;
  maxDurationMs?: number;
}

const ABSOLUTE_MIN_GRID = 3;
const ABSOLUTE_MAX_GRID = 30;
const DEFAULT_MIN_GRID = 9;
const DEFAULT_MAX_GRID = 21;
const DEFAULT_MAX_DURATION_MS = 2800;

const SHORT_SLOT_CORE_LAYOUTS = [
  [
    "...##...",
    "...#....",
    "...#....",
    "##...###",
    "###...##",
    "....#...",
    "....#...",
    "...##...",
  ],
  [
    "...##...",
    "...##...",
    "...#....",
    "#....###",
    "###....#",
    "....#...",
    "...##...",
    "...##...",
  ],
  [
    "...###...",
    "...###...",
    "...##....",
    "##....###",
    "###...###",
    "###....##",
    "....##...",
    "...###...",
    "...###...",
  ],
  [
    "#######...",
    "#######...",
    "...###....",
    "...#...###",
    "...#....##",
    "##....#...",
    "###...#...",
    "....###...",
    "...#######",
    "...#######",
  ],
] as const;

const clampInt = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const normalizeAnswer = (value: unknown): string => {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
};

const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = out[i];
    out[i] = out[j];
    out[j] = temp;
  }
  return out;
};

const padLayoutToSide = (coreRows: readonly string[], side: number): string[] | null => {
  const coreSide = coreRows.length;
  if (coreSide === 0 || coreRows.some((row) => row.length !== coreSide)) return null;
  if (side < coreSide || (side - coreSide) % 2 !== 0) return null;

  const pad = (side - coreSide) / 2;
  const blackRow = "#".repeat(side);
  const padded: string[] = [];

  for (let i = 0; i < pad; i += 1) {
    padded.push(blackRow);
  }

  const sidePad = "#".repeat(pad);
  for (const row of coreRows) {
    padded.push(`${sidePad}${row}${sidePad}`);
  }

  for (let i = 0; i < pad; i += 1) {
    padded.push(blackRow);
  }

  return padded;
};

const rotateLayoutClockwise = (layoutRows: readonly string[]): string[] => {
  const side = layoutRows.length;
  return Array.from({ length: side }, (_, row) => {
    let next = "";
    for (let col = side - 1; col >= 0; col -= 1) {
      next += layoutRows[col][row];
    }
    return next;
  });
};

const flipLayoutHorizontal = (layoutRows: readonly string[]): string[] => {
  return layoutRows.map((row) => row.split("").reverse().join(""));
};

const getLayoutOrientations = (layoutRows: readonly string[]): string[][] => {
  const orientations: string[][] = [];
  const seen = new Set<string>();
  let current = [...layoutRows];

  for (let turn = 0; turn < 4; turn += 1) {
    for (const candidate of [current, flipLayoutHorizontal(current)]) {
      const signature = candidate.join("\n");
      if (!seen.has(signature)) {
        seen.add(signature);
        orientations.push(candidate);
      }
    }
    current = rotateLayoutClockwise(current);
  }

  return orientations;
};

const buildOpenShortSlotTemplateLayouts = (maxGrid: number): string[][] => {
  const layouts: string[][] = [];
  const seen = new Set<string>();

  for (const core of SHORT_SLOT_CORE_LAYOUTS) {
    if (core.length > maxGrid) continue;
    for (const oriented of getLayoutOrientations(core)) {
      const shape = getLayoutShapeStats(oriented);
      if (shape.blackRatio >= 0.46 || shape.borderBlackRatio >= 0.56) continue;

      const signature = oriented.join("\n");
      if (seen.has(signature)) continue;
      seen.add(signature);
      layouts.push(oriented);
    }
  }

  return shuffle(layouts).sort((a, b) => {
    const aSlots = analyzeLayout(a, 3);
    const bSlots = analyzeLayout(b, 3);
    const aCount = aSlots ? aSlots.slots.across.length + aSlots.slots.down.length : 0;
    const bCount = bSlots ? bSlots.slots.across.length + bSlots.slots.down.length : 0;
    return bCount - aCount;
  });
};

const buildShortSlotTemplateLayouts = (minGrid: number, maxGrid: number): string[][] => {
  const layouts: string[][] = [];

  for (const core of SHORT_SLOT_CORE_LAYOUTS) {
    for (let side = Math.max(minGrid, core.length); side <= maxGrid; side += 1) {
      const padded = padLayoutToSide(core, side);
      if (!padded) continue;
      const signature = padded.join("\n");
      if (layouts.some((layout) => layout.join("\n") === signature)) continue;
      layouts.push(padded);
    }
  }

  return layouts.sort((a, b) => a.length - b.length);
};

const getLayoutShapeStats = (layoutRows: string[]): {
  blackRatio: number;
  borderBlackRatio: number;
  solidBlackEdges: number;
} => {
  const rows = layoutRows.length;
  const cols = layoutRows[0]?.length ?? 0;
  if (rows === 0 || cols === 0) {
    return { blackRatio: 0, borderBlackRatio: 0, solidBlackEdges: 0 };
  }

  let blackCells = 0;
  let borderCells = 0;
  let borderBlackCells = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const isBlack = layoutRows[row][col] === "#";
      if (isBlack) blackCells += 1;

      const isBorder = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
      if (isBorder) {
        borderCells += 1;
        if (isBlack) borderBlackCells += 1;
      }
    }
  }

  const topSolid = layoutRows[0].split("").every((cell) => cell === "#");
  const bottomSolid = layoutRows[rows - 1].split("").every((cell) => cell === "#");
  const leftSolid = layoutRows.every((row) => row[0] === "#");
  const rightSolid = layoutRows.every((row) => row[cols - 1] === "#");

  return {
    blackRatio: blackCells / (rows * cols),
    borderBlackRatio: borderCells > 0 ? borderBlackCells / borderCells : 0,
    solidBlackEdges: [topSolid, bottomSolid, leftSolid, rightSolid].filter(Boolean).length,
  };
};

const hasNaturalLayoutShape = (attempt: CrosswordGenerationResult): boolean => {
  const shape = getLayoutShapeStats(attempt.generatedLayout);
  return shape.solidBlackEdges === 0
    && shape.borderBlackRatio < 0.72
    && shape.blackRatio < 0.42;
};

const normalizeSeedEntries = (entries: CrosswordGeneratorSeedEntry[]): CrosswordGeneratorSeedEntry[] => {
  const unique = new Map<string, string>();

  for (const entry of entries) {
    const answer = normalizeAnswer(entry.answer);
    const text = String(entry.text ?? "").trim();
    if (answer.length < 3 || !text) continue;
    if (!unique.has(answer)) {
      unique.set(answer, text);
    }
  }

  return Array.from(unique.entries()).map(([answer, text]) => ({
    answer,
    text,
  }));
};

const extractSlots = (layoutRows: string[], minEntryLength: number): CrosswordSlotGroup => {
  const rows = layoutRows.length;
  const cols = layoutRows[0]?.length ?? 0;

  const isWhite = (row: number, col: number): boolean => {
    return row >= 0 && row < rows && col >= 0 && col < cols && layoutRows[row][col] !== "#";
  };

  const runLength = (row: number, col: number, direction: CrosswordDirection): number => {
    let r = row;
    let c = col;
    let length = 0;

    while (isWhite(r, c)) {
      length += 1;
      if (direction === "across") {
        c += 1;
      } else {
        r += 1;
      }
    }

    return length;
  };

  const across: CrosswordSlot[] = [];
  const down: CrosswordSlot[] = [];
  let nextNumber = 1;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!isWhite(row, col)) continue;

      const leftBlack = col === 0 || !isWhite(row, col - 1);
      const upBlack = row === 0 || !isWhite(row - 1, col);

      const acrossLength = leftBlack ? runLength(row, col, "across") : 0;
      const downLength = upBlack ? runLength(row, col, "down") : 0;

      const startsAcross = leftBlack && acrossLength >= minEntryLength;
      const startsDown = upBlack && downLength >= minEntryLength;

      if (!startsAcross && !startsDown) continue;

      if (startsAcross) {
        across.push({ number: nextNumber, row, col, length: acrossLength });
      }
      if (startsDown) {
        down.push({ number: nextNumber, row, col, length: downLength });
      }

      nextNumber += 1;
    }
  }

  return { across, down };
};

const analyzeLayout = (
  layoutRows: string[],
  minEntryLength: number,
  requireCheckedCells = true
): {
  slots: CrosswordSlotGroup;
  whiteCellCount: number;
} | null => {
  const rows = layoutRows.length;
  const cols = layoutRows[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;

  const slots = extractSlots(layoutRows, minEntryLength);
  if (slots.across.length === 0 || slots.down.length === 0) {
    return null;
  }

  const acrossCoverage = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const downCoverage = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  for (const slot of slots.across) {
    for (let i = 0; i < slot.length; i += 1) {
      acrossCoverage[slot.row][slot.col + i] += 1;
    }
  }

  for (const slot of slots.down) {
    for (let i = 0; i < slot.length; i += 1) {
      downCoverage[slot.row + i][slot.col] += 1;
    }
  }

  let whiteCellCount = 0;
  let firstWhite: [number, number] | null = null;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (layoutRows[row][col] === "#") continue;

      whiteCellCount += 1;
      if (!firstWhite) {
        firstWhite = [row, col];
      }

      const across = acrossCoverage[row][col];
      const down = downCoverage[row][col];
      if (requireCheckedCells ? across < 1 || down < 1 : across + down < 1) {
        return null;
      }
    }
  }

  if (!firstWhite || whiteCellCount === 0) {
    return null;
  }

  const seen = new Set<string>();
  const queue: Array<[number, number]> = [firstWhite];
  seen.add(`${firstWhite[0]},${firstWhite[1]}`);

  while (queue.length > 0) {
    const [row, col] = queue.shift() as [number, number];
    const neighbors: Array<[number, number]> = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ];

    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (layoutRows[nr][nc] === "#") continue;

      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;

      seen.add(key);
      queue.push([nr, nc]);
    }
  }

  if (seen.size !== whiteCellCount) {
    return null;
  }

  return {
    slots,
    whiteCellCount,
  };
};

const createSymmetricLayout = (
  rows: number,
  cols: number,
  targetBlackRatio: number,
  minEntryLength: number,
  poolCountByLength?: ReadonlyMap<number, number>,
  maxSlotLength?: number,
  requireCheckedCells = true
): string[] | null => {
  const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => "."));
  const toLayoutRows = (): string[] => grid.map((row) => row.join(""));

  const totalCells = rows * cols;
  let targetBlack = Math.floor(totalCells * targetBlackRatio);
  if (targetBlack % 2 === 1) {
    targetBlack -= 1;
  }
  targetBlack = Math.max(2, targetBlack);

  const candidatePairs: Array<[number, number]> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const mirrorRow = rows - 1 - row;
      const mirrorCol = cols - 1 - col;

      if (row > mirrorRow) continue;
      if (row === mirrorRow && col > mirrorCol) continue;
      if (row === mirrorRow && col === mirrorCol) continue;

      candidatePairs.push([row, col]);
    }
  }

  const minWhiteCells = Math.max(18, Math.floor(totalCells * (minEntryLength >= 4 ? 0.42 : 0.5)));

  let blackCount = 0;
  for (const [row, col] of shuffle(candidatePairs)) {
    if (blackCount >= targetBlack) break;

    const mirrorRow = rows - 1 - row;
    const mirrorCol = cols - 1 - col;

    if (grid[row][col] === "#" || grid[mirrorRow][mirrorCol] === "#") continue;

    grid[row][col] = "#";
    grid[mirrorRow][mirrorCol] = "#";

    const trialLayout = toLayoutRows();
    const analysis = analyzeLayout(trialLayout, minEntryLength, requireCheckedCells);

    if (!analysis || analysis.whiteCellCount < minWhiteCells) {
      grid[row][col] = ".";
      grid[mirrorRow][mirrorCol] = ".";
      continue;
    }

    blackCount += 2;

    if (blackCount >= targetBlack && Math.random() < 0.25) {
      break;
    }
  }

  const finalLayout = toLayoutRows();
  const finalAnalysis = analyzeLayout(finalLayout, minEntryLength, requireCheckedCells);
  if (!finalAnalysis) {
    return null;
  }

  // Now keep ADDING black squares until every slot fits within maxSlotLength.
  // Track direction explicitly so we know which axis to break.
  if (maxSlotLength) {
    let safety = 200;
    while (safety-- > 0) {
      const recheck = analyzeLayout(toLayoutRows(), minEntryLength, requireCheckedCells);
      if (!recheck) return null;

      // Find the longest slot, tracking direction.
      type DirectedSlot = { dir: "across" | "down"; row: number; col: number; length: number };
      let longest: DirectedSlot | null = null;
      for (const s of recheck.slots.across) {
        if (!longest || s.length > longest.length) longest = { dir: "across", row: s.row, col: s.col, length: s.length };
      }
      for (const s of recheck.slots.down) {
        if (!longest || s.length > longest.length) longest = { dir: "down", row: s.row, col: s.col, length: s.length };
      }
      if (!longest || longest.length <= maxSlotLength) break;

      // Try positions inside the slot to break it (avoid creating sub-slots
      // shorter than minEntryLength).
      const offsets: number[] = [];
      const center = Math.floor(longest.length / 2);
      offsets.push(center);
      for (let d = 1; d < longest.length; d += 1) {
        offsets.push(center - d);
        offsets.push(center + d);
      }

      let placed = false;
      for (const off of offsets) {
        if (off < minEntryLength) continue;
        if ((longest.length - 1 - off) < minEntryLength) continue;

        const cellR = longest.dir === "down" ? longest.row + off : longest.row;
        const cellC = longest.dir === "across" ? longest.col + off : longest.col;
        const mr = rows - 1 - cellR;
        const mc = cols - 1 - cellC;

        if (grid[cellR][cellC] === "#") continue;
        if (cellR !== mr || cellC !== mc) {
          if (grid[mr][mc] === "#") continue;
        }

        grid[cellR][cellC] = "#";
        if (cellR !== mr || cellC !== mc) grid[mr][mc] = "#";

        const probe = analyzeLayout(toLayoutRows(), minEntryLength, requireCheckedCells);
        if (!probe || probe.whiteCellCount < minWhiteCells) {
          grid[cellR][cellC] = ".";
          if (cellR !== mr || cellC !== mc) grid[mr][mc] = ".";
          continue;
        }
        placed = true;
        break;
      }

      if (!placed) return null;
    }
    if (safety <= 0) return null;
  }

  const trulyFinalLayout = toLayoutRows();
  const trulyFinalAnalysis = analyzeLayout(trulyFinalLayout, minEntryLength, requireCheckedCells);
  if (!trulyFinalAnalysis) return null;

  // Reject layouts whose slot-length distribution exceeds pool supply.
  // 0.75 safety factor: require pool(L) * 0.75 >= count(L) so the CSP has
  // slack to explore.  When count == pool exactly the solver faces a
  // "word square" sub-problem that almost always fails.
  if (poolCountByLength && poolCountByLength.size > 0) {
    const allFinalSlots = [...trulyFinalAnalysis.slots.across, ...trulyFinalAnalysis.slots.down];
    const slotCounts = new Map<number, number>();
    for (const slot of allFinalSlots) {
      slotCounts.set(slot.length, (slotCounts.get(slot.length) ?? 0) + 1);
    }
    for (const [len, cnt] of slotCounts) {
      const available = poolCountByLength.get(len) ?? 0;
      if (Math.floor(available * 0.75) < cnt) {
        return null;
      }
    }
  }

  return trulyFinalLayout;
};

const buildSlotId = (direction: CrosswordDirection, slot: CrosswordSlot): string => {
  return `${direction}:${slot.number}:${slot.row}:${slot.col}`;
};

const STANDARD_PLACEMENT_FILLER_BANK: readonly { answer: string; text: string }[] = [
  { answer: "ABOUT", text: "Concerning; approximately." },
  { answer: "ABOVE", text: "Higher than something." },
  { answer: "ACROSS", text: "From one side to the other." },
  { answer: "ACTOR", text: "A performer in a play or film." },
  { answer: "AFTER", text: "Later than something." },
  { answer: "AGAIN", text: "One more time." },
  { answer: "ALERT", text: "Watchful and ready." },
  { answer: "ALIVE", text: "Living; not dead." },
  { answer: "ALONG", text: "Moving beside or in a line with." },
  { answer: "AMONG", text: "Surrounded by; in the company of." },
  { answer: "APPLE", text: "Common crisp fruit." },
  { answer: "AUDIO", text: "Sound, especially recorded sound." },
  { answer: "BASIC", text: "Fundamental or simple." },
  { answer: "BEACH", text: "Sandy shore by water." },
  { answer: "BEGIN", text: "Start or commence." },
  { answer: "BELOW", text: "Lower than something." },
  { answer: "BOARD", text: "Flat piece of wood; governing group." },
  { answer: "BRAIN", text: "Organ used for thought." },
  { answer: "BRAVE", text: "Showing courage." },
  { answer: "BREAD", text: "Baked food made from flour." },
  { answer: "BRICK", text: "Rectangular block used in building." },
  { answer: "BRING", text: "Carry toward a place." },
  { answer: "BROWN", text: "Color of chocolate or soil." },
  { answer: "BUILD", text: "Construct or create." },
  { answer: "CABLE", text: "Thick cord or wire." },
  { answer: "CARRY", text: "Hold and move from place to place." },
  { answer: "CAUSE", text: "Reason something happens." },
  { answer: "CHAIR", text: "Seat with a back." },
  { answer: "CHART", text: "Visual display of data." },
  { answer: "CHASE", text: "Pursue quickly." },
  { answer: "CLEAN", text: "Free from dirt." },
  { answer: "CLEAR", text: "Easy to see or understand." },
  { answer: "CLOCK", text: "Device that shows time." },
  { answer: "CLOUD", text: "Visible mass of condensed vapor." },
  { answer: "COAST", text: "Land beside the sea." },
  { answer: "COUNT", text: "Determine a total." },
  { answer: "COURT", text: "Place where legal cases are heard." },
  { answer: "COVER", text: "Place over or protect." },
  { answer: "CREAM", text: "Rich dairy product." },
  { answer: "CROSS", text: "Go from one side to another." },
  { answer: "DANCE", text: "Move rhythmically to music." },
  { answer: "DEPTH", text: "Distance from top to bottom." },
  { answer: "DREAM", text: "Images experienced during sleep." },
  { answer: "DRIVE", text: "Operate a vehicle." },
  { answer: "EARTH", text: "The planet we live on; soil." },
  { answer: "EMPTY", text: "Containing nothing." },
  { answer: "ENJOY", text: "Take pleasure in." },
  { answer: "ENTER", text: "Go into a place." },
  { answer: "EVENT", text: "Something that happens." },
  { answer: "FIELD", text: "Open area of land." },
  { answer: "FLOOR", text: "Surface of a room underfoot." },
  { answer: "FOCUS", text: "Center of attention." },
  { answer: "FORCE", text: "Strength or power." },
  { answer: "FRAME", text: "Structure around something." },
  { answer: "FRESH", text: "New or recently made." },
  { answer: "FRONT", text: "Forward-facing side." },
  { answer: "GIANT", text: "Very large being or thing." },
  { answer: "GLASS", text: "Hard transparent material." },
  { answer: "GRACE", text: "Elegance or courteous goodwill." },
  { answer: "GREEN", text: "Color of grass." },
  { answer: "GROUP", text: "Collection of people or things." },
  { answer: "GUIDE", text: "Person or thing that leads." },
  { answer: "HAPPY", text: "Feeling joy." },
  { answer: "HEART", text: "Organ that pumps blood; emotional center." },
  { answer: "HEAVY", text: "Having great weight." },
  { answer: "HONEY", text: "Sweet substance made by bees." },
  { answer: "HOUSE", text: "Building where people live." },
  { answer: "IMAGE", text: "Picture or representation." },
  { answer: "INDEX", text: "Alphabetical list; pointer." },
  { answer: "INNER", text: "Located inside." },
  { answer: "LIGHT", text: "Brightness; not heavy." },
  { answer: "LOCAL", text: "Nearby or belonging to an area." },
  { answer: "MAGIC", text: "Mysterious power or illusion." },
  { answer: "MAJOR", text: "Important or large in scale." },
  { answer: "METAL", text: "Hard shiny material such as iron." },
  { answer: "MIGHT", text: "Power or strength; possibility." },
  { answer: "MIXED", text: "Combined from different parts." },
  { answer: "MODEL", text: "Representation or example." },
  { answer: "MONEY", text: "Medium used to buy things." },
  { answer: "MUSIC", text: "Organized sound or melody." },
  { answer: "NORTH", text: "Compass direction opposite south." },
  { answer: "OCEAN", text: "Very large body of salt water." },
  { answer: "ORDER", text: "Arrangement; command." },
  { answer: "OTHER", text: "Different or additional." },
  { answer: "PAINT", text: "Colored coating for surfaces." },
  { answer: "PANEL", text: "Flat section or discussion group." },
  { answer: "PAPER", text: "Thin material for writing or printing." },
  { answer: "PARTY", text: "Social gathering or political group." },
  { answer: "PEACE", text: "Absence of conflict." },
  { answer: "PHASE", text: "Stage in a process." },
  { answer: "PLACE", text: "Location or position." },
  { answer: "PLAIN", text: "Simple; flat open land." },
  { answer: "PLANT", text: "Living organism that grows in soil." },
  { answer: "POINT", text: "Sharp end; main idea." },
  { answer: "POWER", text: "Energy or ability to act." },
  { answer: "PRESS", text: "Push firmly; news media." },
  { answer: "QUICK", text: "Fast or rapid." },
  { answer: "QUIET", text: "Making little noise." },
  { answer: "RADIO", text: "Wireless sound broadcast." },
  { answer: "READY", text: "Prepared for action." },
  { answer: "RIVER", text: "Natural flowing watercourse." },
  { answer: "ROUND", text: "Circular; a stage of play." },
  { answer: "ROUTE", text: "Path or course taken." },
  { answer: "ROYAL", text: "Related to a king or queen." },
  { answer: "SCALE", text: "Relative size; weighing device." },
  { answer: "SCENE", text: "Place of action; part of a story." },
  { answer: "SCORE", text: "Points in a game." },
  { answer: "SHAPE", text: "External form or outline." },
  { answer: "SHARE", text: "Use or have jointly." },
  { answer: "SHARP", text: "Having a keen edge or point." },
  { answer: "SHELF", text: "Flat board for storage." },
  { answer: "SHIFT", text: "Move or change position." },
  { answer: "SHORT", text: "Not long or tall." },
  { answer: "SMILE", text: "Happy facial expression." },
  { answer: "SOLID", text: "Firm and not hollow." },
  { answer: "SOUND", text: "Something heard." },
  { answer: "SOUTH", text: "Compass direction opposite north." },
  { answer: "SPACE", text: "Empty area; outer universe." },
  { answer: "SPEED", text: "Rate of movement." },
  { answer: "STAGE", text: "Platform or phase." },
  { answer: "STAMP", text: "Small mark or postal label." },
  { answer: "STAND", text: "Be upright; position taken." },
  { answer: "START", text: "Beginning; begin." },
  { answer: "STATE", text: "Condition; political region." },
  { answer: "STONE", text: "Hard piece of rock." },
  { answer: "STORE", text: "Shop; keep for later." },
  { answer: "STORM", text: "Severe weather." },
  { answer: "STORY", text: "Narrative account." },
  { answer: "STYLE", text: "Distinctive manner or design." },
  { answer: "TABLE", text: "Furniture with a flat top." },
  { answer: "THANK", text: "Express gratitude." },
  { answer: "THEME", text: "Central subject or idea." },
  { answer: "THINK", text: "Use the mind to reason." },
  { answer: "TITLE", text: "Name of a book, work, or position." },
  { answer: "TOTAL", text: "Whole amount." },
  { answer: "TOUCH", text: "Make physical contact." },
  { answer: "TRACK", text: "Path, course, or recorded song." },
  { answer: "TRAIN", text: "Rail vehicle; teach by practice." },
  { answer: "TRIAL", text: "Test or legal proceeding." },
  { answer: "UNDER", text: "Beneath something." },
  { answer: "UNION", text: "Joining together; organized group." },
  { answer: "UPPER", text: "Higher in position." },
  { answer: "VALUE", text: "Worth or importance." },
  { answer: "VIDEO", text: "Moving visual recording." },
  { answer: "VISIT", text: "Go to see someone or somewhere." },
  { answer: "VOICE", text: "Sound made when speaking." },
  { answer: "WATER", text: "Clear liquid essential for life." },
  { answer: "WHEEL", text: "Circular part that turns on an axle." },
  { answer: "WHITE", text: "Lightest color." },
  { answer: "WHOLE", text: "Complete; entire." },
  { answer: "WORLD", text: "The earth; a realm of activity." },
  { answer: "YOUNG", text: "Not old." },
  { answer: "ANSWER", text: "Reply to a question." },
  { answer: "BOTTLE", text: "Container with a narrow neck." },
  { answer: "BRIDGE", text: "Structure crossing a gap." },
  { answer: "BUTTON", text: "Small fastener or control." },
  { answer: "CAMERA", text: "Device used to take pictures." },
  { answer: "CASTLE", text: "Fortified royal residence." },
  { answer: "CENTER", text: "Middle point." },
  { answer: "CHANCE", text: "Possibility or opportunity." },
  { answer: "CHANGE", text: "Make or become different." },
  { answer: "CIRCLE", text: "Perfectly round shape." },
  { answer: "COFFEE", text: "Brewed drink made from roasted beans." },
  { answer: "CORNER", text: "Place where two edges meet." },
  { answer: "DANGER", text: "Possibility of harm." },
  { answer: "DOUBLE", text: "Twice as much." },
  { answer: "ENERGY", text: "Capacity to do work." },
  { answer: "ENGINE", text: "Machine that produces motion." },
  { answer: "FAMILY", text: "Related group of people." },
  { answer: "FINGER", text: "Digit of the hand." },
  { answer: "FLOWER", text: "Blooming part of a plant." },
  { answer: "FOREST", text: "Large area covered with trees." },
  { answer: "FRIEND", text: "Person one knows and likes." },
  { answer: "GARDEN", text: "Place where plants are grown." },
  { answer: "GOLDEN", text: "Made of or colored like gold." },
  { answer: "GROUND", text: "Surface of the earth." },
  { answer: "ISLAND", text: "Land surrounded by water." },
  { answer: "LITTLE", text: "Small in size." },
  { answer: "MEMORY", text: "Ability to recall information." },
  { answer: "MIDDLE", text: "Equally distant from edges." },
  { answer: "MOMENT", text: "Brief period of time." },
  { answer: "MOTHER", text: "Female parent." },
  { answer: "NUMBER", text: "Mathematical value." },
  { answer: "OFFICE", text: "Place where work is done." },
  { answer: "ORANGE", text: "Citrus fruit or its color." },
  { answer: "PEOPLE", text: "Human beings generally." },
  { answer: "PERSON", text: "Human individual." },
  { answer: "PLANET", text: "Large body orbiting a star." },
  { answer: "PLAYER", text: "Participant in a game." },
  { answer: "POCKET", text: "Small pouch in clothing." },
  { answer: "PUZZLE", text: "Problem designed to test ingenuity." },
  { answer: "REASON", text: "Cause or explanation." },
  { answer: "RECORD", text: "Preserved account or best result." },
  { answer: "SCHOOL", text: "Place of learning." },
  { answer: "SCREEN", text: "Display surface." },
  { answer: "SECRET", text: "Something kept hidden." },
  { answer: "SILVER", text: "Precious gray-white metal." },
  { answer: "SIMPLE", text: "Easy to understand." },
  { answer: "SPIRIT", text: "Essence or mood." },
  { answer: "SQUARE", text: "Four-sided shape with equal sides." },
  { answer: "SYSTEM", text: "Set of connected parts." },
  { answer: "TICKET", text: "Pass for entry or travel." },
  { answer: "TRAVEL", text: "Go from one place to another." },
  { answer: "WINDOW", text: "Opening fitted with glass." },
] as const;

type StandardPlacementEntry = CrosswordGeneratorSeedEntry & {
  required: boolean;
};

type StandardPlacedEntry = StandardPlacementEntry & {
  row: number;
  col: number;
  direction: CrosswordDirection;
};

type StandardPlacementCandidate = {
  row: number;
  col: number;
  direction: CrosswordDirection;
  intersections: number;
  score: number;
};

const directionDelta = (direction: CrosswordDirection): [number, number] => {
  return direction === "across" ? [0, 1] : [1, 0];
};

const createEmptyStandardGrid = (rows: number, cols: number): Array<Array<string | null>> => {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
};

const createEmptyCoverageGrid = (rows: number, cols: number): number[][] => {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
};

const inGrid = (rows: number, cols: number, row: number, col: number): boolean => {
  return row >= 0 && row < rows && col >= 0 && col < cols;
};

const getFilledBounds = (grid: Array<Array<string | null>>): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null => {
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;

  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < (grid[0]?.length ?? 0); col += 1) {
      if (grid[row][col] == null) continue;
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }
  }

  if (!Number.isFinite(minRow)) return null;
  return { minRow, maxRow, minCol, maxCol };
};

const scoreStandardPlacementCandidate = (
  grid: Array<Array<string | null>>,
  entry: StandardPlacementEntry,
  candidate: Omit<StandardPlacementCandidate, "score">
): number => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const [dr, dc] = directionDelta(candidate.direction);
  const current = getFilledBounds(grid);
  const currentArea = current
    ? (current.maxRow - current.minRow + 1) * (current.maxCol - current.minCol + 1)
    : 0;

  let minRow = current?.minRow ?? Infinity;
  let maxRow = current?.maxRow ?? -Infinity;
  let minCol = current?.minCol ?? Infinity;
  let maxCol = current?.maxCol ?? -Infinity;
  let centerPenalty = 0;
  const centerRow = (rows - 1) / 2;
  const centerCol = (cols - 1) / 2;

  for (let i = 0; i < entry.answer.length; i += 1) {
    const row = candidate.row + dr * i;
    const col = candidate.col + dc * i;
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    centerPenalty += Math.abs(row - centerRow) + Math.abs(col - centerCol);
  }

  const nextArea = (maxRow - minRow + 1) * (maxCol - minCol + 1);
  const spanBonus = Math.max(0, nextArea - currentArea);
  const edgeInset = Math.min(minRow, minCol, rows - 1 - maxRow, cols - 1 - maxCol);
  const edgeBonus = Math.max(0, 4 - edgeInset) * 1.5;

  return (
    candidate.intersections * 90 +
    entry.answer.length * 3 +
    spanBonus * 0.55 +
    edgeBonus +
    (entry.required ? 20 : 0) -
    centerPenalty * 0.4 +
    Math.random() * 8
  );
};

const validateStandardPlacement = (
  grid: Array<Array<string | null>>,
  acrossCoverage: number[][],
  downCoverage: number[][],
  entry: StandardPlacementEntry,
  row: number,
  col: number,
  direction: CrosswordDirection,
  allowNoIntersection: boolean
): Omit<StandardPlacementCandidate, "score"> | null => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const [dr, dc] = directionDelta(direction);
  const sameCoverage = direction === "across" ? acrossCoverage : downCoverage;
  const otherCoverage = direction === "across" ? downCoverage : acrossCoverage;
  const beforeRow = row - dr;
  const beforeCol = col - dc;
  const afterRow = row + dr * entry.answer.length;
  const afterCol = col + dc * entry.answer.length;

  if (!inGrid(rows, cols, row, col)) return null;
  if (!inGrid(rows, cols, row + dr * (entry.answer.length - 1), col + dc * (entry.answer.length - 1))) return null;
  if (inGrid(rows, cols, beforeRow, beforeCol) && grid[beforeRow][beforeCol] != null) return null;
  if (inGrid(rows, cols, afterRow, afterCol) && grid[afterRow][afterCol] != null) return null;

  let intersections = 0;

  for (let i = 0; i < entry.answer.length; i += 1) {
    const cellRow = row + dr * i;
    const cellCol = col + dc * i;
    const existing = grid[cellRow][cellCol];

    if (existing != null) {
      if (existing !== entry.answer[i]) return null;
      if (sameCoverage[cellRow][cellCol] > 0) return null;
      if (otherCoverage[cellRow][cellCol] < 1) return null;
      intersections += 1;
      continue;
    }

    if (direction === "across") {
      if (inGrid(rows, cols, cellRow - 1, cellCol) && grid[cellRow - 1][cellCol] != null) return null;
      if (inGrid(rows, cols, cellRow + 1, cellCol) && grid[cellRow + 1][cellCol] != null) return null;
    } else {
      if (inGrid(rows, cols, cellRow, cellCol - 1) && grid[cellRow][cellCol - 1] != null) return null;
      if (inGrid(rows, cols, cellRow, cellCol + 1) && grid[cellRow][cellCol + 1] != null) return null;
    }
  }

  if (!allowNoIntersection && intersections === 0) return null;
  return { row, col, direction, intersections };
};

const applyStandardPlacement = (
  grid: Array<Array<string | null>>,
  acrossCoverage: number[][],
  downCoverage: number[][],
  entry: StandardPlacementEntry,
  row: number,
  col: number,
  direction: CrosswordDirection
): StandardPlacedEntry => {
  const [dr, dc] = directionDelta(direction);
  const coverage = direction === "across" ? acrossCoverage : downCoverage;

  for (let i = 0; i < entry.answer.length; i += 1) {
    const cellRow = row + dr * i;
    const cellCol = col + dc * i;
    grid[cellRow][cellCol] = entry.answer[i];
    coverage[cellRow][cellCol] += 1;
  }

  return { ...entry, row, col, direction };
};

const enumerateStandardPlacements = (
  grid: Array<Array<string | null>>,
  acrossCoverage: number[][],
  downCoverage: number[][],
  entry: StandardPlacementEntry,
  allowNoIntersection: boolean
): StandardPlacementCandidate[] => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const candidates: StandardPlacementCandidate[] = [];

  if (allowNoIntersection) {
    for (const direction of shuffle<CrosswordDirection>(["across", "down"])) {
      const [dr, dc] = directionDelta(direction);
      const startRow = Math.round((rows - 1 - dr * (entry.answer.length - 1)) / 2);
      const startCol = Math.round((cols - 1 - dc * (entry.answer.length - 1)) / 2);
      const offsets = shuffle([-2, -1, 0, 1, 2, -3, 3]);

      for (const offset of offsets) {
        const row = direction === "across" ? startRow + offset : startRow;
        const col = direction === "down" ? startCol + offset : startCol;
        const candidate = validateStandardPlacement(grid, acrossCoverage, downCoverage, entry, row, col, direction, true);
        if (!candidate) continue;
        candidates.push({
          ...candidate,
          score: scoreStandardPlacementCandidate(grid, entry, candidate),
        });
      }
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  for (let gridRow = 0; gridRow < rows; gridRow += 1) {
    for (let gridCol = 0; gridCol < cols; gridCol += 1) {
      const existing = grid[gridRow][gridCol];
      if (existing == null) continue;

      for (let index = 0; index < entry.answer.length; index += 1) {
        if (entry.answer[index] !== existing) continue;

        const directions: CrosswordDirection[] = [];
        if (downCoverage[gridRow][gridCol] > 0) directions.push("across");
        if (acrossCoverage[gridRow][gridCol] > 0) directions.push("down");

        for (const direction of directions) {
          const [dr, dc] = directionDelta(direction);
          const row = gridRow - dr * index;
          const col = gridCol - dc * index;
          const candidate = validateStandardPlacement(grid, acrossCoverage, downCoverage, entry, row, col, direction, false);
          if (!candidate) continue;
          candidates.push({
            ...candidate,
            score: scoreStandardPlacementCandidate(grid, entry, candidate),
          });
        }
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
};

const slotAnswerFromGrid = (
  grid: Array<Array<string | null>>,
  slot: CrosswordSlot,
  direction: CrosswordDirection
): string | null => {
  let answer = "";
  for (let i = 0; i < slot.length; i += 1) {
    const row = direction === "down" ? slot.row + i : slot.row;
    const col = direction === "across" ? slot.col + i : slot.col;
    const letter = grid[row]?.[col];
    if (!letter) return null;
    answer += letter;
  }
  return answer;
};

const buildStandardPlacementResult = (
  grid: Array<Array<string | null>>,
  requiredSeedEntries: CrosswordGeneratorSeedEntry[],
  clueByAnswer: Map<string, string>,
  strategy: string
): CrosswordGenerationResult | null => {
  const layoutRows = grid.map((row) => row.map((cell) => (cell == null ? "#" : ".")).join(""));
  const slots = extractSlots(layoutRows, 3);
  const generatedAcross: CrosswordGeneratedClue[] = [];
  const generatedDown: CrosswordGeneratedClue[] = [];
  const seenAnswers = new Set<string>();

  for (const slot of slots.across) {
    const answer = slotAnswerFromGrid(grid, slot, "across");
    if (!answer || seenAnswers.has(answer)) return null;
    const text = clueByAnswer.get(answer);
    if (!text) return null;
    seenAnswers.add(answer);
    generatedAcross.push({ ...slot, direction: "across", answer, text });
  }

  for (const slot of slots.down) {
    const answer = slotAnswerFromGrid(grid, slot, "down");
    if (!answer || seenAnswers.has(answer)) return null;
    const text = clueByAnswer.get(answer);
    if (!text) return null;
    seenAnswers.add(answer);
    generatedDown.push({ ...slot, direction: "down", answer, text });
  }

  if (generatedAcross.length === 0 || generatedDown.length === 0) return null;

  const validation = validateCrosswordPuzzleData(
    {
      allowUncheckedCells: true,
      clues: {
        across: generatedAcross,
        down: generatedDown,
      },
    },
    {
      requireAnswers: true,
      enforceStyle: false,
      requireCheckedCells: false,
    }
  );

  if (!validation.valid || !validation.normalized) return null;

  const requiredAnswers = new Set(requiredSeedEntries.map((entry) => entry.answer));
  const usedRequiredAnswers = new Set<string>();
  for (const answer of seenAnswers) {
    if (requiredAnswers.has(answer)) {
      usedRequiredAnswers.add(answer);
    }
  }

  const unplacedSeedAnswers = requiredSeedEntries
    .map((entry) => entry.answer)
    .filter((answer) => !usedRequiredAnswers.has(answer));

  return {
    generatedLayout: layoutRows,
    generatedRows: grid.length,
    generatedCols: grid[0]?.length ?? 0,
    whiteCellCount: validation.normalized.whiteCellCount,
    generatedAcross,
    generatedDown,
    usedSeedCount: usedRequiredAnswers.size,
    unplacedSeedAnswers,
    strategy,
  };
};

const createStandardPlacementAttempt = (
  rows: number,
  cols: number,
  requiredSeedEntries: CrosswordGeneratorSeedEntry[],
  poolEntries: CrosswordGeneratorSeedEntry[],
  targetEntryCount: number,
  attemptIndex: number
): CrosswordGenerationResult | null => {
  const grid = createEmptyStandardGrid(rows, cols);
  const acrossCoverage = createEmptyCoverageGrid(rows, cols);
  const downCoverage = createEmptyCoverageGrid(rows, cols);
  const requiredAnswers = new Set(requiredSeedEntries.map((entry) => entry.answer));
  const clueByAnswer = new Map(poolEntries.map((entry) => [entry.answer, entry.text]));
  const requiredEntries: StandardPlacementEntry[] = requiredSeedEntries
    .filter((entry) => entry.answer.length <= Math.max(rows, cols))
    .map((entry) => ({ ...entry, required: true }));
  const optionalEntries: StandardPlacementEntry[] = poolEntries
    .filter((entry) => !requiredAnswers.has(entry.answer) && entry.answer.length <= Math.max(rows, cols))
    .map((entry) => ({ ...entry, required: false }));

  if (requiredEntries.length === 0) return null;

  const firstChoices = shuffle(requiredEntries)
    .filter((entry) => entry.answer.length <= Math.max(rows, cols))
    .sort((a, b) => b.answer.length - a.answer.length)
    .slice(0, 8);
  const firstEntry = firstChoices[attemptIndex % Math.max(1, firstChoices.length)] ?? firstChoices[0];
  if (!firstEntry) return null;

  const firstPlacements = enumerateStandardPlacements(grid, acrossCoverage, downCoverage, firstEntry, true);
  const firstPlacement = firstPlacements[0];
  if (!firstPlacement) return null;

  const placed: StandardPlacedEntry[] = [
    applyStandardPlacement(grid, acrossCoverage, downCoverage, firstEntry, firstPlacement.row, firstPlacement.col, firstPlacement.direction),
  ];
  const usedAnswers = new Set<string>([firstEntry.answer]);

  const orderedEntries = [
    ...shuffle(requiredEntries.filter((entry) => !usedAnswers.has(entry.answer))).sort((a, b) => b.answer.length - a.answer.length),
    ...shuffle(optionalEntries).sort((a, b) => a.answer.length - b.answer.length),
  ];

  let madeProgress = true;
  let passes = 0;
  while (madeProgress && passes < 4 && placed.length < targetEntryCount) {
    madeProgress = false;
    passes += 1;

    for (const entry of orderedEntries) {
      if (placed.length >= targetEntryCount) break;
      if (usedAnswers.has(entry.answer)) continue;

      const candidates = enumerateStandardPlacements(grid, acrossCoverage, downCoverage, entry, false);
      if (candidates.length === 0) continue;

      const selected = candidates[Math.min(candidates.length - 1, Math.floor(Math.random() * Math.min(5, candidates.length)))];
      placed.push(applyStandardPlacement(grid, acrossCoverage, downCoverage, entry, selected.row, selected.col, selected.direction));
      usedAnswers.add(entry.answer);
      madeProgress = true;
    }
  }

  const attempt = buildStandardPlacementResult(
    grid,
    requiredSeedEntries,
    clueByAnswer,
    `standard-placement-${rows}x${cols}`
  );

  if (!attempt) return null;

  const totalEntries = attempt.generatedAcross.length + attempt.generatedDown.length;
  if (totalEntries < Math.min(targetEntryCount, Math.max(10, Math.floor((rows * cols) / 14)))) {
    return null;
  }

  return attempt;
};

const scoreAttempt = (
  attempt: CrosswordGenerationResult,
  requiredSeedTotal: number,
  minEntryLength: number
): number => {
  const allEntries = [...attempt.generatedAcross, ...attempt.generatedDown];
  const totalEntries = allEntries.length;
  const uniqueLengthCount = new Set(allEntries.map((entry) => entry.length)).size;
  const shortEntryRatio = totalEntries > 0
    ? allEntries.filter((entry) => entry.length <= 4).length / totalEntries
    : 1;
  const totalCells = attempt.generatedRows * attempt.generatedCols;
  const shape = getLayoutShapeStats(attempt.generatedLayout);
  const blackRatio = totalCells > 0 ? shape.blackRatio : 0;
  const targetBlackRatio = minEntryLength >= 4 ? 0.22 : 0.19;

  return (
    attempt.usedSeedCount * 80 +
    totalEntries * 8 +
    uniqueLengthCount * 5 -
    attempt.unplacedSeedAnswers.length * 10 -
    Math.abs(blackRatio - targetBlackRatio) * 60 -
    (requiredSeedTotal - attempt.usedSeedCount) * 8 -
    shape.solidBlackEdges * 180 -
    Math.max(0, shape.borderBlackRatio - 0.55) * 140 -
    Math.max(0, blackRatio - 0.38) * 240 -
    Math.max(0, shortEntryRatio - 0.72) * 90
  );
};

const fillLayoutWithEntries = (
  layoutRows: string[],
  requiredSeedEntries: CrosswordGeneratorSeedEntry[],
  poolEntries: CrosswordGeneratorSeedEntry[],
  minEntryLength: number,
  deadlineAt: number,
  strategy: string,
  requireCheckedCells = true
): CrosswordGenerationResult | null => {
  const analysis = analyzeLayout(layoutRows, minEntryLength, requireCheckedCells);
  if (!analysis) {
    return null;
  }

  const rows = layoutRows.length;
  const cols = layoutRows[0]?.length ?? 0;

  const requiredAnswers = new Set(requiredSeedEntries.map((entry) => entry.answer));
  const clueByAnswer = new Map(poolEntries.map((entry) => [entry.answer, entry.text]));

  const poolByLength = new Map<number, string[]>();
  for (const entry of poolEntries) {
    const bucket = poolByLength.get(entry.answer.length) ?? [];
    bucket.push(entry.answer);
    poolByLength.set(entry.answer.length, bucket);
  }

  const allSlots: CrosswordFilledSlot[] = [];

  for (const slot of analysis.slots.across) {
    allSlots.push({
      ...slot,
      direction: "across",
      id: buildSlotId("across", slot),
      intersections: 0,
    });
  }

  for (const slot of analysis.slots.down) {
    allSlots.push({
      ...slot,
      direction: "down",
      id: buildSlotId("down", slot),
      intersections: 0,
    });
  }

  if (allSlots.length > poolEntries.length) {
    return null;
  }

  const slotCountByLength = new Map<number, number>();
  for (const slot of allSlots) {
    slotCountByLength.set(slot.length, (slotCountByLength.get(slot.length) ?? 0) + 1);
  }

  for (const [length, count] of slotCountByLength.entries()) {
    const available = poolByLength.get(length)?.length ?? 0;
    if (available < count) {
      return null;
    }
  }

  type CellRef = { slotId: string; index: number };
  const cellRefs = new Map<string, CellRef[]>();

  for (const slot of allSlots) {
    for (let i = 0; i < slot.length; i += 1) {
      const row = slot.direction === "down" ? slot.row + i : slot.row;
      const col = slot.direction === "across" ? slot.col + i : slot.col;
      const key = `${row},${col}`;
      const refs = cellRefs.get(key) ?? [];
      refs.push({ slotId: slot.id, index: i });
      cellRefs.set(key, refs);
    }
  }

  const slotById = new Map(allSlots.map((slot) => [slot.id, slot]));

  for (const slot of allSlots) {
    let intersections = 0;
    for (let i = 0; i < slot.length; i += 1) {
      const row = slot.direction === "down" ? slot.row + i : slot.row;
      const col = slot.direction === "across" ? slot.col + i : slot.col;
      const refs = cellRefs.get(`${row},${col}`) ?? [];
      if (refs.length > 1) intersections += 1;
    }
    slot.intersections = intersections;
  }

  const candidatesBySlot = new Map<string, string[]>();
  for (const slot of allSlots) {
    const candidates = shuffle(poolByLength.get(slot.length) ?? []);
    if (candidates.length === 0) {
      return null;
    }
    candidatesBySlot.set(slot.id, candidates);
  }

  // Pattern-indexed fast lookup.
  // For each (length, position, letter) build the set of words matching.
  // Candidate enumeration for a slot with K constrained cells is then K small
  // set intersections instead of scanning the entire pool.
  const patternIndex = new Map<string, Set<string>>();
  const patternKey = (length: number, position: number, letter: string): string => {
    return `${length}:${position}:${letter}`;
  };
  for (const entry of poolEntries) {
    const word = entry.answer;
    for (let i = 0; i < word.length; i += 1) {
      const k = patternKey(word.length, i, word[i]);
      let set = patternIndex.get(k);
      if (!set) {
        set = new Set<string>();
        patternIndex.set(k, set);
      }
      set.add(word);
    }
  }

  // letterGrid[r][c] = letter at that cell, or null if unknown.
  // Initialized from the layout (only black squares are known initially).
  const letterGrid: (string | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );

  // Get the constraint pattern for a slot from current letterGrid.
  // Returns null if the slot is fully unconstrained, otherwise a list of
  // [position, letter] pairs.
  const slotConstraints = (slot: CrosswordFilledSlot): Array<[number, string]> => {
    const constraints: Array<[number, string]> = [];
    for (let i = 0; i < slot.length; i += 1) {
      const r = slot.direction === "down" ? slot.row + i : slot.row;
      const c = slot.direction === "across" ? slot.col + i : slot.col;
      const letter = letterGrid[r][c];
      if (letter !== null) {
        constraints.push([i, letter]);
      }
    }
    return constraints;
  };

  // Enumerate candidates for a slot using pattern index intersection.
  const enumerateCandidates = (slot: CrosswordFilledSlot, limit: number): string[] => {
    const constraints = slotConstraints(slot);
    let pool: Iterable<string>;

    if (constraints.length === 0) {
      pool = candidatesBySlot.get(slot.id) ?? [];
    } else {
      // Pick the smallest constraint set as the seed for intersection.
      let smallestSet: Set<string> | null = null;
      for (const [pos, letter] of constraints) {
        const set = patternIndex.get(patternKey(slot.length, pos, letter));
        if (!set) return [];
        if (!smallestSet || set.size < smallestSet.size) smallestSet = set;
      }
      if (!smallestSet) return [];
      pool = smallestSet;
    }

    const result: string[] = [];
    for (const word of pool) {
      if (usedAnswers.has(word)) continue;
      let ok = true;
      for (const [pos, letter] of constraints) {
        if (word[pos] !== letter) { ok = false; break; }
      }
      if (!ok) continue;
      result.push(word);
      if (result.length >= limit) break;
    }
    return result;
  };

  const assigned = new Map<string, string>();
  const usedAnswers = new Set<string>();

  let searchSteps = 0;
  // Scale with slot count: each step is cheap thanks to pattern indexing.
  const MAX_SEARCH_STEPS = Math.max(20000, allSlots.length * 1000);

  // Order required-seed words first when enumerating candidates.
  const prioritise = (words: string[]): string[] => {
    if (words.length <= 1) return words;
    return [...words].sort((a, b) => {
      const aReq = requiredAnswers.has(a) ? 0 : 1;
      const bReq = requiredAnswers.has(b) ? 0 : 1;
      return aReq - bReq;
    });
  };

  // Apply / undo a candidate assignment by writing letters into letterGrid.
  // Returns the list of cells that were CHANGED (so undo can revert them).
  const applyAssignment = (slot: CrosswordFilledSlot, candidate: string): Array<[number, number]> => {
    const changed: Array<[number, number]> = [];
    for (let i = 0; i < slot.length; i += 1) {
      const r = slot.direction === "down" ? slot.row + i : slot.row;
      const c = slot.direction === "across" ? slot.col + i : slot.col;
      if (letterGrid[r][c] === null) {
        letterGrid[r][c] = candidate[i];
        changed.push([r, c]);
      }
    }
    return changed;
  };

  const undoAssignment = (changed: Array<[number, number]>): void => {
    for (const [r, c] of changed) {
      letterGrid[r][c] = null;
    }
  };

  const solve = (): boolean => {
    if (Date.now() >= deadlineAt) return false;
    if (assigned.size === allSlots.length) return true;

    searchSteps += 1;
    if (searchSteps > MAX_SEARCH_STEPS) return false;

    // MRV: pick the unassigned slot with the fewest viable candidates.
    // Use a small enumeration limit during MRV scoring to stay cheap.
    let selectedSlot: CrosswordFilledSlot | null = null;
    let selectedCandidates: string[] = [];
    let selectedCount = Infinity;

    for (const slot of allSlots) {
      if (assigned.has(slot.id)) continue;

      const viable = enumerateCandidates(slot, 256);
      if (viable.length === 0) return false;

      // Strong tie-breaker preference: more intersections.
      const better =
        viable.length < selectedCount ||
        (viable.length === selectedCount && (selectedSlot === null || slot.intersections > selectedSlot.intersections));

      if (better) {
        selectedSlot = slot;
        selectedCandidates = viable;
        selectedCount = viable.length;
        if (selectedCount === 1) break; // Forced; assign immediately.
      }
    }

    if (!selectedSlot) return false;

    const ordered = prioritise(selectedCandidates);

    for (const candidate of ordered) {
      const changed = applyAssignment(selectedSlot, candidate);
      assigned.set(selectedSlot.id, candidate);
      usedAnswers.add(candidate);

      if (solve()) return true;

      assigned.delete(selectedSlot.id);
      usedAnswers.delete(candidate);
      undoAssignment(changed);
    }

    return false;
  };

  if (!solve()) {
    return null;
  }

  const generatedAcross: CrosswordGeneratedClue[] = [];
  const generatedDown: CrosswordGeneratedClue[] = [];

  for (const slot of analysis.slots.across) {
    const answer = assigned.get(buildSlotId("across", slot));
    if (!answer) return null;

    const text = clueByAnswer.get(answer);
    if (!text) return null;

    generatedAcross.push({
      ...slot,
      direction: "across",
      answer,
      text,
    });
  }

  for (const slot of analysis.slots.down) {
    const answer = assigned.get(buildSlotId("down", slot));
    if (!answer) return null;

    const text = clueByAnswer.get(answer);
    if (!text) return null;

    generatedDown.push({
      ...slot,
      direction: "down",
      answer,
      text,
    });
  }

  const validation = validateCrosswordPuzzleData(
    {
      clues: {
        across: generatedAcross,
        down: generatedDown,
      },
    },
    {
      requireAnswers: true,
      enforceStyle: false,
      requireCheckedCells,
    }
  );

  if (!validation.valid) {
    return null;
  }

  const usedRequiredAnswers = new Set<string>();
  for (const answer of assigned.values()) {
    if (requiredAnswers.has(answer)) {
      usedRequiredAnswers.add(answer);
    }
  }

  const unplacedSeedAnswers = requiredSeedEntries
    .map((entry) => entry.answer)
    .filter((answer) => !usedRequiredAnswers.has(answer));

  return {
    generatedLayout: layoutRows,
    generatedRows: rows,
    generatedCols: cols,
    whiteCellCount: analysis.whiteCellCount,
    generatedAcross,
    generatedDown,
    usedSeedCount: usedRequiredAnswers.size,
    unplacedSeedAnswers,
    strategy,
  };
};

export function generateCrosswordFromSeedEntries(
  request: CrosswordGenerationRequest
): CrosswordGenerationResult | null {
  const requiredSeedEntries = normalizeSeedEntries(request.seedEntries ?? []);
  if (requiredSeedEntries.length < 4) {
    return null;
  }

  const poolEntries = normalizeSeedEntries([
    ...(request.fillPoolEntries ?? []),
    ...requiredSeedEntries,
    // Common English filler words let the CSP satisfy 100%-double-checking.
    // They are in the pool but not in requiredSeedEntries, so they fill
    // crossing slots that themed words can't cover.
    ...(request.disableFillerBank ? [] : COMMON_FILLER_BANK),
    ...(request.disableFillerBank ? [] : STANDARD_PLACEMENT_FILLER_BANK),
  ]);
  if (poolEntries.length < 4) {
    return null;
  }

  const naturalMinEntryLength = Math.min(...poolEntries.map((entry) => entry.answer.length));
  const longestEntryLength = Math.max(...poolEntries.map((entry) => entry.answer.length));
  const totalRequiredLetters = requiredSeedEntries.reduce((sum, entry) => sum + entry.answer.length, 0);

  const lengthCounts = new Map<number, number>();
  for (const entry of poolEntries) {
    lengthCounts.set(entry.answer.length, (lengthCounts.get(entry.answer.length) ?? 0) + 1);
  }

  const threeLetterCount = lengthCounts.get(3) ?? 0;
  const hasFourLetterWords = (lengthCounts.get(4) ?? 0) > 0;
  const sparseThreeLetterPool = threeLetterCount > 0
    && (threeLetterCount < 10 || threeLetterCount < Math.ceil(poolEntries.length * 0.18));

  const minEntryLengthCandidates: number[] = [];
  if (naturalMinEntryLength === 3 && sparseThreeLetterPool && hasFourLetterWords) {
    minEntryLengthCandidates.push(4);
  }
  minEntryLengthCandidates.push(naturalMinEntryLength);

  const maxDurationMs = Math.max(700, request.maxDurationMs ?? DEFAULT_MAX_DURATION_MS);
  const deadlineAt = Date.now() + maxDurationMs;

  // Allow grids as small as the longest pool word.
  const defaultMinGrid = Math.min(DEFAULT_MIN_GRID, longestEntryLength);
  const minGrid = clampInt(
    request.minGrid ?? defaultMinGrid,
    ABSOLUTE_MIN_GRID,
    ABSOLUTE_MAX_GRID
  );

  // We CAN safely use grids LARGER than the longest pool word as long as we
  // enforce that no slot in the layout exceeds that length (i.e. every full row
  // and column has at least one black square breaking it into shorter pieces).
  // Larger grids with more black squares give us mostly short (3-7 letter)
  // slots where the filler bank is rich -- that's where the CSP is easy.
  const maxGrid = clampInt(
    request.maxGrid ?? Math.max(DEFAULT_MAX_GRID, longestEntryLength + 4),
    minGrid,
    ABSOLUTE_MAX_GRID
  );

  const naturalMaxSlotLength = request.disableFillerBank
    ? longestEntryLength
    : Math.min(longestEntryLength, Math.max(5, Math.min(7, longestEntryLength)));
  const shortFallbackMaxSlotLength = request.disableFillerBank
    ? longestEntryLength
    : Math.min(longestEntryLength, 4);

  const estimatedSide = Math.round(Math.sqrt(Math.max(1, totalRequiredLetters) * 0.62));
  const countBasedSide = requiredSeedEntries.length <= 20
    ? 13
    : requiredSeedEntries.length <= 36
      ? 15
      : requiredSeedEntries.length <= 54
        ? 17
        : 19;
  const baselineSide = request.disableFillerBank
    ? Math.max(naturalMaxSlotLength + 5, estimatedSide, minGrid)
    : Math.max(countBasedSide, estimatedSide, minGrid);
  const requestedPreferredSide = clampInt(
    request.preferredSide ?? baselineSide,
    minGrid,
    maxGrid
  );
  const preferredSide = request.disableFillerBank
    ? requestedPreferredSide
    : clampInt(Math.max(countBasedSide, minGrid), minGrid, maxGrid);
  const exactGridRequested = Number.isFinite(request.gridRows)
    || Number.isFinite(request.gridCols)
    || request.minGrid === request.maxGrid;
  const placementRows = clampInt(
    Math.round(request.gridRows ?? request.gridCols ?? preferredSide),
    ABSOLUTE_MIN_GRID,
    ABSOLUTE_MAX_GRID
  );
  const placementCols = clampInt(
    Math.round(request.gridCols ?? request.gridRows ?? preferredSide),
    ABSOLUTE_MIN_GRID,
    ABSOLUTE_MAX_GRID
  );

  const sideCandidates: number[] = [];
  const addSide = (side: number) => {
    const clamped = clampInt(side, minGrid, maxGrid);
    if (!sideCandidates.includes(clamped)) {
      sideCandidates.push(clamped);
    }
  };

  for (const delta of [0, 2, -2, 4, -4, 6, -6]) {
    addSide(preferredSide + delta);
  }

  addSide(requestedPreferredSide);
  addSide(naturalMaxSlotLength + 5);
  addSide(naturalMaxSlotLength + 7);
  addSide(minGrid);
  addSide(maxGrid);

  sideCandidates.sort((a, b) => {
    const byDistance = Math.abs(a - preferredSide) - Math.abs(b - preferredSide);
    if (byDistance !== 0) return byDistance;
    return a - b;
  });

  // Increase attempts: now that createSymmetricLayout rejects infeasible layouts
  // quickly, we can afford more tries within the same time budget.
  const maxLayoutAttemptsPerSide = request.maxLayoutAttemptsPerSide
    ?? (requiredSeedEntries.length >= 28 ? 2000 : 1200);

  let bestAttempt: CrosswordGenerationResult | null = null;
  let _dbgLayoutsTried = 0;
  let _dbgLayoutsBuilt = 0;
  let _dbgFillsAttempted = 0;
  let _dbgFillsSucceeded = 0;

  const recordAttempt = (attempt: CrosswordGenerationResult, minEntryLength: number): boolean => {
    _dbgFillsSucceeded += 1;

    if (!bestAttempt || scoreAttempt(attempt, requiredSeedEntries.length, minEntryLength) > scoreAttempt(bestAttempt, requiredSeedEntries.length, minEntryLength)) {
      bestAttempt = attempt;
    }

    const maxUnplaced = Math.max(2, Math.floor(requiredSeedEntries.length * 0.25));
    return attempt.unplacedSeedAnswers.length <= maxUnplaced;
  };

  const standardTargetEntryCount = Math.min(
    poolEntries.filter((entry) => entry.answer.length <= Math.max(placementRows, placementCols)).length,
    Math.max(requiredSeedEntries.length, Math.floor((placementRows * placementCols) / 4.5)),
    requiredSeedEntries.length + 24
  );
  const standardPlacementAttempts = exactGridRequested
    ? Math.max(36, Math.min(maxLayoutAttemptsPerSide, 80))
    : Math.max(36, Math.min(maxLayoutAttemptsPerSide, 90));

  for (let attemptIndex = 0; attemptIndex < standardPlacementAttempts; attemptIndex += 1) {
    if (Date.now() >= deadlineAt) break;

    _dbgLayoutsTried += 1;
    const attempt = createStandardPlacementAttempt(
      placementRows,
      placementCols,
      requiredSeedEntries,
      poolEntries,
      standardTargetEntryCount,
      attemptIndex
    );

    if (!attempt) continue;
    _dbgLayoutsBuilt += 1;
    const totalGeneratedEntries = attempt.generatedAcross.length + attempt.generatedDown.length;
    const enoughStandardEntries = totalGeneratedEntries >= Math.min(
      standardTargetEntryCount,
      Math.max(12, Math.floor((placementRows * placementCols) / 10))
    );
    const enoughSeeds = attempt.usedSeedCount >= Math.min(
      requiredSeedEntries.length,
      Math.max(6, Math.ceil(requiredSeedEntries.length * 0.5))
    );

    if (!bestAttempt || scoreAttempt(attempt, requiredSeedEntries.length, 3) > scoreAttempt(bestAttempt, requiredSeedEntries.length, 3)) {
      bestAttempt = attempt;
    }

    const excellentSeedUse = attempt.unplacedSeedAnswers.length <= Math.max(2, Math.floor(requiredSeedEntries.length * 0.25));
    const excellentEntryCount = totalGeneratedEntries >= Math.floor(standardTargetEntryCount * 0.85);

    if ((excellentSeedUse && excellentEntryCount) || (!exactGridRequested && enoughStandardEntries && enoughSeeds)) {
      if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
      return bestAttempt;
    }
  }

  if (exactGridRequested) {
    const relaxedLayoutAttempts = Math.max(24, Math.min(maxLayoutAttemptsPerSide, placementRows >= 18 || placementCols >= 18 ? 90 : 70));
    const relaxedMaxSlotLength = Math.min(longestEntryLength, placementRows >= 18 || placementCols >= 18 ? 6 : 5);

    for (let layoutTry = 0; layoutTry < relaxedLayoutAttempts; layoutTry += 1) {
      if (Date.now() >= deadlineAt) break;

      _dbgLayoutsTried += 1;
      const targetBlackRatio = 0.28 + Math.random() * 0.12;
      const layoutRows = createSymmetricLayout(
        placementRows,
        placementCols,
        targetBlackRatio,
        3,
        lengthCounts,
        relaxedMaxSlotLength,
        false
      );
      if (!layoutRows) continue;
      _dbgLayoutsBuilt += 1;

      for (let fillTry = 0; fillTry < 2; fillTry += 1) {
        if (Date.now() >= deadlineAt) break;

        _dbgFillsAttempted += 1;
        const attempt = fillLayoutWithEntries(
          layoutRows,
          requiredSeedEntries,
          poolEntries,
          3,
          deadlineAt,
          `relaxed-mask-${placementRows}x${placementCols}-l${layoutTry + 1}-f${fillTry + 1}`,
          false
        );

        if (!attempt) continue;
        const accepted = recordAttempt(attempt, 3);
        const totalGeneratedEntries = attempt.generatedAcross.length + attempt.generatedDown.length;
        const enoughEntries = totalGeneratedEntries >= Math.min(standardTargetEntryCount, Math.floor((placementRows * placementCols) / 5));
        const enoughSeeds = attempt.usedSeedCount >= Math.min(requiredSeedEntries.length, Math.max(6, Math.ceil(requiredSeedEntries.length * 0.45)));
        const visuallyStrong = hasNaturalLayoutShape(attempt)
          && totalGeneratedEntries >= Math.max(12, Math.floor((placementRows * placementCols) / 9))
          && attempt.usedSeedCount >= Math.min(requiredSeedEntries.length, Math.max(4, Math.ceil(requiredSeedEntries.length * 0.25)));
        if (accepted || visuallyStrong || (enoughEntries && enoughSeeds && hasNaturalLayoutShape(attempt))) {
          if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
          return visuallyStrong ? attempt : bestAttempt;
        }
      }
    }
  }

  if (exactGridRequested && bestAttempt?.generatedRows === placementRows && bestAttempt.generatedCols === placementCols) {
    if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
    return bestAttempt;
  }

  if (!exactGridRequested && !request.disableFillerBank && naturalMinEntryLength <= 3 && shortFallbackMaxSlotLength <= 4) {
    const openTemplateLayouts = buildOpenShortSlotTemplateLayouts(maxGrid);

    for (let layoutIndex = 0; layoutIndex < openTemplateLayouts.length; layoutIndex += 1) {
      if (Date.now() >= deadlineAt) break;

      const layoutRows = openTemplateLayouts[layoutIndex];
      const analysis = analyzeLayout(layoutRows, 3);
      if (!analysis) continue;

      _dbgLayoutsTried += 1;
      _dbgLayoutsBuilt += 1;

      for (let fillTry = 0; fillTry < 16; fillTry += 1) {
        if (Date.now() >= deadlineAt) break;

        _dbgFillsAttempted += 1;
        const attempt = fillLayoutWithEntries(
          layoutRows,
          requiredSeedEntries,
          poolEntries,
          3,
          deadlineAt,
          `open-template-${layoutRows.length}x${layoutRows.length}-l${layoutIndex + 1}-f${fillTry + 1}`
        );

        if (!attempt) continue;
        const totalGeneratedEntries = attempt.generatedAcross.length + attempt.generatedDown.length;
        const enoughTemplateEntries = totalGeneratedEntries >= Math.min(Math.max(requiredSeedEntries.length, 12), 30);

        if (recordAttempt(attempt, 3) || (enoughTemplateEntries && hasNaturalLayoutShape(attempt))) {
          if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
          return bestAttempt;
        }
      }
    }

    if (bestAttempt && hasNaturalLayoutShape(bestAttempt)) {
      if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
      return bestAttempt;
    }
  }

  for (const minEntryLength of minEntryLengthCandidates) {
    if (Date.now() >= deadlineAt) {
      if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
      return bestAttempt;
    }

    for (const side of sideCandidates) {
      if (Date.now() >= deadlineAt) {
        if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
        return bestAttempt;
      }

      const layoutAttempts = maxLayoutAttemptsPerSide + (side >= 17 ? 12 : 0);

      for (let layoutTry = 0; layoutTry < layoutAttempts; layoutTry += 1) {
        if (Date.now() >= deadlineAt) {
          if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
          return bestAttempt;
        }

        _dbgLayoutsTried += 1;
        // Use a higher black ratio for larger grids so slots stay short and fall
        // within the rich part of the pool.
        const isLargeGrid = side > longestEntryLength;
        const blackBase = isLargeGrid ? 0.15 : (minEntryLength >= 4 ? 0.14 : 0.12);
        const blackSpan = isLargeGrid ? 0.12 : (minEntryLength >= 4 ? 0.12 : 0.12);
        const targetBlackRatio = blackBase + Math.random() * blackSpan;

        const layoutRows = createSymmetricLayout(side, side, targetBlackRatio, minEntryLength, lengthCounts, naturalMaxSlotLength);
        if (!layoutRows) continue;
        _dbgLayoutsBuilt += 1;

        for (let fillTry = 0; fillTry < 4; fillTry += 1) {
          if (Date.now() >= deadlineAt) {
            if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
            return bestAttempt;
          }

          _dbgFillsAttempted += 1;
          const attempt = fillLayoutWithEntries(
            layoutRows,
            requiredSeedEntries,
            poolEntries,
            minEntryLength,
            deadlineAt,
            `fresh-m${minEntryLength}-${side}x${side}-l${layoutTry + 1}-f${fillTry + 1}`
          );

          if (!attempt) continue;
          if (recordAttempt(attempt, minEntryLength) && hasNaturalLayoutShape(attempt)) {
            if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
            return bestAttempt;
          }
        }
      }
    }
  }

  if (bestAttempt) {
    if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);
    return bestAttempt;
  }

  if (!exactGridRequested && !request.disableFillerBank && naturalMinEntryLength <= 3 && shortFallbackMaxSlotLength <= 4) {
    const templateLayouts = buildShortSlotTemplateLayouts(minGrid, maxGrid);

    for (let layoutIndex = 0; layoutIndex < templateLayouts.length; layoutIndex += 1) {
      if (Date.now() >= deadlineAt) break;

      const layoutRows = templateLayouts[layoutIndex];
      const analysis = analyzeLayout(layoutRows, 3);
      if (!analysis) continue;

      _dbgLayoutsTried += 1;
      _dbgLayoutsBuilt += 1;

      for (let fillTry = 0; fillTry < 12; fillTry += 1) {
        if (Date.now() >= deadlineAt) break;

        _dbgFillsAttempted += 1;
        const attempt = fillLayoutWithEntries(
          layoutRows,
          requiredSeedEntries,
          poolEntries,
          3,
          deadlineAt,
          `short-template-fallback-${layoutRows.length}x${layoutRows.length}-l${layoutIndex + 1}-f${fillTry + 1}`
        );

        if (!attempt) continue;
        recordAttempt(attempt, 3);
      }
    }
  }
  if (process.env.CROSSWORD_DEBUG) console.log(`[xword] DONE: layouts tried=${_dbgLayoutsTried} built=${_dbgLayoutsBuilt} fills attempted=${_dbgFillsAttempted} succeeded=${_dbgFillsSucceeded}`);

  return bestAttempt;
}
