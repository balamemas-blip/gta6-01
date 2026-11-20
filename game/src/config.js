// Solmar Heat — config: world size, city layout, tuning, missions.
// Everything here is original: the city of Solmar, its streets, jobs and people
// are invented for this game. No real place, no licensed material.

export const WORLD = {
  w: 2560,
  h: 1920,
  // Road grid: vertical roads at these x, horizontal at these y (px).
  roadsX: [160, 480, 800, 1120, 1440, 1760, 2080, 2400],
  roadsY: [160, 480, 800, 1120, 1440, 1760],
  roadHalf: 34,
  // Beach strip along the south edge; water below it.
  beachY: 1800,
};

export const TUNING = {
  walkSpeed: 175,
  runSpeed: 265,
  carAccel: 430,
  carMaxSpeed: 540,
  carReverseMax: 210,
  carTurn: 2.6,
  carDrag: 0.5, // per-second coast factor: coasting halves speed each second
  carBrake: 620,
  bulletSpeed: 620,
  bulletDamage: 34,
  shootCooldown: 0.34,
  punchRange: 46,
  policeRamDamage: 9,
  crashDamageSpeed: 380,
  wantedDecaySeconds: 15,
  bustedHoldSeconds: 2.5,
  trafficCount: 14,
  pedCount: 22,
  maxPolice: 4,
};

export const COLORS = {
  grass: '#4d8a4a',
  grassDark: '#437a40',
  road: '#3a3f47',
  roadLine: '#d8c95a',
  sidewalk: '#8d9299',
  beach: '#e8d29a',
  water: '#2f7fb8',
  buildingRoof: '#b0563a',
  buildingRoof2: '#5d7fa3',
  buildingRoof3: '#7a6a9e',
  buildingEdge: '#2c2f36',
  park: '#3f7d3a',
  player: '#ffd23f',
  playerCar: '#e33e2b',
  trafficCar: '#7fb3d5',
  policeCar: '#20304a',
  ped: '#f2e6c9',
};

// Landmarks: name + position. Missions point at these.
export const PLACES = {
  luzGarage: { name: "Luz Garage", x: 480, y: 1440 },
  docks: { name: "Solmar Docks", x: 160, y: 800 },
  kikoBar: { name: "Kiko's Rooftop Bar", x: 2080, y: 480 },
  hideout: { name: "Hideout — Pier 9", x: 2400, y: 1760 },
  bank: { name: "Solmar Trust Bank", x: 1120, y: 480 },
  plaza: { name: "Plaza del Sol", x: 1440, y: 1120 },
  market: { name: "Night Market", x: 800, y: 1120 },
  marina: { name: "Marina", x: 2080, y: 1760 },
};

// Five jobs, in story order. Each job is a chain of steps; a step is
// "goto" (reach a marker, on foot or in a car) or "survive" (stay free
// for N seconds while the police chase you).
export const MISSIONS = [
  {
    id: 'borrowed-wheels',
    title: 'Job 1 — Borrowed Wheels',
    brief: 'Luz needs a ride. Steal any car and bring it to Luz Garage.',
    reward: 200,
    steps: [
      { kind: 'stealCar' },
      { kind: 'goto', place: 'luzGarage', text: 'Drive the car to Luz Garage' },
    ],
  },
  {
    id: 'package-run',
    title: 'Job 2 — Package Run',
    brief: 'A package waits at the Docks. Fetch it, then deliver it to Kiko’s Bar.',
    reward: 300,
    steps: [
      { kind: 'goto', place: 'docks', text: 'Pick up the package at Solmar Docks' },
      { kind: 'goto', place: 'kikoBar', text: 'Deliver the package to Kiko’s Rooftop Bar' },
    ],
  },
  {
    id: 'heat-check',
    title: 'Job 3 — Heat Check',
    brief: 'The cops are onto you. Survive the chase for 40 seconds, then reach the Hideout.',
    reward: 400,
    wantedOnStart: 2,
    steps: [
      { kind: 'survive', seconds: 40, text: 'Outrun the police — survive 40s' },
      { kind: 'goto', place: 'hideout', text: 'Lose the heat — reach the Hideout' },
    ],
  },
  {
    id: 'payday-pickup',
    title: 'Job 4 — Payday Pickup',
    brief: 'Three cash drops are stashed around the city. Grab all three.',
    reward: 500,
    wantedOnStart: 1,
    steps: [
      { kind: 'collect', places: ['market', 'plaza', 'marina'], text: 'Collect the cash drops (0/3)' },
    ],
  },
  {
    id: 'the-big-score',
    title: 'Job 5 — The Big Score',
    brief: 'Hit Solmar Trust Bank, grab the score, and escape to the Hideout with the whole city on you.',
    reward: 1000,
    wantedOnStart: 3,
    steps: [
      { kind: 'goto', place: 'bank', text: 'Reach Solmar Trust Bank' },
      { kind: 'goto', place: 'hideout', text: 'Escape to the Hideout — Pier 9' },
    ],
  },
];

export const STORY = {
  title: 'SOLMAR HEAT',
  tagline: 'One city. Five jobs. No brakes.',
  intro: 'You are Dario Vale, a wheelman new to Solmar — a sun-soaked port city of ' +
    'neon bars, night markets and crooked cops. Luz, the garage boss, has five jobs ' +
    'for you. Finish them all and the city is yours.',
  controls: [
    'WASD / Arrows — move on foot, drive in a car',
    'SHIFT — run on foot',
    'E — steal / enter a car, exit a car',
    'SPACE — shoot on foot, handbrake in a car',
    'P — pause    M — mute    R — restart after win / loss',
  ],
  tips: 'Stealing a car, hitting people or shooting raises your wanted stars. ' +
    'Police cars ram you — break contact for a while and the heat cools off. ' +
    'If a cop holds you for a moment, you are BUSTED.',
};
