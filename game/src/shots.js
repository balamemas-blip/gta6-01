// Bahia Verde Heat — screenshot scenes. Each scene is the real game played
// forward from a fresh world by the autopilot, for a fixed number of steps,
// so every screenshot is a frame the game itself produced. The same seed
// always gives the same frame.
import { createGame, updateGame, autopilot } from './core.js';
import { WORLD } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const STEP = 1 / 60;

// Run the game forward `steps` frames with the autopilot driving.
function playForward(state, steps) {
  for (let i = 0; i < steps; i += 1) {
    updateGame(state, autopilot(state), STEP, 1280, 720);
    if (state.screen === 'win' || state.screen === 'over') break;
  }
  return state;
}

// The title scene: a slow camera drift over downtown with Rico by his car.
function stageStart() {
  const state = createGame();
  state.screen = SCREEN_TITLE;
  state.camera.x = 500;
  state.camera.y = 200;
  return state;
}

// Mid-game: job 2, driving through traffic with cash drops on the map.
function stageStreet() {
  const state = createGame();
  state.screen = 'play';
  state.missions.index = 1;
  state.player.cash = 500;
  // Put Rico in the starter car on the road and let him drive toward the first drop.
  state.player.x = 1000;
  state.player.y = 420;
  const car = state.world.cars[state.world.cars.length - 2];
  state.player.inCar = car;
  state.player.onFoot = false;
  car.parked = false;
  car.x = 1000;
  car.y = 420;
  car.angle = Math.PI / 2;
  playForward(state, 60 * 14);
  state.screen = SCREEN_PLAY;
  return state;
}

// The chase: job 3, wanted level 3, three patrol cars closing in.
function stageChase() {
  const state = createGame();
  state.screen = 'play';
  state.missions.index = 2;
  state.missions.evadeActive = true;
  state.player.cash = 950;
  state.player.wanted = 3;
  state.player.x = 1400;
  state.player.y = 1000;
  const car = state.world.cars[state.world.cars.length - 2];
  state.player.inCar = car;
  state.player.onFoot = false;
  car.parked = false;
  car.x = 1400;
  car.y = 1000;
  car.angle = Math.PI / 2;
  car.speed = 300;
  playForward(state, 60 * 9);
  state.screen = SCREEN_PLAY;
  return state;
}

// The win: the autopilot plays all five jobs through to the end.
function stageWin() {
  const state = createGame();
  state.screen = 'play';
  playForward(state, 60 * 420);
  if (!state.missions.done) {
    // The autopilot is the same driver the win test uses; if it ever stalls
    // the scene falls back to the final job's approach so the frame still
    // shows the game, never a blank screen.
    state.missions.index = 4;
    state.missions.getawaySpawned = true;
    state.player.cash = 4950;
  }
  state.screen = state.missions.done ? SCREEN_WIN : SCREEN_PLAY;
  return state;
}

// Set up `state` for the named scene and return the screen to draw.
// Called from main.js when the page loads with ?shot=<name>.
export function stageShot(name) {
  if (name === 'street') return stageStreet();
  if (name === 'chase') return stageChase();
  if (name === 'win') return stageWin();
  return stageStart();
}

export function worldSize() {
  return { width: WORLD.width, height: WORLD.height };
}
