// === Lore & worldbuilding (fully original) =============================
export const LORE = {
  worldName: "Ardenholt",
  era: "Post-Convergence, Year 0021",
  intro: [
    "Twenty-one winters have passed since the sky split open above the Pale Sea.",
    "They called it the CONVERGENCE. The Veil between worlds tore, and through every wound came the Hollow.",
    "Cities fell in a single night. From the ash rose the AWAKENED — those whose souls answered the bleeding sky.",
    "You are not one of them. Not yet.",
    "You are E-Rank. The lowest. A flicker in a world of furnaces.",
    "But somewhere beneath the silence of your bones, an older voice has begun to speak.",
    "It calls itself the ABYSS INTERFACE.",
    "It does not ask permission."
  ],
  factions: [
    { name: "The Argent Spire", desc: "Mega-corporate hunter conglomerate. Owns half the legal Veils on the eastern coast. Their hunters wear silver and never look down." },
    { name: "House Vehrenmoor", desc: "The oldest noble guild — bloodlines of awakened that predate the Convergence. Suspicious of newcomers. Hoards forbidden codices." },
    { name: "The Crimson Ledger", desc: "Black-market Veil raiders. Will pay anything for unlogged corpses, monarch shards, and silence." },
    { name: "Choir of Ash", desc: "A heretical cult that worships the Hollow. They speak of a coming Sovereign who will 'reconcile the Veil with the world.'" },
    { name: "The Ninth Bureau", desc: "State military oversight. Issues Veil licenses, hunts unlicensed awakeners, and fears what cannot be measured." }
  ],
  ranks: [
    { code: "E", name: "Ember",   note: "barely a candle" },
    { code: "D", name: "Drift",   note: "trained, replaceable" },
    { code: "C", name: "Cinder",  note: "a name in a guild ledger" },
    { code: "B", name: "Bastion", note: "a city's pride" },
    { code: "A", name: "Apex",    note: "a nation's weapon" },
    { code: "S", name: "Sovereign-Aspect", note: "a story told in whispers" },
    { code: "SS", name: "Eclipse", note: "more myth than human" },
    { code: "MONARCH", name: "Monarch", note: "the world bends; you do not" }
  ],
  systems: [
    { ti: "THE VEILS", tx: "Wounds in reality. Some open onto ruined kingdoms; some onto the cosmic dark between dreams. They breathe out monsters and breathe in the unwary. Every Veil has a Pulse — a heartbeat that, if stopped, collapses it forever." },
    { ti: "THE HOLLOW", tx: "Not a place. A condition. Anything that lingers in a Veil too long becomes Hollowed: stronger, hungrier, less itself. Most monsters are simply things that forgot what they were." },
    { ti: "AWAKENING", tx: "When a soul resonates with the bleeding sky it is altered. Most Awakened gain a single Aspect — fire, ice, blade, beast. A few gain something stranger. You gained something that should not exist." },
    { ti: "THE ABYSS INTERFACE", tx: "Not a god. Not a tool. It speaks in the second person and watches like a librarian who has read every book in a burning library. It offers quests no one else can see, rewards no one else can hold, and demands a price it will not name." },
    { ti: "UMBRAL SOVEREIGNTY", tx: "Your forbidden Aspect. You do not awaken — you EXTRACT. From the corpses of those you defeat, you draw their Echo: a shadow of what they were, bound to your will. Each Echo remembers. Each Echo can be raised again, sharper, hungrier, more loyal than they ever were in life." },
    { ti: "MONARCHS", tx: "Nine entities — older than Convergence, older perhaps than the world. Each one rules a Veil of monstrous scale. They are spoken of in fragments: the Coil, the Smiling Executioner, the Blind Dragon Priest, the Titan of Chains, the Fallen Seraph, the Corpse King, the Coral Empress, the One Who Was Not Invited, and the Last Sovereign." }
  ],
  monarchs: [
    { name: "The Smiling Executioner", domain: "Veil of Whispering Steel", note: "carves apologies into his victims" },
    { name: "Blind Dragon Priest",    domain: "Veil of the Hollow Mountain", note: "his eyes are wounds in the air" },
    { name: "Titan of Chains",        domain: "Veil of the Buried City", note: "every link is a kingdom he ate" },
    { name: "Fallen Seraph",          domain: "Veil of Black Hymns", note: "still believes she is good" },
    { name: "The Corpse King",        domain: "Veil of the Long Funeral", note: "the only true peer of an Umbral Sovereign" },
    { name: "Coral Empress",          domain: "Sunken Veil of Mereth", note: "her crown is the bones of whales" },
    { name: "The Coil",               domain: "The Inverted Tower", note: "it is the staircase, and the climber" },
    { name: "One Who Was Not Invited",domain: "Cosmic Veil — uncharted", note: "you must not look at her name long" },
    { name: "The Last Sovereign",     domain: "unknown", note: "the throne the Abyss Interface intends for you" }
  ],
  storyBeats: [
    "ACT I — THE QUIET CITY: You survive a D-rank gate that should have killed you. The Abyss Interface activates. You are reclassified, off the books.",
    "ACT II — THE LEDGER'S OFFER: The Crimson Ledger finds you first. They offer protection in exchange for the corpses no one else can identify.",
    "ACT III — HOUSE VEHRENMOOR: An old hunter recognizes your power and tries to kill you. She fails. You raise her as your first Named Commander.",
    "ACT IV — THE CHOIR SINGS: The Choir of Ash declares you the foretold Sovereign. They are wrong. Or they are early.",
    "ACT V — THE FUNERAL: You meet the Corpse King. He does not fight you. He invites you to dinner.",
    "ACT VI — THE LAST THRONE: The Abyss Interface tells you what it has always wanted. You decide whether the world needs another Monarch — or one less."
  ]
};

