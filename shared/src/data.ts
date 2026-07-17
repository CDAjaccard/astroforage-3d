/* ASTRO·FORAGE 3D — données du jeu.
 * Port fidèle de js/data.js (build 44) du jeu original 2D :
 * mêmes ressources, tuiles, recettes, bâtiments, améliorations, recherche,
 * fusée, quêtes, exploits et difficultés. Ajouts 3D : constantes du monde
 * voxel et traductions EN (publication Steam). */

export const BUILD = 1; // build de la version 3D

/* ---- Monde voxel ----
 * 1 voxel = 2 m d'arête (1 tuile du jeu 2D). Toutes les profondeurs en mètres
 * de l'original restent valables : profondeur_m = profondeur_voxels * 2. */
export const VOXEL_M = 2;         // arête d'un voxel en mètres
export const W = 64;              // largeur ET profondeur horizontale (x, z)
export const H0 = 150;            // hauteur du monde (Acte I), en voxels
export const H2 = 210;            // hauteur après l'ouverture des abysses
export const SURF = 8;            // rangée de la surface (0..SURF-1 = ciel)
export const DAYLEN = 150;        // durée d'un cycle jour/nuit (s)
export const O2MAX = 150;         // réserve d'oxygène à pied (s)
export const POUCH = 4;           // sacoche à cristaux
export const ROCK_POS = { x: 20, z: 32 };    // fusée (voxels)
export const SPAWN_DRILL = { x: 26, z: 32 }; // foreuse au départ
export const SPAWN_ASTRO = { x: 24, z: 30 }; // astronaute au départ
export const BASE_R = 26;         // rayon de la zone constructible autour de la fusée

export const BEAM_COST = 25;      // rappel monte-charge (↯)
export const BEAM_CD = 8;         // recharge du rappel (s)

export type Lang = "fr" | "en";

/* ---- Difficultés ---- */
export interface DiffDef {
  nom: string; nomEn: string; desc: string; descEn: string;
  o2: number; heat: number; drain: number; storm: number; mob: number; col: string;
}
export const DIFFS: Record<string, DiffDef> = {
  detendu: { nom: "Détendu", nomEn: "Relaxed", desc: "Exploration tranquille : oxygène et chaleur cléments, peu de tempêtes, faune rare.", descEn: "Laid-back exploration: forgiving oxygen and heat, few storms, rare wildlife.", o2: 0.6, heat: 0.6, drain: 0.85, storm: 0.4, mob: 0.4, col: "#9dff70" },
  normal: { nom: "Normal", nomEn: "Normal", desc: "L'expérience équilibrée voulue par SAM.", descEn: "The balanced experience SAM intended.", o2: 1, heat: 1, drain: 1, storm: 1, mob: 1, col: "#79e0d6" },
  survie: { nom: "Survie", nomEn: "Survival", desc: "Planète hostile : oxygène rare, chaleur mordante, tempêtes et faune agressives.", descEn: "Hostile planet: scarce oxygen, biting heat, aggressive storms and wildlife.", o2: 1.45, heat: 1.4, drain: 1.15, storm: 1.8, mob: 1.9, col: "#ff6b5e" }
};
export type DiffKey = keyof typeof DIFFS;

/* ---- Ressources ---- */
export interface ResDef { nom: string; nomEn: string; col: string; cat: "brut" | "exotique" | "raffine" | "piece" }
export const RESDEF: Record<string, ResDef> = {
  charbon: { nom: "Charbon", nomEn: "Coal", col: "#4a4d61", cat: "brut" },
  fer: { nom: "Fer", nomEn: "Iron", col: "#c77b52", cat: "brut" },
  cuivre: { nom: "Cuivre", nomEn: "Copper", col: "#ff8c42", cat: "brut" },
  quartz: { nom: "Quartz", nomEn: "Quartz", col: "#cfe8ff", cat: "brut" },
  glace: { nom: "Glace", nomEn: "Ice", col: "#a8e4ff", cat: "brut" },
  titane: { nom: "Titane", nomEn: "Titanium", col: "#c9d6e8", cat: "brut" },
  uranium: { nom: "Uranium", nomEn: "Uranium", col: "#8dff70", cat: "brut" },
  cristal: { nom: "Cristal", nomEn: "Crystal", col: "#ff9de8", cat: "brut" },
  magmatite: { nom: "Magmatite", nomEn: "Magmatite", col: "#ff7a45", cat: "brut" },
  iridium: { nom: "Iridium", nomEn: "Iridium", col: "#9ad7ff", cat: "brut" },
  biogel: { nom: "Biogel", nomEn: "Biogel", col: "#b98dff", cat: "exotique" },
  lingot_fer: { nom: "Lingot de fer", nomEn: "Iron ingot", col: "#e0a276", cat: "raffine" },
  lingot_cuivre: { nom: "Lingot de cuivre", nomEn: "Copper ingot", col: "#ffab66", cat: "raffine" },
  acier: { nom: "Acier", nomEn: "Steel", col: "#9aa7bd", cat: "raffine" },
  verre: { nom: "Verre", nomEn: "Glass", col: "#d9f2ff", cat: "raffine" },
  lingot_titane: { nom: "Lingot de titane", nomEn: "Titanium ingot", col: "#e3ecf9", cat: "raffine" },
  carburant: { nom: "Carburant", nomEn: "Fuel", col: "#ffd23e", cat: "raffine" },
  cellule: { nom: "Cellule nucléaire", nomEn: "Nuclear cell", col: "#b4ff8a", cat: "raffine" },
  alliage: { nom: "Alliage stellaire", nomEn: "Stellar alloy", col: "#c7f0ff", cat: "raffine" },
  plasma: { nom: "Noyau de plasma", nomEn: "Plasma core", col: "#ff5ad0", cat: "raffine" },
  plaque: { nom: "Plaque", nomEn: "Plate", col: "#d8b18e", cat: "piece" },
  cable: { nom: "Câble", nomEn: "Cable", col: "#ffb26e", cat: "piece" },
  circuit: { nom: "Circuit", nomEn: "Circuit", col: "#7de0d8", cat: "piece" }
};

