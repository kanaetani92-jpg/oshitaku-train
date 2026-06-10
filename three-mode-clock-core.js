(function attachClockModeCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrainClockModeCore = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createClockModeCore() {
  'use strict';

  const DAY_MINUTES = 1440;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function stationCount(schedule) {
    return Array.isArray(schedule?.stations) ? schedule.stations.length : 0;
  }

  function effectiveBounds(schedule) {
    const stations = Array.isArray(schedule?.stations) ? schedule.stations : [];
    const first = stations[0];
    const last = stations.at(-1);
    const scheduleStart = Number(schedule?.startAbs);
    const scheduleEnd = Number(schedule?.endAbs);
    const firstStart = Number(first?.arriveAbs);
    const lastEnd = Number(last?.departAbs);

    const startAbs = Number.isFinite(firstStart)
      ? Math.min(Number.isFinite(scheduleStart) ? scheduleStart : firstStart, firstStart)
      : (Number.isFinite(scheduleStart) ? scheduleStart : 0);
    let endAbs = Number.isFinite(lastEnd)
      ? Math.max(Number.isFinite(scheduleEnd) ? scheduleEnd : lastEnd, lastEnd)
      : (Number.isFinite(scheduleEnd) ? scheduleEnd : startAbs);
    if (endAbs <= startAbs) endAbs = startAbs + 1;

    return {
      startAbs,
      endAbs,
      total: Math.max(1 / 60, endAbs - startAbs)
    };
  }

  function currentAbsoluteMinutes(schedule, now = new Date()) {
    const bounds = effectiveBounds(schedule);
    let current = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
    if (bounds.endAbs > DAY_MINUTES && current <= bounds.endAbs - DAY_MINUTES) {
      current += DAY_MINUTES;
    }
    return current;
  }

  function minutesToHHMM(value) {
    const normalized = ((Math.round(Number(value) || 0) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function snapshot(schedule, now = new Date()) {
    const count = stationCount(schedule);
    if (!count) {
      return {
        phase: 'ended',
        count: 0,
        nowAbs: 0,
        displayIndex: 0,
        activeIndex: -1,
        previousIndex: -1,
        nextIndex: -1,
        reachedIndex: -1,
        targetAbs: 0,
        remainingMs: 0,
        position: 1
      };
    }

    const stations = schedule.stations;
    const bounds = effectiveBounds(schedule);
    const { startAbs, endAbs, total } = bounds;
    const nowAbs = currentAbsoluteMinutes(schedule, now);

    if (nowAbs < startAbs) {
      return {
        phase: 'before',
        count,
        nowAbs,
        displayIndex: 0,
        activeIndex: -1,
        previousIndex: -1,
        nextIndex: 0,
        reachedIndex: -1,
        targetAbs: startAbs,
        remainingMs: Math.max(0, (startAbs - nowAbs) * 60000),
        position: 0
      };
    }

    if (nowAbs >= endAbs) {
      return {
        phase: 'ended',
        count,
        nowAbs,
        displayIndex: count - 1,
        activeIndex: -1,
        previousIndex: count - 1,
        nextIndex: -1,
        reachedIndex: count - 1,
        targetAbs: endAbs,
        remainingMs: 0,
        position: 1
      };
    }

    const activeIndex = stations.findIndex((station) => {
      const arrive = Number(station.arriveAbs);
      const depart = Number(station.departAbs);
      return Number.isFinite(arrive) && Number.isFinite(depart) && depart > arrive && nowAbs >= arrive && nowAbs < depart;
    });

    if (activeIndex >= 0) {
      const station = stations[activeIndex];
      return {
        phase: 'active',
        count,
        nowAbs,
        displayIndex: activeIndex,
        activeIndex,
        previousIndex: Math.max(-1, activeIndex - 1),
        nextIndex: activeIndex + 1 < count ? activeIndex + 1 : -1,
        reachedIndex: activeIndex,
        targetAbs: station.departAbs,
        remainingMs: Math.max(0, (station.departAbs - nowAbs) * 60000),
        position: clamp((nowAbs - startAbs) / total, 0, 1)
      };
    }

    const nextIndex = stations.findIndex((station) => Number(station.arriveAbs) > nowAbs);
    const safeNextIndex = nextIndex >= 0 ? nextIndex : count - 1;
    let previousIndex = -1;
    for (let index = 0; index < count; index += 1) {
      const marker = Number(stations[index].markerAbs);
      const arrive = Number(stations[index].arriveAbs);
      const comparison = Number.isFinite(marker) ? marker : arrive;
      if (Number.isFinite(comparison) && comparison <= nowAbs) previousIndex = index;
      else break;
    }

    return {
      phase: 'between',
      count,
      nowAbs,
      displayIndex: safeNextIndex,
      activeIndex: -1,
      previousIndex,
      nextIndex: safeNextIndex,
      reachedIndex: previousIndex,
      targetAbs: stations[safeNextIndex].arriveAbs,
      remainingMs: Math.max(0, (stations[safeNextIndex].arriveAbs - nowAbs) * 60000),
      position: clamp((nowAbs - startAbs) / total, 0, 1)
    };
  }

  return {
    DAY_MINUTES,
    clamp,
    stationCount,
    effectiveBounds,
    currentAbsoluteMinutes,
    minutesToHHMM,
    snapshot
  };
});
