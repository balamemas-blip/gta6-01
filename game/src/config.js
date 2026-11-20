// Solmar Heat — configuration and tuning.
// One place for every number the game balances on, so tuning never
// means hunting through gameplay code.

export const CONFIG = {
  canvas: { width: 1280, height: 720 },
  world: {
    width: 2400,
    height: 1800,
    block: 230, // size of one city block (building + sidewalk)
    road: 90, // width of the roads between blocks
    beachHeight: 130, // sand strip along the south edge
  },
  player: {
    walkSpeed: 170,
    runSpeed: 265,
    hp: 100,
    hpRegenPerSec: 3,
    regenDelaySec: 5,
    radius: 13,
  },
  car: {
    accel: 420,
    brake: 620,
    reverseAccel: 260,
    topSpeed: 430,
    topReverse: 150,
    steerRate: 2.6,
    grip: 0.94,
    length: 46,
    width: 22,
  },
  cop: {
    topSpeed: 385, // deliberately below the player's top speed: escape is possible
    accel: 380,
    ramDamage: 4,
    ramCooldownSec: 1.6,
    bustHoldSec: 2.5,
    bustRadius: 46,
    maxActive: 5,
  },
  wanted: {
    decayPerSec: 0.12, // wanted cools off slowly when no crime is seen
    crimeRadius: 420, // crimes closer than this to a cop raise wanted
  },
  traffic: { cars: 14, pedestrians: 26 },
  camera: { lerp: 6.5 },
  minimap: { size: 168, margin: 14 },
  saveKey: 'solmar-heat-save-v1',
};

export const CITY_NAMES = {
  city: 'Solmar',
  garage: "Delgado's Garage",
  boss: 'Rosa Delgado',
  player: 'Danny Reyes',
  crew: 'Milo',
  bank: 'Solmar First Bank',
  docks: 'Old Docks',
  safehouse: 'Palm Court Safehouse',
};

export const PALETTE = {
  grass: '#7fb069',
  sand: '#ecd9a0',
  sea: '#2e86ab',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#b8b0a0',
  buildingRoof: ['#c96f4a', '#5b7fa6', '#8e6fb8', '#4a9e7f', '#b8a05b', '#a65b6e'],
  park: '#5da271',
  carColors: ['#d64545', '#3f7fbf', '#e8b93c', '#e8e8e8', '#2f2f38', '#7fbf3f', '#bf5fd6'],
  hud: '#101820',
};