/* ---- Voxels : 0 air · 1-5 strates · 6 lave · 7 gaz · 8 cristal · 9 socle ·
 * 10+ minerais · 31 Cœur · 32-33 strates abyssales (Acte II) ---- */
export interface TileDef {
  nom: string; nomEn: string; col: string; col2: string; hard: number;
  air?: boolean; lava?: boolean; gas?: boolean; manual?: boolean;
  bedrock?: boolean; heart?: boolean; res?: string;
}
export const T: Record<number, TileDef> = {
  0: { nom: "", nomEn: "", col: "", col2: "", hard: 0, air: true },
  1: { nom: "Régolithe", nomEn: "Regolith", col: "#7c4a30", col2: "#6e4029", hard: 1 },
  2: { nom: "Roche", nomEn: "Rock", col: "#5d4a52", col2: "#524148", hard: 2 },
  3: { nom: "Basalte", nomEn: "Basalt", col: "#3d3649", col2: "#363041", hard: 3 },
  4: { nom: "Roche profonde", nomEn: "Deep rock", col: "#2b2338", col2: "#261f32", hard: 4 },
  5: { nom: "Manteau", nomEn: "Mantle", col: "#231c30", col2: "#1f192b", hard: 5 },
  6: { nom: "Lave", nomEn: "Lava", col: "#c2340f", col2: "#a52a0a", hard: 9, lava: true },
  7: { nom: "Poche de gaz", nomEn: "Gas pocket", col: "#4c4a3a", col2: "#434232", hard: 1, gas: true },
  8: { nom: "Cristal", nomEn: "Crystal", col: "#463c48", col2: "#3e3540", hard: 2, manual: true },
  9: { nom: "Socle", nomEn: "Bedrock", col: "#0e0b16", col2: "#0e0b16", hard: 99, bedrock: true },
  31: { nom: "Cœur de Kepler", nomEn: "Heart of Kepler", col: "#463c48", col2: "#3e3540", hard: 5, heart: true },
  32: { nom: "Croûte abyssale", nomEn: "Abyssal crust", col: "#3a2026", col2: "#331c22", hard: 5 },
  33: { nom: "Roche du noyau", nomEn: "Core rock", col: "#201322", col2: "#1b101d", hard: 7 }
};
export const ORE: Record<string, number> = {};
{
  const defs: Array<[string, number]> = [["charbon", 1], ["fer", 1], ["cuivre", 1], ["quartz", 2], ["glace", 2], ["titane", 3], ["uranium", 4], ["magmatite", 5], ["iridium", 7]];
  let id = 10;
  for (const [res, hard] of defs) {
    ORE[res] = id;
    T[id] = { nom: RESDEF[res].nom, nomEn: RESDEF[res].nomEn, col: "#463c48", col2: "#3e3540", hard, res };
    id++;
  }
}
export const isRockId = (id: number): boolean => (id >= 1 && id <= 5) || id === 32 || id === 33;

/* ---- Recettes des machines ---- */
export interface Recipe { id: string; label?: string; labelEn?: string; in: Record<string, number>; out: Record<string, number>; t: number; pow: number; act2?: boolean }
export const RECIPES: Record<string, Recipe[]> = {
  fonderie: [
    { id: "lingot_fer", in: { fer: 2 }, out: { lingot_fer: 1 }, t: 4, pow: 2 },
    { id: "lingot_cuivre", in: { cuivre: 2 }, out: { lingot_cuivre: 1 }, t: 4, pow: 2 },
    { id: "verre", in: { quartz: 2 }, out: { verre: 1 }, t: 5, pow: 2 },
    { id: "acier", in: { lingot_fer: 2, charbon: 1 }, out: { acier: 1 }, t: 6, pow: 3 },
    { id: "lingot_titane", in: { titane: 2, charbon: 1 }, out: { lingot_titane: 1 }, t: 8, pow: 4 },
    { id: "fer_recup", label: "Concassage ferreux", labelEn: "Iron crushing", in: { quartz: 2, charbon: 1 }, out: { fer: 2 }, t: 5, pow: 2 },
    { id: "cuivre_recup", label: "Concassage cuivreux", labelEn: "Copper crushing", in: { quartz: 2, charbon: 1 }, out: { cuivre: 2 }, t: 5, pow: 2 },
    { id: "alliage", act2: true, in: { iridium: 2, acier: 1 }, out: { alliage: 1 }, t: 9, pow: 5 }
  ],
  atelier: [
    { id: "plaque", in: { lingot_fer: 2 }, out: { plaque: 1 }, t: 4, pow: 2 },
    { id: "cable", in: { lingot_cuivre: 1 }, out: { cable: 2 }, t: 3, pow: 2 },
    { id: "circuit", in: { verre: 1, cable: 2 }, out: { circuit: 1 }, t: 6, pow: 3 }
  ],
  raffinerie: [
    { id: "carburant", in: { glace: 2 }, out: { carburant: 1 }, t: 5, pow: 4 },
    { id: "biocarburant", label: "Bio-carburant", labelEn: "Biofuel", in: { biogel: 1, glace: 1 }, out: { carburant: 3 }, t: 6, pow: 5 },
    { id: "cellule", in: { uranium: 3, verre: 1 }, out: { cellule: 1 }, t: 10, pow: 6 },
    { id: "plasma", act2: true, in: { magmatite: 3, cellule: 1 }, out: { plasma: 1 }, t: 12, pow: 7 }
  ]
};