export const ZONE_NAMES = [
  "THE QUIET CITY", "VEIL OF WHISPERING STEEL", "HOLLOW MOUNTAIN PASS",
  "BURIED CITY UNDERSPIRE", "BLACK HYMN CATHEDRAL", "THE LONG FUNERAL",
  "SUNKEN MERETH", "INVERTED TOWER — FLOOR 1", "ABYSS REGISTRY"
];

export const ENEMY_NAMES = {
  grunt:    ["Hollow Stalker", "Ash-Eater", "Veil-Sick Hound", "Tatter Knight", "Pale Whisperer"],
  ranged:   ["Choir Acolyte", "Bone Cantor", "Rift Sniper", "Glass Oracle"],
  brute:    ["Gore Titan", "Buried Warden", "Iron Mourner", "Slag Behemoth"],
  assassin: ["Veil Carver", "Quiet Knife", "Mirror-Stalker", "Last Whisper"],
  caster:   ["Hollow Magister", "Choir Heretic", "Rune-Bound Cantor", "Pale Conjurer"],
  swarm:    ["Ashling", "Veil-Tick", "Hollow Sprat", "Tatter Imp"],
  tank:     ["Iron Mourner", "Cathedral Bulwark", "Sealed Custodian", "Rusted Sentinel"],
  summoner: ["Choir Conductor", "Hollow Shepherd", "Veil Midwife", "Mourning Architect"],
  phantom:  ["Veil Wraith", "Pale Echo", "Forgotten Duelist", "Glass-Eyed Mourner"],
  elite:    ["Veil-Carved Duelist", "Shrieking Magistrate", "Thorn Cardinal", "Rust Inquisitor"],
  boss:     ["Tatter-Lord Grevh", "Magistrate of Empty Verdicts", "The Smiling Executioner", "Blind Dragon Priest", "Corpse King"]
};

// Abyss Interface voice lines
export const SYS_VOICE = {
  intro: [
    "[ ABYSS INTERFACE :: HANDSHAKE COMPLETE ]",
    "You have been observed.",
    "You will be measured."
  ],
  firstKill: ["A small mercy. Continue."],
  firstExtract: [
    "[ ECHO RECOVERED ]",
    "Their name was a knife. You may use it."
  ],
  levelUp: [
    "[ THRESHOLD CROSSED ]",
    "Your shape becomes more difficult to forget."
  ],
  bossNear: ["A throat large enough to scream into. Approach."],
  bossDown: ["The throne is one chair lighter."],
  hubReturn: ["You return. The world has not. Not yet."],
  warn: ["You are bleeding. The world is impatient."]
};
