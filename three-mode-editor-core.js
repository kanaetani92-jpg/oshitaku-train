(function attachStage8EditorCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrainStage8EditorCore = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStage8EditorCore() {
  'use strict';

  const MODES = Object.freeze(['timer', 'auto', 'clock']);
  const MODE_ALIASES = Object.freeze({
    timer:'timer', manual:'timer', done:'timer',
    auto:'auto', automatic:'auto', schedule:'auto',
    clock:'clock', today:'clock', realtime:'clock'
  });

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function normalizeMode(value, fallback = 'timer') {
    const normalized = MODE_ALIASES[String(value || '').toLowerCase()];
    if (MODES.includes(normalized)) return normalized;
    const fallbackMode = MODE_ALIASES[String(fallback || '').toLowerCase()];
    return MODES.includes(fallbackMode) ? fallbackMode : 'timer';
  }

  function nonNegativeMinutes(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return Math.max(0, Math.round(Number(fallback) || 0));
    return Math.max(0, Math.round(number));
  }

  function validHHMM(value, fallback = '07:30') {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return validHHMM(fallback, '07:30');
    const hours = Math.min(23, Math.max(0, Number(match[1]) || 0));
    const minutes = Math.min(59, Math.max(0, Number(match[2]) || 0));
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function normalizeStation(station, index = 0, activeMode = 'timer') {
    const source = station && typeof station === 'object' ? station : {};
    const legacyDuration = index === 0 ? 0 : nonNegativeMinutes(source.intervalMin ?? source.minute, 5);
    const timerIntervalMin = index === 0
      ? 0
      : nonNegativeMinutes(source.timerIntervalMin ?? source.timerMinutes, legacyDuration || 5);
    const autoIntervalMin = index === 0
      ? 0
      : nonNegativeMinutes(source.autoIntervalMin ?? source.autoMinutes, legacyDuration || timerIntervalMin || 5);
    const clockStart = validHHMM(source.clockStart ?? source.arrive, '07:30');
    const clockEnd = validHHMM(source.clockEnd ?? source.depart, clockStart);
    const mode = normalizeMode(activeMode, 'timer');

    let intervalMin = legacyDuration;
    if (mode === 'timer') intervalMin = timerIntervalMin;
    if (mode === 'auto') intervalMin = autoIntervalMin;
    if (index === 0) intervalMin = 0;

    return {
      ...source,
      intervalMin,
      timerIntervalMin,
      autoIntervalMin,
      clockStart,
      clockEnd,
      arrive:clockStart,
      depart:clockEnd
    };
  }

  function normalizeStations(stations, activeMode = 'timer') {
    const list = Array.isArray(stations) ? stations : [];
    return list.map((station, index) => normalizeStation(station, index, activeMode));
  }

  function captureModeData(stations, mode) {
    const normalizedMode = normalizeMode(mode, 'timer');
    return normalizeStations(stations, normalizedMode).map((station, index) => {
      if (normalizedMode === 'timer') {
        return {
          ...station,
          timerIntervalMin:index === 0 ? 0 : nonNegativeMinutes(station.intervalMin, station.timerIntervalMin)
        };
      }
      if (normalizedMode === 'auto') {
        return {
          ...station,
          autoIntervalMin:index === 0 ? 0 : nonNegativeMinutes(station.intervalMin, station.autoIntervalMin)
        };
      }
      return {
        ...station,
        clockStart:validHHMM(station.arrive, station.clockStart),
        clockEnd:validHHMM(station.depart, station.clockEnd)
      };
    });
  }

  function applyModeData(stations, mode) {
    const normalizedMode = normalizeMode(mode, 'timer');
    return normalizeStations(stations, normalizedMode).map((station, index) => {
      if (normalizedMode === 'timer') {
        return {
          ...station,
          intervalMin:index === 0 ? 0 : station.timerIntervalMin
        };
      }
      if (normalizedMode === 'auto') {
        return {
          ...station,
          intervalMin:index === 0 ? 0 : station.autoIntervalMin
        };
      }
      return {
        ...station,
        arrive:station.clockStart,
        depart:station.clockEnd
      };
    });
  }

  function switchModeData(stations, previousMode, nextMode) {
    const captured = captureModeData(stations, previousMode);
    return applyModeData(captured, nextMode);
  }

  function normalizePreset(preset, fallbackMode = 'timer') {
    if (!preset || typeof preset !== 'object') return preset;
    const defaultMode = normalizeMode(preset.defaultMode ?? preset.mode, fallbackMode);
    return {
      ...preset,
      defaultMode,
      stations:normalizeStations(preset.stations, defaultMode)
    };
  }

  function normalizeTodo(todo, fallbackMode = 'timer') {
    if (!todo || typeof todo !== 'object') return todo;
    return {
      ...todo,
      defaultMode:normalizeMode(todo.defaultMode ?? todo.mode, fallbackMode)
    };
  }

  function prepareState(currentState) {
    const state = clone(currentState) || {};
    const requestedMode = normalizeMode(state.requestedMode ?? state.mode, 'timer');
    state.requestedMode = requestedMode;
    state.mode = requestedMode === 'auto' ? 'timer' : requestedMode;
    state.stations = normalizeStations(state.stations, requestedMode);
    state.presets = (Array.isArray(state.presets) ? state.presets : [])
      .map((preset) => normalizePreset(preset, 'timer'))
      .filter(Boolean);
    state.todos = (Array.isArray(state.todos) ? state.todos : [])
      .map((todo) => normalizeTodo(todo, requestedMode))
      .filter(Boolean);
    return state;
  }

  return {
    modes:MODES,
    clone,
    normalizeMode,
    nonNegativeMinutes,
    validHHMM,
    normalizeStation,
    normalizeStations,
    captureModeData,
    applyModeData,
    switchModeData,
    normalizePreset,
    normalizeTodo,
    prepareState
  };
});