/* ---- Bâtiments ---- */
export interface BuildingDef {
  nom: string; nomEn: string; ico: string; desc: string; descEn: string;
  cost: Record<string, number>; repeat?: boolean; max?: number; prereq?: string;
}
export const BUILDINGS: Record<string, BuildingDef> = {
  generateur: { nom: "Générateur à charbon", nomEn: "Coal generator", ico: "↯", desc: "Brûle du charbon pour produire +8↯ (1 charbon toutes les 6 s).", descEn: "Burns coal to produce +8↯ (1 coal every 6 s).", cost: { fer: 10 }, repeat: true },
  fonderie: { nom: "Fonderie", nomEn: "Smelter", ico: "🔥", desc: "Fond automatiquement les minerais : lingots, verre, acier.", descEn: "Automatically smelts ores: ingots, glass, steel.", cost: { fer: 15, cuivre: 5 }, repeat: true },
  atelier: { nom: "Atelier", nomEn: "Workshop", ico: "🔧", desc: "Fabrique plaques, câbles et circuits. Améliore aussi la foreuse et le jetpack.", descEn: "Crafts plates, cables and circuits. Also upgrades the drill pod and jetpack.", cost: { lingot_fer: 6, cuivre: 8 }, max: 1 },
  solaire: { nom: "Panneau solaire", nomEn: "Solar panel", ico: "☀️", desc: "+3↯ le jour. Rien la nuit — pensez aux accumulateurs.", descEn: "+3↯ by day. Nothing at night — think accumulators.", cost: { verre: 2, lingot_cuivre: 3 }, repeat: true },
  accu: { nom: "Accumulateur", nomEn: "Accumulator", ico: "🔋", desc: "Stocke le surplus d'énergie (100↯) et le restitue la nuit ou en pic de demande.", descEn: "Stores surplus power (100↯) and releases it at night or on demand spikes.", cost: { plaque: 4, circuit: 2 }, repeat: true },
  silo: { nom: "Silo", nomEn: "Silo", ico: "📦", desc: "+250 de capacité de stockage pour la base.", descEn: "+250 storage capacity for the base.", cost: { plaque: 4 }, repeat: true },
  raffinerie: { nom: "Raffinerie", nomEn: "Refinery", ico: "⚗️", desc: "Transforme la glace en carburant et l'uranium en cellules.", descEn: "Turns ice into fuel and uranium into cells.", cost: { plaque: 6, circuit: 2 }, repeat: true },
  montecharge: { nom: "Monte-charge", nomEn: "Freight lift", ico: "🏗️", desc: "Indispensable : téléporte la récolte des robots-foreuses vers la base.", descEn: "Essential: teleports mining-robot harvest to the base.", cost: { acier: 6, cable: 8 }, max: 1 },
  baie: { nom: "Baie robotique", nomEn: "Robotics bay", ico: "🤖", desc: "Assemble des robots-foreuses autonomes qui minent sans vous.", descEn: "Assembles autonomous mining robots that dig without you.", cost: { acier: 8, circuit: 4 }, max: 1, prereq: "montecharge" },
  labo: { nom: "Labo cristallin", nomEn: "Crystal lab", ico: "🔬", desc: "Étudie les cristaux : débloque la SURCADENCE des machines (×1.8) et révèle les cristaux sur la carte.", descEn: "Studies crystals: unlocks machine OVERDRIVE (×1.8) and reveals crystals as beacons.", cost: { cristal: 3, acier: 6, circuit: 4 }, max: 1 },
  reacteur: { nom: "Réacteur nucléaire", nomEn: "Nuclear reactor", ico: "☢️", desc: "+40↯ en continu (1 cellule toutes les 45 s).", descEn: "+40↯ continuously (1 cell every 45 s).", cost: { acier: 12, circuit: 6, lingot_titane: 6 }, max: 1 },
  scanner: { nom: "Géoscanner", nomEn: "Geoscanner", ico: "📡", desc: "Révèle les filons à travers la roche autour de la foreuse.", descEn: "Reveals ore veins through rock around the drill pod.", cost: { circuit: 3, verre: 4 }, max: 1 }
};
export const BUILD_ORDER = ["generateur", "fonderie", "atelier", "solaire", "accu", "silo", "raffinerie", "montecharge", "baie", "labo", "reacteur", "scanner"];

/* ---- Améliorations (Atelier) ---- */
export interface UpgradeDef {
  nom: string; nomEn: string; desc: string; descEn: string;
  vals: any[]; costs: Array<Record<string, number> | null>;
}
export const UPGRADES: Record<string, UpgradeDef> = {
  foret: { nom: "Foret", nomEn: "Drill bit", desc: "Perce des roches plus dures, plus vite.", descEn: "Drills harder rock, faster.", vals: [{ h: 2, sp: 1 }, { h: 3, sp: 1.6 }, { h: 4, sp: 2.4 }, { h: 5, sp: 3.4 }, { h: 7, sp: 4.6 }], costs: [null, { lingot_fer: 8 }, { acier: 10 }, { lingot_titane: 8 }, { magmatite: 10, acier: 8 }] },
  soute: { nom: "Soute", nomEn: "Cargo hold", desc: "Transporte plus de minerai par expédition.", descEn: "Carries more ore per trip.", vals: [12, 20, 32, 50], costs: [null, { fer: 12 }, { lingot_fer: 10 }, { acier: 8 }] },
  batterie: { nom: "Batterie", nomEn: "Battery", desc: "Plus d'autonomie sous terre.", descEn: "More endurance underground.", vals: [100, 160, 240, 350], costs: [null, { cuivre: 10 }, { lingot_cuivre: 8 }, { circuit: 3 }] },
  coque: { nom: "Coque", nomEn: "Hull", desc: "Résiste aux chutes, à la lave et aux explosions.", descEn: "Withstands falls, lava and explosions.", vals: [60, 100, 150, 220], costs: [null, { fer: 15 }, { acier: 6 }, { lingot_titane: 6 }] },
  refroid: { nom: "Refroidissement", nomEn: "Cooling", desc: "Repousse la profondeur de surchauffe.", descEn: "Pushes the overheating depth further down.", vals: [55, 85, 115, 142, 205], costs: [null, { verre: 4, lingot_cuivre: 6 }, { acier: 8, circuit: 2 }, { lingot_titane: 6, circuit: 4 }, { magmatite: 6, acier: 6 }] },
  jets: { nom: "Réacteurs", nomEn: "Thrusters", desc: "Poussée des réacteurs de vol de la foreuse.", descEn: "Thrust of the pod's flight thrusters.", vals: [26, 32, 40], costs: [null, { lingot_cuivre: 6 }, { acier: 6 }] },
  jetpack: { nom: "Jetpack", nomEn: "Jetpack", desc: "Autonomie de vol de l'astronaute à pied.", descEn: "Flight endurance of the astronaut on foot.", vals: [90, 150, 240], costs: [null, { lingot_cuivre: 4, verre: 2 }, { cristal: 2, circuit: 2 }] }
};
export type UpKey = "foret" | "soute" | "batterie" | "coque" | "refroid" | "jets" | "jetpack";
export const DEFAULT_UP: Record<UpKey, number> = { foret: 1, soute: 1, batterie: 1, coque: 1, refroid: 1, jets: 1, jetpack: 1 };

