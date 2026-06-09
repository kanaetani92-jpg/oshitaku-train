(function attachAutoTimerCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrainAutoTimerCore = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAutoTimerCore() {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function totalMs(schedule) {
    return Math.max(0, (Number(schedule?.total) || 0) * 60000);
  }

  function stationCount(schedule) {
    return Array.isArray(schedule?.stations) ? schedule.stations.length : 0;
  }

  function elapsedMs(runtime = {}, nowMs = Date.now(), maximumMs = Infinity) {
    const paused = Math.max(0, Number(runtime.autoPausedElapsedMs) || 0);
    const startedAt = Number(runtime.autoStartedAt) || 0;
    const elapsed = runtime.autoRunning === true && startedAt > 0
      ? paused + Math.max(0, Number(nowMs) - startedAt)
      : paused;
    return clamp(elapsed, 0, Math.max(0, Number(maximumMs) || 0));
  }

  function markerMs(schedule, index) {
    const count = stationCount(schedule);
    if (!count) return 0;
    const safeIndex = clamp(index, 0, count - 1);
    const marker = Number(schedule.stations[safeIndex]?.markerOffset);
    return Math.max(0, Number.isFinite(marker) ? marker * 60000 : 0);
  }

  function snapshot(schedule, elapsedValueMs) {
    const count = stationCount(schedule);
    const maximumMs = totalMs(schedule);
    const safeElapsedMs = clamp(elapsedValueMs, 0, maximumMs);
    const completed = count === 0 || safeElapsedMs >= maximumMs;

    if (!count) {
      return {
        completed: true,
        count: 0,
        elapsedMs: 0,
        currentIndex: 0,
        nextIndex: 0,
        doneUntilIndex: -1,
        currentStartMs: 0,
        nextBoundaryMs: 0,
        durationMs: 0,
        segmentElapsedMs: 0,
        remainingMs: 0,
        positionCount: 0
      };
    }

    let currentIndex = 0;
    for (let index = 0; index < count; index += 1) {
      if (markerMs(schedule, index) <= safeElapsedMs + 1) currentIndex = index;
      else break;
    }

    if (completed) currentIndex = count - 1;
    const nextIndex = completed ? currentIndex : Math.min(currentIndex + 1, count - 1);
    const currentStartMs = markerMs(schedule, currentIndex);
    const nextBoundaryMs = completed ? maximumMs : markerMs(schedule, nextIndex);
    const durationMs = Math.max(0, nextBoundaryMs - currentStartMs);
    const segmentElapsedMs = Math.max(0, safeElapsedMs - currentStartMs);
    const remainingMs = completed ? 0 : Math.max(0, nextBoundaryMs - safeElapsedMs);

    return {
      completed,
      count,
      elapsedMs: safeElapsedMs,
      currentIndex,
      nextIndex,
      doneUntilIndex: completed ? count - 1 : currentIndex - 1,
      currentStartMs,
      nextBoundaryMs,
      durationMs,
      segmentElapsedMs,
      remainingMs,
      positionCount: completed ? count : currentIndex + 1
    };
  }

  function start(schedule, runtime = {}, nowMs = Date.now()) {
    const maximumMs = totalMs(schedule);
    let paused = elapsedMs(runtime, nowMs, maximumMs);
    if (paused >= maximumMs) paused = 0;
    return {
      autoRunning: maximumMs > 0,
      autoStartedAt: maximumMs > 0 ? Number(nowMs) : null,
      autoPausedElapsedMs: paused,
      completed: maximumMs <= 0
    };
  }

  function pause(schedule, runtime = {}, nowMs = Date.now()) {
    const maximumMs = totalMs(schedule);
    const paused = elapsedMs(runtime, nowMs, maximumMs);
    return {
      autoRunning: false,
      autoStartedAt: null,
      autoPausedElapsedMs: paused,
      completed: paused >= maximumMs
    };
  }

  function reset() {
    return {
      autoRunning: false,
      autoStartedAt: null,
      autoPausedElapsedMs: 0,
      completed: false
    };
  }

  function finish(schedule) {
    return {
      autoRunning: false,
      autoStartedAt: null,
      autoPausedElapsedMs: totalMs(schedule),
      completed: true
    };
  }

  return {
    clamp,
    totalMs,
    stationCount,
    elapsedMs,
    markerMs,
    snapshot,
    start,
    pause,
    reset,
    finish
  };
});
