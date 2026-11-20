// Solmar Heat — missions: the five-job story chain. A mission is a list of
// steps; each step completes on an event (steal a car, reach a place,
// survive N seconds, collect every cash drop). The module owns the
// mission index, the current step, timers and the objective text.

import { MISSIONS, PLACES } from './config.js';
import { dist } from './random.js';

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    stepTimer: 0, // counts down for 'survive' steps
    collected: 0,
    done: false,
    banner: '', // short toast shown when a step completes
    bannerTimer: 0,
  };
}

export function currentMission(ms) {
  return MISSIONS[ms.index] || null;
}

export function currentStep(ms) {
  const m = currentMission(ms);
  return m ? m.steps[ms.step] : null;
}

export function startMission(ms, index) {
  ms.index = index;
  ms.step = 0;
  ms.stepTimer = 0;
  ms.collected = 0;
  ms.collectedFlags = {};
  ms.done = false;
  const m = currentMission(ms);
  if (m && m.steps[0].kind === 'survive') ms.stepTimer = m.steps[0].seconds;
  return m;
}

// The marker the HUD arrow and minimap point at, or null.
export function missionTarget(ms) {
  const step = currentStep(ms);
  if (!step) return null;
  if (step.kind === 'goto') return PLACES[step.place];
  if (step.kind === 'collect') {
    // The first drop not yet collected — drops may be grabbed in any
    // order, so this must skip collected ones instead of assuming the
    // next one in list order (a player leaving the Hideout passes the
    // Marina drop first and would otherwise soft-lock the mission).
    for (let i = 0; i < step.places.length; i++) {
      if (!ms.collectedFlags || !ms.collectedFlags[i]) return PLACES[step.places[i]];
    }
    return null;
  }
  return null;
}

export function objectiveText(ms) {
  const m = currentMission(ms);
  if (!m) return '';
  const step = currentStep(ms);
  if (!step) return m.title;
  if (step.kind === 'stealCar') return 'Steal a car — walk up to one and press E';
  if (step.kind === 'survive') return `Outrun the police — survive ${Math.ceil(ms.stepTimer)}s`;
  if (step.kind === 'collect') {
    return `Collect the cash drops (${ms.collected}/${step.places.length})`;
  }
  return step.text || m.title;
}

function advance(ms) {
  const m = currentMission(ms);
  ms.step++;
  ms.bannerTimer = 2.4;
  if (ms.step >= m.steps.length) {
    ms.done = true;
    ms.banner = `${m.title} — COMPLETE! +$${m.reward}`;
    return 'missionDone';
  }
  const next = currentStep(ms);
  if (next.kind === 'survive') ms.stepTimer = next.seconds;
  ms.banner = 'Next: ' + objectiveText(ms);
  return 'stepDone';
}

// Called every frame while playing. Events: { stoleCar, playerPos, dt }.
// Returns 'missionDone' | 'stepDone' | null.
export function updateMissions(ms, events) {
  const m = currentMission(ms);
  if (!m || ms.done) return null;
  const step = currentStep(ms);
  if (ms.bannerTimer > 0) ms.bannerTimer -= events.dt;
  if (step.kind === 'stealCar') {
    if (events.stoleCar) return advance(ms);
    return null;
  }
  if (step.kind === 'survive') {
    ms.stepTimer -= events.dt;
    if (ms.stepTimer <= 0) return advance(ms);
    return null;
  }
  if (step.kind === 'goto') {
    const place = PLACES[step.place];
    if (dist(events.playerPos.x, events.playerPos.y, place.x, place.y) < 64) {
      return advance(ms);
    }
    return null;
  }
  if (step.kind === 'collect') {
    for (let i = 0; i < step.places.length; i++) {
      if (ms.collectedFlags && ms.collectedFlags[i]) continue;
      const place = PLACES[step.places[i]];
      if (dist(events.playerPos.x, events.playerPos.y, place.x, place.y) < 56) {
        if (!ms.collectedFlags) ms.collectedFlags = {};
        ms.collectedFlags[i] = true;
        ms.collected++;
        if (ms.collected >= step.places.length) return advance(ms);
        ms.banner = `Cash drop ${ms.collected}/${step.places.length} collected!`;
        ms.bannerTimer = 2.0;
        return 'stepDone';
      }
    }
    return null;
  }
  return null;
}

// Cash-drop markers for the 'collect' step (positions of uncollected drops).
export function collectMarkers(ms) {
  const step = currentStep(ms);
  if (!step || step.kind !== 'collect') return [];
  return step.places
    .map((name, i) => ({ place: PLACES[name], taken: !!(ms.collectedFlags && ms.collectedFlags[i]) }))
    .filter((m) => !m.taken);
}