/* ---- Paliers de profondeur ---- */
export interface DepthDef { m: number; sam: string; samEn: string; gift: Record<string, number> }
export const DEPTHS: DepthDef[] = [
  { m: 50, sam: "Profondeur : 50 mètres. Les strates se densifient — gardez un œil sur la coque.", samEn: "Depth: 50 meters. The strata are getting denser — keep an eye on the hull.", gift: { fer: 4 } },
  { m: 100, sam: "100 mètres ! La chaleur grimpe. Refroidissement et blindage thermique deviennent précieux.", samEn: "100 meters! Heat is climbing. Cooling and thermal shielding are getting precious.", gift: { cuivre: 4 } },
  { m: 150, sam: "150 mètres. Territoire des Rampants et des filons de titane. Prudence, pilote.", samEn: "150 meters. Crawler territory — and titanium veins. Careful, pilot.", gift: { quartz: 3 } },
  { m: 200, sam: "200 mètres. Peu de foreurs sont descendus si bas. L'uranium n'est plus loin.", samEn: "200 meters. Few drillers have gone this deep. Uranium isn't far now.", gift: { titane: 3 } },
  { m: 250, sam: "250 mètres… la légende du CŒUR DE KEPLER parlait du socle même de la planète. Continuez.", samEn: "250 meters… the legend of the HEART OF KEPLER spoke of the planet's very bedrock. Keep going.", gift: { uranium: 2 } },
  { m: 300, sam: "300 mètres — la CROÛTE ABYSSALE. La magmatite rougeoie dans la roche : c'est elle qui forgera le Foret Mk5.", samEn: "300 meters — the ABYSSAL CRUST. Magmatite glows in the rock: it will forge the Mk5 drill bit.", gift: { magmatite: 2 } },
  { m: 400, sam: "400 mètres !? Personne n'est descendu si près du noyau. L'IRIDIUM scintille — l'alliage stellaire est à portée de foret.", samEn: "400 meters!? No one has ever been this close to the core. IRIDIUM sparkles — stellar alloy is within drill's reach.", gift: { iridium: 2 } }
];

/* ---- Recherche (Labo cristallin) ---- */
export interface ResearchDef { id: string; nom: string; nomEn: string; ico: string; cost: number; desc: string; descEn: string }
export const RESEARCH: ResearchDef[] = [
  { id: "optique", nom: "Optique de scan", nomEn: "Scan optics", ico: "📡", cost: 2, desc: "Portée de révélation des filons +6 m (foreuse & robots).", descEn: "Ore reveal range +6 m (pod & robots)." },
  { id: "thermique", nom: "Blindage thermique", nomEn: "Thermal shielding", ico: "🌡️", cost: 2, desc: "Dégâts de chaleur des profondeurs réduits de moitié.", descEn: "Deep-heat damage halved." },
  { id: "servos", nom: "Servos robotiques", nomEn: "Robotic servos", ico: "🤖", cost: 3, desc: "Robots-foreuses : rayon d'action +1 et cycle 20 % plus rapide.", descEn: "Mining robots: +1 range and 20% faster cycle." },
  { id: "recyclage", nom: "Recyclage moléculaire", nomEn: "Molecular recycling", ico: "♻️", cost: 3, desc: "20 % de chances qu'une machine produise une unité en plus.", descEn: "20% chance a machine produces one extra unit." },
  { id: "bouclier", nom: "Voile anti-tempête", nomEn: "Storm veil", ico: "🛡️", cost: 2, desc: "Tempêtes plus rares et panneaux solaires bien moins aveuglés.", descEn: "Rarer storms and far less blinded solar panels." },
  { id: "nitro", nom: "Propulseurs Nova", nomEn: "Nova thrusters", ico: "🔥", cost: 4, desc: "Jetpack +80↯ et réacteurs de vol de la foreuse renforcés.", descEn: "Jetpack +80↯ and reinforced pod flight thrusters." },
  { id: "sonique", nom: "Répulseur sonique", nomEn: "Sonic repeller", ico: "📢", cost: 4, desc: "À bord de la foreuse : une impulsion périodique blesse et repousse les Rampants alentour.", descEn: "Aboard the pod: a periodic pulse hurts and repels nearby Crawlers." }
];

