(function attachThreeModeTime(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrainThreeModeTime = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createThreeModeTime() {
  'use strict';

  const DAY_MINUTES = 1440;
  const MODE_TYPES = Object.freeze({
    timer: 'duration',
    auto: 'duration',
    clock: 'clock'
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function nonNegativeMinutes(value, fallback = 0) {
    return Math.max(0, Math.round(finiteNumber(value, fallback)));
  }

  function positiveMinutes(value, fallback = 5) {
    return Math.max(1, nonNegativeMinutes(value, fallback));
  }

  function normalizeMode(value, fallback = 'timer') {
    const mode = String(value || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(MODE_TYPES, mode)) return mode;
    const fallbackMode = String(fallback || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(MODE_TYPES, fallbackMode) ? fallbackMode : 'timer';
  }

  function modeType(value, fallback = 'timer') {
    return MODE_TYPES[normalizeMode(value, fallback)];
  }

  function timeToMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function minutesToHHMM(value) {
    const normalized = ((Math.round(finiteNumber(value, 0)) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function normalizeStation(station, index, fallbackTime = '07:30') {
    const safe = station && typeof station === 'object' ? station : {};
    const fallbackName = index === 0 ? 'スタート' : '予定';
    const parsedArrive = timeToMinutes(safe.arrive);
    const parsedDepart = timeToMinutes(safe.depart);
    const arrive = parsedArrive === null ? fallbackTime : minutesToHHMM(parsedArrive);
    const depart = parsedDepart === null ? arrive : minutesToHHMM(parsedDepart);
    return {
      ...safe,
      name: String(safe.name || fallbackName),
      speakText: String(safe.speakText || safe.name || fallbackName),
      icon: String(safe.icon || (index === 0 ? '🏠' : '⭐')),
      intervalMin: index === 0 ? 0 : positiveMinutes(safe.intervalMin, 5),
      arrive,
      depart
    };
  }

  function ensureMinimumStations(stations) {
    const result = stations.map((station) => ({ ...station }));
    if (result.length >= 2) return result;

    if (!result.length) {
      result.push(normalizeStation({ name: 'スタート', icon: '🏠', intervalMin: 0, arrive: '07:30', depart: '07:30' }, 0));
    }

    const first = result[0];
    const base = timeToMinutes(first.depart) ?? timeToMinutes(first.arrive) ?? 450;
    result.push(normalizeStation({
      name: 'ゴール',
      speakText: 'ゴール',
      icon: '🏁',
      intervalMin: 5,
      arrive: minutesToHHMM(base + 5),
      depart: minutesToHHMM(base + 5)
    }, 1, first.depart || first.arrive || '07:30'));
    return result;
  }

  function buildDurationSchedule(inputStations) {
    const normalized = ensureMinimumStations(
      (Array.isArray(inputStations) ? inputStations : []).map((station, index) => normalizeStation(station, index))
    );
    let offset = 0;
    const stations = normalized.map((station, index) => {
      const durationBeforeMin = index === 0 ? 0 : positiveMinutes(station.intervalMin, 5);
      if (index > 0) offset += durationBeforeMin;
      return {
        ...station,
        durationBeforeMin,
        durationToNextMin: 0,
        arriveAbs: offset,
        departAbs: offset,
        markerAbs: offset,
        arriveOffset: offset,
        departOffset: offset,
        markerOffset: offset
      };
    });

    stations.forEach((station, index) => {
      const next = stations[index + 1];
      station.durationToNextMin = next ? Math.max(0, next.markerOffset - station.markerOffset) : 0;
    });

    const total = Math.max(1, stations.at(-1)?.markerOffset || 0);
    return {
      kind: 'duration',
      stations,
      startAbs: 0,
      endAbs: total,
      total
    };
  }

  function buildClockSchedule(inputStations) {
    const normalized = ensureMinimumStations(
      (Array.isArray(inputStations) ? inputStations : []).map((station, index) => normalizeStation(station, index))
    );

    let previousDepart = null;
    const stations = normalized.map((station, index) => {
      let arriveAbs = timeToMinutes(station.arrive);
      let departAbs = timeToMinutes(station.depart);
      if (arriveAbs === null) arriveAbs = index === 0 ? 450 : previousDepart ?? 450;
      if (departAbs === null) departAbs = arriveAbs;

      if (index === 0) {
        while (departAbs < arriveAbs) departAbs += DAY_MINUTES;
      } else {
        while (previousDepart !== null && arriveAbs < previousDepart) arriveAbs += DAY_MINUTES;
        while (departAbs < arriveAbs) departAbs += DAY_MINUTES;
      }
      previousDepart = departAbs;
      return { ...station, arriveAbs, departAbs };
    });

    const startAbs = stations[0]?.departAbs ?? 0;
    let endAbs = stations.at(-1)?.arriveAbs ?? startAbs + 1;
    if (endAbs <= startAbs) endAbs = startAbs + 1;
    const total = endAbs - startAbs;

    const withOffsets = stations.map((station, index) => {
      const markerAbs = index === 0 ? startAbs : station.arriveAbs;
      return {
        ...station,
        markerAbs,
        arriveOffset: Math.max(0, station.arriveAbs - startAbs),
        departOffset: Math.max(0, station.departAbs - startAbs),
        markerOffset: Math.max(0, markerAbs - startAbs),
        durationBeforeMin: index === 0 ? 0 : Math.max(0, markerAbs - (stations[index - 1]?.markerAbs ?? startAbs)),
        durationToNextMin: 0
      };
    });

    withOffsets.forEach((station, index) => {
      const next = withOffsets[index + 1];
      station.durationToNextMin = next ? Math.max(0, next.markerOffset - station.markerOffset) : 0;
    });

    return {
      kind: 'clock',
      stations: withOffsets,
      startAbs,
      endAbs,
      total
    };
  }

  function buildSchedule(mode, stations) {
    return modeType(mode) === 'clock' ? buildClockSchedule(stations) : buildDurationSchedule(stations);
  }

  function durationElapsedMs(options = {}) {
    const totalMs = Math.max(0, finiteNumber(options.totalMs, 0));
    const pausedElapsedMs = Math.max(0, finiteNumber(options.pausedElapsedMs, 0));
    const running = options.running === true;
    const startedAt = finiteNumber(options.startedAt, 0);
    const nowMs = finiteNumber(options.nowMs, Date.now());
    const elapsed = running && startedAt > 0
      ? pausedElapsedMs + Math.max(0, nowMs - startedAt)
      : pausedElapsedMs;
    return clamp(elapsed, 0, totalMs);
  }

  function autoElapsedMs(options = {}) {
    return durationElapsedMs({
      totalMs: options.totalMs,
      running: options.autoRunning,
      startedAt: options.autoStartedAt,
      pausedElapsedMs: options.autoPausedElapsedMs,
      nowMs: options.nowMs
    });
  }

  function clockNowAbsoluteMinutes(schedule, now = new Date()) {
    const current = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
    if (schedule.endAbs > DAY_MINUTES && current <= schedule.endAbs - DAY_MINUTES) return current + DAY_MINUTES;
    return current;
  }

  function clockElapsedMs(schedule, now = new Date()) {
    const totalMs = Math.max(0, schedule.total * 60000);
    const nowAbs = clockNowAbsoluteMinutes(schedule, now);
    return clamp((nowAbs - schedule.startAbs) * 60000, 0, totalMs);
  }

  function elapsedMsForMode(mode, schedule, runtime = {}, now = new Date()) {
    const normalizedMode = normalizeMode(mode);
    const totalMs = Math.max(0, schedule.total * 60000);
    if (normalizedMode === 'clock') return clockElapsedMs(schedule, now);
    if (normalizedMode === 'auto') {
      return autoElapsedMs({
        totalMs,
        autoRunning: runtime.autoRunning,
        autoStartedAt: runtime.autoStartedAt,
        autoPausedElapsedMs: runtime.autoPausedElapsedMs,
        nowMs: now instanceof Date ? now.getTime() : finiteNumber(now, Date.now())
      });
    }
    return durationElapsedMs({
      totalMs,
      running: runtime.running,
      startedAt: runtime.timerStartedAt,
      pausedElapsedMs: runtime.pausedElapsedMs,
      nowMs: now instanceof Date ? now.getTime() : finiteNumber(now, Date.now())
    });
  }

  function locateDuration(schedule, elapsedMin) {
    const stations = schedule.stations;
    if (!stations.length) return { pos: 0, status: 'empty', stationIndex: 0, nextIndex: 0, activeIndex: 0, nextAt: 0, nextType: 'goal' };
    if (elapsedMin <= 0) {
      const nextIndex = Math.min(1, stations.length - 1);
      return {
        pos: 0,
        status: 'waiting',
        stationIndex: 0,
        nextIndex,
        activeIndex: 0,
        nextAt: stations[nextIndex]?.markerOffset ?? 0,
        nextType: nextIndex > 0 ? 'arrive' : 'goal'
      };
    }

    for (let index = 0; index < stations.length - 1; index += 1) {
      const current = stations[index];
      const next = stations[index + 1];
      if (elapsedMin >= current.markerOffset && elapsedMin < next.markerOffset) {
        const span = Math.max(1 / 60, next.markerOffset - current.markerOffset);
        const ratio = clamp((elapsedMin - current.markerOffset) / span, 0, 1);
        const from = clamp(current.markerOffset / schedule.total, 0, 1);
        const to = clamp(next.markerOffset / schedule.total, 0, 1);
        return {
          pos: from + (to - from) * ratio,
          status: 'run',
          stationIndex: index,
          nextIndex: index + 1,
          activeIndex: index + 1,
          nextAt: next.markerOffset,
          nextType: 'arrive'
        };
      }
    }

    const lastIndex = stations.length - 1;
    return { pos: 1, status: 'goal', stationIndex: lastIndex, nextIndex: lastIndex, activeIndex: lastIndex, nextAt: schedule.total, nextType: 'goal' };
  }

  function locateClock(schedule, elapsedMin) {
    const stations = schedule.stations;
    if (!stations.length) return { pos: 0, status: 'empty', stationIndex: 0, nextIndex: 0, activeIndex: 0, nextAt: schedule.startAbs, nextType: 'goal' };
    const absolute = schedule.startAbs + elapsedMin;
    if (absolute <= schedule.startAbs) {
      return { pos: 0, status: 'waiting', stationIndex: 0, nextIndex: 0, activeIndex: 0, nextAt: schedule.startAbs, nextType: 'depart' };
    }

    for (let index = 0; index < stations.length; index += 1) {
      const current = stations[index];
      const marker = current.markerAbs;
      const depart = index === stations.length - 1 ? current.arriveAbs : current.departAbs;
      if (absolute >= marker && absolute < depart) {
        return {
          pos: clamp((marker - schedule.startAbs) / schedule.total, 0, 1),
          status: 'stop',
          stationIndex: index,
          nextIndex: index,
          activeIndex: index,
          nextAt: depart,
          nextType: 'depart'
        };
      }
      const next = stations[index + 1];
      if (next && absolute >= depart && absolute < next.arriveAbs) {
        const span = Math.max(1 / 60, next.arriveAbs - depart);
        const ratio = clamp((absolute - depart) / span, 0, 1);
        const from = clamp((marker - schedule.startAbs) / schedule.total, 0, 1);
        const to = clamp((next.markerAbs - schedule.startAbs) / schedule.total, 0, 1);
        return {
          pos: from + (to - from) * ratio,
          status: 'run',
          stationIndex: index,
          nextIndex: index + 1,
          activeIndex: index + 1,
          nextAt: next.arriveAbs,
          nextType: 'arrive'
        };
      }
    }

    const lastIndex = stations.length - 1;
    return { pos: 1, status: 'goal', stationIndex: lastIndex, nextIndex: lastIndex, activeIndex: lastIndex, nextAt: schedule.endAbs, nextType: 'goal' };
  }

  function locate(mode, schedule, elapsedMin) {
    return modeType(mode) === 'clock' ? locateClock(schedule, elapsedMin) : locateDuration(schedule, elapsedMin);
  }

  function progressSnapshot(mode, stations, runtime = {}, now = new Date()) {
    const normalizedMode = normalizeMode(mode);
    const schedule = buildSchedule(normalizedMode, stations);
    const elapsedMs = elapsedMsForMode(normalizedMode, schedule, runtime, now);
    const elapsedMin = elapsedMs / 60000;
    const vehicle = locate(normalizedMode, schedule, elapsedMin);
    const percent = clamp(elapsedMin / schedule.total, 0, 1);
    const reachedIndex = Math.max(0, schedule.stations.findLastIndex((station) => station.markerOffset <= elapsedMin + 1 / 120));
    return {
      mode: normalizedMode,
      kind: modeType(normalizedMode),
      schedule,
      elapsedMs,
      elapsedMin,
      percent,
      vehicle,
      reachedIndex
    };
  }

  return {
    DAY_MINUTES,
    MODE_TYPES,
    clamp,
    normalizeMode,
    modeType,
    timeToMinutes,
    minutesToHHMM,
    buildDurationSchedule,
    buildClockSchedule,
    buildSchedule,
    durationElapsedMs,
    autoElapsedMs,
    clockNowAbsoluteMinutes,
    clockElapsedMs,
    elapsedMsForMode,
    locateDuration,
    locateClock,
    locate,
    progressSnapshot
  };
});
