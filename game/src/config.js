// Bahia Verde Heat — shared tuning constants and world layout.
// One job per file: this file only holds numbers and fixed places, no logic.
export const WORLD = {
  width: 3200,
  height: 2400,
  roadGap: 400,
  roadWidth: 72,
  firstRoad: 200,
  beachY: 2260,
  waterY: 2340,
  seed: 20261120,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 170,
  runSpeed: 265,
  hpMax: 100,
  // A cop can only start a bust while the player is (near-)stopped or on foot.
  bustSpeed: 32,
  bustRadius: 52,
  bustSeconds: 2.5,
  shootCooldown: 0.22,
  bulletSpeed: 620,
  bulletDamage: 2,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 620,
  reverseAccel: 240,
  maxSpeed: 430,
  maxReverse: 150,
  turnRate: 2.6,
  drag: 0.55,
  handbrakeDrag: 2.4,
  stealRadius: 64,
};

// Fixed places in the city, all on or beside roads so every job is reachable.
export const PLACES = {
  garage: { x: 620, y: 300, label: "Marisol's Garage" },
  docks: { x: 2960, y: 2140, label: 'Bahia Docks' },
  turf: { x: 1820, y: 1420, label: 'Rival Turf' },
  beach: { x: 1000, y: 2300, label: 'Playa Verde' },
  drops: [
    { x: 1020, y: 620, label: 'Drop 1' },
    { x: 2220, y: 1020, label: 'Drop 2' },
    { x: 1420, y: 1800, label: 'Drop 3' },
  ],
  start: { x: 620, y: 420 },
  getawayCar: { x: 600, y: 260 },
};

export const MISSIONS = [
  {
    id: 1,
    title: 'Job 1 — Borrowed Coupe',
    brief: 'Steal any car and bring it to Marisol\u2019s Garage.',
    reward: 500,
  },
  {
    id: 2,
    title: 'Job 2 — Cash Drops',
    brief: 'Collect the 3 cash bags stashed around Bahia Verde.',
    reward: 450,
  },
  {
    id: 3,
    title: 'Job 3 — Hot Wheels',
    brief: 'The heat is on: stay clear of the cops for 20 seconds.',
    reward: 800,
  },
  {
    id: 4,
    title: 'Job 4 — Rival Turf',
    brief: 'On foot: clear 6 rivals from the turf at 18th & Marina.',
    reward: 1200,
  },
  {
    id: 5,
    title: 'Job 5 — The Big Getaway',
    brief: 'Take the getaway car from the garage to the Bahia Docks.',
    reward: 2500,
  },
];

export const WANTED = {
  max: 5,
  decaySeconds: 22,
  steal: 1,
  shoot: 1,
  hitPed: 1,
};

export const COLORS = {
  asphalt: '#3d3a38',
  asphaltLine: '#d8c25a',
  sidewalk: '#b9a98f',
  grass: '#7fae5a',
  sand: '#e8d29a',
  water: '#2e7fa8',
  buildingRoof: ['#c96f4a', '#4a7fb5', '#e0a458', '#8a6fb5', '#5aa88a', '#b54a6e'],
  palm: '#3f8f4f',
};

export const SAVE_KEY = 'bahia-verde-heat-save-v1';