/* ---- Fusée ---- */
export interface RocketSys { key: string; nom: string; nomEn: string; ico: string; cost: Record<string, number> }
export const ROCKET: RocketSys[] = [
  { key: "structure", nom: "Structure", nomEn: "Structure", ico: "🛠️", cost: { plaque: 12, lingot_titane: 4 } },
  { key: "cablage", nom: "Câblage", nomEn: "Wiring", ico: "🔌", cost: { cable: 16 } },
  { key: "avionique", nom: "Avionique", nomEn: "Avionics", ico: "🧠", cost: { circuit: 8 } },
  { key: "moteur", nom: "Moteur", nomEn: "Engine", ico: "🔥", cost: { acier: 10, lingot_titane: 4, circuit: 2 } },
  { key: "carburant", nom: "Carburant", nomEn: "Fuel", ico: "⛽", cost: { carburant: 40 } }
];
export const ROCKET2: RocketSys[] = [
  { key: "blindage", nom: "Blindage stellaire", nomEn: "Stellar plating", ico: "🛠️", cost: { alliage: 8 } },
  { key: "propulsion", nom: "Réacteur à plasma", nomEn: "Plasma engine", ico: "🔥", cost: { plasma: 3, alliage: 4 } },
  { key: "thermo", nom: "Bouclier de rentrée", nomEn: "Re-entry shield", ico: "🌡️", cost: { alliage: 5, verre: 8 } },
  { key: "guidage", nom: "Guidage quantique", nomEn: "Quantum guidance", ico: "🧠", cost: { circuit: 10, cristal: 4 } },
  { key: "carbu2", nom: "Carburant enrichi", nomEn: "Enriched fuel", ico: "⛽", cost: { carburant: 50, uranium: 10 } }
];

