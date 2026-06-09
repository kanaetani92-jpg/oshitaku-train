(function attachDoneTimerCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrainDoneTimerCore = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createDoneTimerCore() {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function stationCount(schedule) {
    return Array.isArray(schedule?.stations) ? schedule.stations.length : 0;
  }

  function activeIndex(schedule, doneUntilIndex) {
    const count = stationCount(schedule);
    if (!count) return 0;
    return clamp((Number.isInteger(doneUntilIndex) ? doneUntilIndex : -1) + 1, 0, count - 1);
  }

  function allDone(schedule, doneUntilIndex) {
    const count = stationCount(schedule);
    return count === 0 || Number(doneUntilIndex) >= count - 1;
  }

  function markerMs(schedule, index) {
    const count = stationCount(schedule);
    if (!count) return 0;
    const safeIndex = clamp(index, 0, count - 1);
    const markerMin = Number(schedule.stations[safeIndex]?.markerOffset);
    return Math.max(0, Number.isFinite(markerMin) ? markerMin * 60000 : 0);
  }

  function totalMs(schedule) {
    return Math.max(0, (Number(schedule?.total) || 0) * 60000);
  }

  function taskTiming(schedule, doneUntilIndex, elapsedMs) {
    const count = stationCount(schedule);
    const currentIndex = activeIndex(schedule, doneUntilIndex);
    const completed = allDone(schedule, doneUntilIndex);
    const isLast = count > 0 && currentIndex >= count - 1;
    const startMs = markerMs(schedule, currentIndex);
    const nextIndex = isLast ? currentIndex : currentIndex + 1;
    const dueMs = isLast ? totalMs(schedule) : markerMs(schedule, nextIndex);
    const safeElapsedMs = clamp(elapsedMs, 0, totalMs(schedule));
    const durationMs = Math.max(0, dueMs - startMs);
    const taskElapsedMs = Math.max(0, safeElapsedMs - startMs);
    const remainingMs = isLast || completed ? 0 : Math.max(0, dueMs - safeElapsedMs);

    return {
      count,
      currentIndex,
      nextIndex,
      completed,
      isLast,
      startMs,
      dueMs,
      durationMs,
      taskElapsedMs,
      remainingMs,
      overdue: !completed && !isLast && safeElapsedMs >= dueMs
    };
  }

  function completeCurrent(schedule, runtime = {}) {
    const count = stationCount(schedule);
    if (!count) {
      return {
        changed: false,
        completed: true,
        activeIndex: 0,
        doneUntilIndex: -1,
        elapsedMs: 0,
        running: false,
        timerStartedAt: null,
        pausedByLate: false
      };
    }

    const currentIndex = activeIndex(schedule, runtime.doneUntilIndex);
    if (allDone(schedule, runtime.doneUntilIndex)) {
      return {
        ...runtime,
        changed: false,
        completed: true,
        activeIndex: currentIndex,
        doneUntilIndex: count - 1,
        elapsedMs: totalMs(schedule),
        running: false,
        timerStartedAt: null,
        pausedByLate: false
      };
    }

    const nextDoneUntilIndex = currentIndex;
    const completed = nextDoneUntilIndex >= count - 1;
    const keepRunning = !completed && (runtime.running === true || runtime.pausedByLate === true);
    const elapsedMs = completed
      ? totalMs(schedule)
      : markerMs(schedule, currentIndex + 1);

    return {
      ...runtime,
      changed: true,
      completed,
      activeIndex: currentIndex,
      nextActiveIndex: completed ? currentIndex : currentIndex + 1,
      doneUntilIndex: nextDoneUntilIndex,
      elapsedMs,
      running: keepRunning,
      timerStartedAt: keepRunning ? Number(runtime.nowMs) || Date.now() : null,
      pausedByLate: false
    };
  }

  return {
    clamp,
    stationCount,
    activeIndex,
    allDone,
    markerMs,
    totalMs,
    taskTiming,
    completeCurrent
  };
});