/* ---- Quêtes (SAM) — conditions évaluées dans sim.ts par index ---- */
export interface QuestDef { txt: string; txtEn: string; tip: string; tipEn: string; sam: string; samEn: string; gift?: Record<string, number> }
export const QUESTS: QuestDef[] = [
  { txt: "Monter à bord de la foreuse", txtEn: "Board the drill pod", tip: "Approchez-vous d'elle et appuyez sur E", tipEn: "Walk up to it and press E", sam: "Ici SAM, l'ordinateur de bord. Ravi de vous voir entier, pilote ! La foreuse de secours est opérationnelle : approchez-vous et appuyez sur E. Et si vous tombez dans un trou, le JETPACK vous remontera.", samEn: "SAM here, your onboard computer. Glad to see you in one piece, pilot! The rescue drill pod is operational: walk up and press E. And if you fall into a hole, the JETPACK will lift you out." },
  { txt: "Extraire 5 Fer et 5 Charbon", txtEn: "Mine 5 Iron and 5 Coal", tip: "Visez la roche et maintenez le clic pour forer · posez-vous en surface pour décharger", tipEn: "Aim at rock and hold click to drill · land at the surface to unload", sam: "Systèmes nominaux. Visez la roche et maintenez le clic : il nous faut du FER et du CHARBON. Revenez vous poser en surface : je décharge et recharge tout automatiquement.", samEn: "Systems nominal. Aim at the rock and hold click: we need IRON and COAL. Come land back at the surface: I unload and recharge everything automatically.", gift: { fer: 6, charbon: 6 } },
  { txt: "Construire un Générateur et une Fonderie", txtEn: "Build a Generator and a Smelter", tip: "Touche B (ou E au sol) · placez où vous voulez sur le sol", tipEn: "Key B (or E on the ground) · place anywhere on the ground", sam: "Bien reçu. Ouvrez le menu Construire : un fantôme suit votre visée, posez-le n'importe où sur le sol. D'abord un GÉNÉRATEUR pour l'énergie, puis une FONDERIE.", samEn: "Copy that. Open the Build menu: a ghost follows your aim, drop it anywhere on the ground. First a GENERATOR for power, then a SMELTER.", gift: { charbon: 8 } },
  { txt: "Produire 4 Lingots de fer", txtEn: "Produce 4 Iron ingots", tip: "Ouvrez la fonderie et choisissez la recette", tipEn: "Open the smelter and pick the recipe", sam: "La fonderie travaille toute seule tant qu'elle a du minerai et de l'énergie. Ouvrez-la et choisissez la recette Lingot de fer !", samEn: "The smelter works on its own as long as it has ore and power. Open it and pick the Iron ingot recipe!", gift: { cuivre: 8 } },
  { txt: "Construire l'Atelier et passer le Foret en Mk2", txtEn: "Build the Workshop and upgrade the Drill bit to Mk2", tip: "L'Atelier améliore la foreuse, le jetpack, et fabrique des pièces", tipEn: "The Workshop upgrades the pod, the jetpack, and crafts parts", sam: "Construisez l'ATELIER : il fabrique des pièces — et améliore la foreuse comme votre jetpack. La roche dure ne cédera qu'avec un Foret Mk2 !", samEn: "Build the WORKSHOP: it crafts parts — and upgrades the pod and your jetpack. Hard rock will only yield to a Mk2 drill bit!", gift: { quartz: 6 } },
  { txt: "Monte-charge + Baie robotique, puis déployer 1 robot", txtEn: "Freight lift + Robotics bay, then deploy 1 robot", tip: "Touche R sous terre, près d'un filon", tipEn: "Key R underground, near a vein", sam: "Place à l'automatisation : MONTE-CHARGE puis BAIE ROBOTIQUE. Assemblez un robot-foreuse et déployez-le sous terre avec R, près d'un filon !", samEn: "Time to automate: FREIGHT LIFT then ROBOTICS BAY. Assemble a mining robot and deploy it underground with R, near a vein!", gift: { glace: 4 } },
  { txt: "Avoir 3 robots actifs et produire 5 Aciers", txtEn: "Have 3 active robots and produce 5 Steel", tip: "Acier = 2 lingots de fer + 1 charbon (fonderie)", tipEn: "Steel = 2 iron ingots + 1 coal (smelter)", sam: "Excellent. Trois robots au travail, et de l'ACIER en fonderie : l'usine doit tourner sans vous. C'est ça, l'automatisation !", samEn: "Excellent. Three robots at work, and STEEL in the smelter: the factory must run without you. That's automation!", gift: { titane: 4 } },
  { txt: "Récolter 3 Cristaux dans les cavernes (à pied)", txtEn: "Harvest 3 Crystals in the caverns (on foot)", tip: "Sortez de la foreuse (E) près d'une caverne · les cristaux brillent en rose · E pour récolter", tipEn: "Exit the pod (E) near a cavern · crystals glow pink · E to harvest", sam: "Mes capteurs détectent des CRISTAUX dans les cavernes — trop fragiles pour le foret : il faudra les cueillir À PIED ! Surveillez votre oxygène, et comptez sur le jetpack pour remonter. Ils débloquent le Labo, la surcadence et le jetpack Mk3.", samEn: "My sensors detect CRYSTALS in the caverns — too fragile for the drill: you'll have to pick them ON FOOT! Watch your oxygen, and count on the jetpack to climb back. They unlock the Lab, overdrive and the Mk3 jetpack.", gift: { circuit: 3 } },
  { txt: "Réparer les 5 systèmes de la fusée", txtEn: "Repair the rocket's 5 systems", tip: "Panneau FUSÉE 🚀 → Fournir les pièces", tipEn: "ROCKET panel 🚀 → Supply the parts", sam: "Dernière ligne droite : ouvrez le panneau FUSÉE 🚀 et fournissez les pièces des 5 systèmes. La glace raffinée fera un excellent carburant.", samEn: "Home stretch: open the ROCKET panel 🚀 and supply parts for all 5 systems. Refined ice makes excellent fuel." },
  { txt: "Appuyer sur DÉCOLLAGE 🚀", txtEn: "Press LIFT-OFF 🚀", tip: "Panneau FUSÉE → le gros bouton orange", tipEn: "ROCKET panel → the big orange button", sam: "Tous les voyants sont verts, pilote. Appuyez sur DÉCOLLAGE quand vous êtes prêt. Direction : la maison !", samEn: "All lights are green, pilot. Press LIFT-OFF when ready. Destination: home!" },
  /* ---- Acte II ---- */
  { txt: "Forer la Magmatite des abysses", txtEn: "Mine abyssal Magmatite", tip: "Le crash a fissuré l'ancien socle : les ABYSSES s'ouvrent vers 300 m · Refroidissement Mk5 conseillé", tipEn: "The crash cracked the old bedrock: the ABYSS opens around 300 m · Mk5 Cooling advised", sam: "Pilote… on est vivants. La mauvaise nouvelle : l'alliage de la coque n'a pas supporté l'ascension — il nous faut du MATÉRIAU STELLAIRE. La bonne : l'impact a fissuré le socle, les ABYSSES sont ouvertes ! Cherchez la MAGMATITE, vers 300 mètres.", samEn: "Pilot… we're alive. Bad news: the hull alloy didn't survive the climb — we need STELLAR MATERIAL. Good news: the impact cracked the bedrock, the ABYSS is open! Look for MAGMATITE, around 300 meters.", gift: { acier: 6 } },
  { txt: "Forger le Foret Mk5, puis extraire 8 Iridium", txtEn: "Forge the Mk5 Drill bit, then mine 8 Iridium", tip: "Atelier → Foret Mk5 (magmatite) · l'iridium gît dans la roche du noyau (≈350 m et plus)", tipEn: "Workshop → Mk5 drill bit (magmatite) · iridium lies in core rock (≈350 m and deeper)", sam: "Cette magmatite est prodigieuse ! L'Atelier peut en forger un FORET Mk5 capable de mordre la roche du noyau. L'IRIDIUM nous y attend — c'est la clé de l'alliage stellaire.", samEn: "This magmatite is extraordinary! The Workshop can forge it into a Mk5 DRILL BIT that bites core rock. IRIDIUM awaits us there — the key to stellar alloy.", gift: { cellule: 2 } },
  { txt: "Reconstruire les 5 systèmes stellaires", txtEn: "Rebuild the 5 stellar systems", tip: "Fonderie : Alliage stellaire · Raffinerie : Noyau de plasma · puis panneau FUSÉE", tipEn: "Smelter: Stellar alloy · Refinery: Plasma core · then ROCKET panel", sam: "Alliage stellaire à la fonderie, noyaux de plasma à la raffinerie. Reconstruisons cette fusée pour qu'elle TIENNE, cette fois. Les cinq systèmes stellaires, pilote !", samEn: "Stellar alloy at the smelter, plasma cores at the refinery. Let's rebuild this rocket so it HOLDS this time. All five stellar systems, pilot!" },
  { txt: "DÉCOLLAGE — le vrai, cette fois", txtEn: "LIFT-OFF — for real this time", tip: "Panneau FUSÉE → le gros bouton orange. Cette fois, c'est la bonne.", tipEn: "ROCKET panel → the big orange button. This time it's the one.", sam: "Diagnostic complet : blindage stellaire nominal, réacteur à plasma stable, carburant enrichi. KEPLER-9b ne nous retiendra pas deux fois. Quand vous voulez, pilote.", samEn: "Full diagnostics: stellar plating nominal, plasma engine stable, enriched fuel. KEPLER-9b won't hold us twice. Whenever you're ready, pilot." }
];
export const ACT2_QI = 10;

/* ---- Exploits (succès) — conditions dans sim/feats ---- */
export interface FeatDef { id: string; ico: string; nom: string; nomEn: string; desc: string; descEn: string }
export const FEATS: FeatDef[] = [
  { id: "premier", ico: "▸", nom: "Premier coup de foret", nomEn: "First strike", desc: "Extraire votre tout premier minerai.", descEn: "Mine your very first ore." },
  { id: "prof50", ico: "▼", nom: "Mineur confirmé", nomEn: "Seasoned miner", desc: "Atteindre 50 m de profondeur.", descEn: "Reach a depth of 50 m." },
  { id: "prof150", ico: "▼", nom: "Au cœur des ténèbres", nomEn: "Heart of darkness", desc: "Atteindre 150 m de profondeur.", descEn: "Reach a depth of 150 m." },
  { id: "prof250", ico: "▼", nom: "Toucher le fond", nomEn: "Rock bottom", desc: "Atteindre 250 m — le socle n'est plus loin.", descEn: "Reach 250 m — bedrock isn't far." },
  { id: "cristaux", ico: "◈", nom: "Cueilleur de lumière", nomEn: "Light picker", desc: "Récolter 5 cristaux à pied.", descEn: "Harvest 5 crystals on foot." },
  { id: "usine", ico: "▣", nom: "Révolution industrielle", nomEn: "Industrial revolution", desc: "Avoir 6 bâtiments debout en même temps.", descEn: "Have 6 buildings standing at once." },
  { id: "automate", ico: "●", nom: "L'usine tourne seule", nomEn: "The factory runs itself", desc: "3 robots-foreuses actifs en même temps.", descEn: "3 mining robots active at once." },
  { id: "armada", ico: "◉", nom: "Armada minière", nomEn: "Mining armada", desc: "6 robots-foreuses actifs en même temps.", descEn: "6 mining robots active at once." },
  { id: "chasseur", ico: "✕", nom: "Dératiseur de KEPLER", nomEn: "KEPLER exterminator", desc: "Vaincre 10 Rampants.", descEn: "Defeat 10 creatures." },
  { id: "brisenid", ico: "⊗", nom: "Brise-nid", nomEn: "Nest breaker", desc: "Détruire un nid de Rampants.", descEn: "Destroy a Crawler nest." },
  { id: "plancher", ico: "⟫", nom: "Pied au plancher", nomEn: "Pedal to the metal", desc: "Cumuler 60 s de SURRÉGIME.", descEn: "Accumulate 60 s of OVERDRIVE." },
  { id: "coeur", ico: "◆", nom: "Le Cœur de Kepler", nomEn: "The Heart of Kepler", desc: "Découvrir l'artefact légendaire des profondeurs.", descEn: "Discover the legendary artifact of the depths." },
  { id: "retour", ico: "★", nom: "Retour à la maison", nomEn: "Homecoming", desc: "Réparer la fusée et décoller.", descEn: "Repair the rocket and lift off." },
  { id: "parfaite", ico: "☆", nom: "Mission parfaite", nomEn: "Flawless mission", desc: "Décoller sans le moindre rapatriement d'urgence.", descEn: "Lift off without a single emergency rescue." }
];

/* ---- Faune ---- */
export interface MobDef { nom: string; nomEn: string; hp: number; dmgDrill: number; dmgFoot: number; spd: number; aggro: number; biogel: number; minD: number; body: string; core: string; ranged?: boolean }
export const MOBS: Record<string, MobDef> = {
  rampant: { nom: "Rampant", nomEn: "Crawler", hp: 22, dmgDrill: 9, dmgFoot: 9, spd: 2.5, aggro: 11, biogel: 1, minD: 20, body: "#a866ff", core: "#efd7ff" },
  traqueur: { nom: "Traqueur", nomEn: "Stalker", hp: 34, dmgDrill: 13, dmgFoot: 12, spd: 3.7, aggro: 16, biogel: 2, minD: 120, body: "#ff5c85", core: "#ffd7e2" },
  cracheur: { nom: "Cracheur", nomEn: "Spitter", hp: 18, dmgDrill: 6, dmgFoot: 6, spd: 1.9, aggro: 15, biogel: 2, minD: 150, body: "#7dff8a", core: "#daffd7", ranged: true }
};

/* ---- Robots ---- */
export const ROBOT_COST: Record<string, number> = { acier: 4, cable: 4, circuit: 1 };
export const BAIE_UP: Array<Record<string, number> | null> = [null, { acier: 10, circuit: 4 }, { acier: 16, circuit: 8, lingot_titane: 4 }];
export const SPD_UP: Array<Record<string, number> | null> = [null, { cable: 10, circuit: 3 }, { circuit: 8, acier: 8 }];
export const ROBOT_ITV = [3.5, 2.6, 1.8];
export const ROBOT_CAP = [3, 6, 9];

/* ---- Vestiaire (couleurs de l'astronaute, visibles en coop) ---- */
export const COSMETIC = {
  suit: [
    { nom: "Ivoire", nomEn: "Ivory", col: "#ece7da", col2: "#e4dfd1", dk: "#c9c4b6" },
    { nom: "Rouille", nomEn: "Rust", col: "#d98a4a", col2: "#c67a3e", dk: "#a5622f" },
    { nom: "Océan", nomEn: "Ocean", col: "#5b8fb0", col2: "#4f80a0", dk: "#3d6480" },
    { nom: "Forêt", nomEn: "Forest", col: "#6f9e5b", col2: "#628f50", dk: "#4c7040" },
    { nom: "Améthyste", nomEn: "Amethyst", col: "#9a77c9", col2: "#8a6abb", dk: "#6f5399" },
    { nom: "Graphite", nomEn: "Graphite", col: "#8a8f9c", col2: "#7d828f", dk: "#5f636e" }
  ],
  visor: [
    { nom: "Turquoise", nomEn: "Turquoise", col: "#7de0d8" },
    { nom: "Or", nomEn: "Gold", col: "#ffd23e" },
    { nom: "Rose", nomEn: "Pink", col: "#ff9de8" },
    { nom: "Glace", nomEn: "Ice", col: "#a8e4ff" },
    { nom: "Cramoisi", nomEn: "Crimson", col: "#ff6b5e" },
    { nom: "Émeraude", nomEn: "Emerald", col: "#6ff0a0" }
  ],
  accent: [
    { nom: "Ambre", nomEn: "Amber", col: "#c98a3f", dk: "#8d5c28" },
    { nom: "Sarcelle", nomEn: "Teal", col: "#2fb8a8", dk: "#1f8478" },
    { nom: "Magenta", nomEn: "Magenta", col: "#e05aff", dk: "#a13cc0" },
    { nom: "Citron", nomEn: "Lime", col: "#9dff70", dk: "#6fbf48" },
    { nom: "Orange", nomEn: "Orange", col: "#ff8c42", dk: "#c05f22" },
    { nom: "Acier", nomEn: "Steel", col: "#9aa7bd", dk: "#6b7688" }
  ]
};

/* ---- Astuces (panneau Aide) ---- */
export const TIPS: Array<{ fr: string; en: string }> = [
  { fr: "Posez-vous en surface : déchargement, recharge et réparations sont automatiques.", en: "Land at the surface: unloading, recharging and repairs are automatic." },
  { fr: "La foreuse creuse là où vous visez : maintenez le clic sur un bloc à portée.", en: "The pod digs where you aim: hold click on a block within reach." },
  { fr: "Le SURRÉGIME (Shift) fait percer et voler beaucoup plus vite — mais la batterie fond, et ça surchauffe dans les profondeurs.", en: "OVERDRIVE (Shift) makes you drill and fly much faster — but the battery melts, and it overheats at depth." },
  { fr: "Des Rampants bioluminescents rôdent dans les profondeurs : foncez dans le tas avec la foreuse pour les écraser, ou fuyez au jetpack à pied.", en: "Bioluminescent Crawlers prowl the depths: ram them with the pod to crush them, or flee with the jetpack on foot." },
  { fr: "Les Rampants lâchent du BIOGEL : raffiné avec de la glace, il donne 3× plus de carburant.", en: "Crawlers drop BIOGEL: refined with ice, it yields 3× more fuel." },
  { fr: "Plus on descend, plus la faune est dangereuse : les TRAQUEURS foncent, les CRACHEURS tirent à distance.", en: "The deeper you go, the deadlier the fauna: STALKERS charge, SPITTERS shoot from range." },
  { fr: "Tout au fond se cachent des NIDS : ils pondent sans fin. Détruisez-les en fonçant dedans avec la foreuse.", en: "Deep down hide NESTS: they spawn endlessly. Destroy them by ramming them with the pod." },
  { fr: "En l'air, le jetpack de l'astronaute vous sort de n'importe quel trou.", en: "In the air, the astronaut's jetpack lifts you out of any hole." },
  { fr: "À pied sous terre, l'oxygène file — regagnez la foreuse ou la surface pour respirer.", en: "On foot underground, oxygen drains — get back to the pod or the surface to breathe." },
  { fr: "Les cristaux roses des cavernes ne se récoltent qu'à pied (E). Sacoche : 4 max.", en: "Pink cavern crystals can only be harvested on foot (E). Pouch: 4 max." },
  { fr: "Le Labo cristallin débloque la SURCADENCE et un arbre de RECHERCHE payé en cristaux.", en: "The Crystal lab unlocks OVERDRIVE and a RESEARCH tree paid in crystals." },
  { fr: "Les accumulateurs stockent le surplus solaire du jour pour tenir la nuit.", en: "Accumulators store the day's solar surplus to last the night." },
  { fr: "La nuit, des météorites s'écrasent parfois : leurs débris regorgent de titane.", en: "At night, meteorites sometimes crash: their debris is packed with titanium." },
  { fr: "Les roches verdâtres sont des poches de gaz : elles explosent quand on les fore !", en: "Greenish rocks are gas pockets: they explode when drilled!" },
  { fr: "Plus on descend, plus il fait chaud : la jauge de température vous prévient avant la surchauffe.", en: "The deeper you go, the hotter it gets: the heat gauge warns you before overheating." },
  { fr: "Les robots-foreuses minent tout seuls — même l'uranium des profondeurs.", en: "Mining robots dig on their own — even deep uranium." },
  { fr: "KEPLER-9b est sismiquement active : des secousses font affleurer de NOUVEAUX filons. Les ressources ne s'épuisent jamais vraiment !", en: "KEPLER-9b is seismically active: quakes surface NEW veins. Resources never truly run out!" },
  { fr: "Sous l'ancien socle : la CROÛTE ABYSSALE (magmatite, ≈300 m) puis la ROCHE DU NOYAU (iridium, dureté 7 — Foret Mk5 obligatoire).", en: "Below the old bedrock: the ABYSSAL CRUST (magmatite, ≈300 m) then CORE ROCK (iridium, hardness 7 — Mk5 drill bit required)." },
  { fr: "L'ALLIAGE STELLAIRE se fond avec iridium + acier ; le NOYAU DE PLASMA se raffine avec magmatite + cellule.", en: "STELLAR ALLOY is smelted from iridium + steel; the PLASMA CORE is refined from magmatite + cell." },
  { fr: "À court de fer ou de cuivre ? La fonderie sait CONCASSER du quartz et du charbon pour en extraire.", en: "Out of iron or copper? The smelter can CRUSH quartz and coal to extract some." },
  { fr: "Une légende de prospecteur parle d'un CŒUR enfoui tout au fond de la planète…", en: "A prospector legend speaks of a HEART buried at the very bottom of the planet…" },
  { fr: "Si la batterie tombe à zéro sous terre, retour d'urgence et cargaison perdue !", en: "If the battery hits zero underground: emergency return and cargo lost!" },
  { fr: "V bascule entre première et troisième personne — à pied comme en foreuse.", en: "V toggles between first and third person — on foot and in the pod." }
];
