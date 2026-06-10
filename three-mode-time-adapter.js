(() => {
  'use strict';

  const engine = window.TrainThreeModeTime;
  if (!engine || typeof state === 'undefined') {
    console.warn('共通時間計算をアプリへ接続できませんでした。');
    return;
  }

  if (
    typeof normalizedTimerSchedule !== 'function' ||
    typeof normalizedClockSchedule !== 'function' ||
    typeof normalizedSchedule !== 'function' ||
    typeof getElapsedMs !== 'function'
  ) {
    console.warn('既存の時間計算関数が見つからないため、共通時間計算を有効化しませんでした。');
    return;
  }

  const legacy = {
    normalizedTimerSchedule,
    normalizedClockSchedule,
    normalizedSchedule,
    getElapsedMs
  };

  const diagnostics = {
    timerEquivalent: false,
    clockEquivalent: false,
    timerEnabled: false,
    clockEnabled: false,
    elapsedEnabled: false,
    errors: []
  };

  function migratedStations() {
    return typeof migrateStations === 'function'
      ? migrateStations(state.stations, '07:30')
      : (Array.isArray(state.stations) ? state.stations : []);
  }

  function engineTimerSchedule() {
    return engine.buildDurationSchedule(migratedStations());
  }

  function engineClockSchedule() {
    return engine.buildClockSchedule(migratedStations());
  }

  function nearlyEqual(left, right, tolerance = 1 / 60000) {
    return Math.abs(Number(left) - Number(right)) <= tolerance;
  }

  function scheduleEquivalent(left, right) {
    if (!left || !right) return false;
    if (!nearlyEqual(left.startAbs, right.startAbs)) return false;
    if (!nearlyEqual(left.endAbs, right.endAbs)) return false;
    if (!nearlyEqual(left.total, right.total)) return false;
    if (!Array.isArray(left.stations) || !Array.isArray(right.stations)) return false;
    if (left.stations.length !== right.stations.length) return false;

    return left.stations.every((station, index) => {
      const other = right.stations[index];
      return Boolean(other) &&
        String(station.name || '') === String(other.name || '') &&
        nearlyEqual(station.markerOffset, other.markerOffset) &&
        nearlyEqual(station.arriveOffset, other.arriveOffset) &&
        nearlyEqual(station.departOffset, other.departOffset);
    });
  }

  function verifySchedule(kind) {
    try {
      const legacySchedule = kind === 'clock'
        ? legacy.normalizedClockSchedule()
        : legacy.normalizedTimerSchedule();
      const sharedSchedule = kind === 'clock'
        ? engineClockSchedule()
        : engineTimerSchedule();
      return scheduleEquivalent(legacySchedule, sharedSchedule);
    } catch (error) {
      diagnostics.errors.push(`${kind}: ${error?.message || String(error)}`);
      console.warn(`${kind}の時間計算を比較できませんでした。`, error);
      return false;
    }
  }

  function loadStylesheetOnce(href, marker) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`link[${marker}]`);
      if (existing) {
        resolve(existing);
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute(marker, 'true');
      link.addEventListener('load', () => resolve(link), { once:true });
      link.addEventListener('error', reject, { once:true });
      document.head.appendChild(link);
    });
  }

  function loadScriptOnce(src, marker) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[${marker}]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve(existing);
          return;
        }
        existing.addEventListener('load', () => resolve(existing), { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.setAttribute(marker, 'true');
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve(script);
      }, { once:true });
      script.addEventListener('error', reject, { once:true });
      document.head.appendChild(script);
    });
  }

  async function loadModeRuntimeModules() {
    try {
      await loadScriptOnce('three-mode-timer-core.js', 'data-done-timer-core');
      await loadScriptOnce('three-mode-done-timer.js', 'data-done-timer-ui');
      await loadScriptOnce('three-mode-auto-core.js', 'data-auto-timer-core');
      await loadScriptOnce('three-mode-auto-timer.js', 'data-auto-timer-ui');
      await loadScriptOnce('three-mode-clock-core.js', 'data-clock-mode-core');
      await loadScriptOnce('three-mode-clock-mode.js', 'data-clock-mode-ui');
      await loadScriptOnce('three-mode-clock-editor.js', 'data-clock-mode-editor');

      // 第9段階は各モードの表示処理が利用可能になったあとに読み込み、
      // 最後に描画コーディネーターへ接続します。
      await loadStylesheetOnce('three-mode-regression.css', 'data-three-mode-regression-style');
      await loadScriptOnce('three-mode-regression-core.js', 'data-three-mode-regression-core');
      await loadScriptOnce('three-mode-regression-ui.js', 'data-three-mode-regression-ui');
      await loadScriptOnce('three-mode-auto-render.js', 'data-three-mode-render-coordinator');
    } catch (error) {
      console.error('3モードの追加処理を読み込めませんでした。読み込み済みの従来処理を継続します。', error);
    }
  }

  diagnostics.timerEquivalent = verifySchedule('timer');
  diagnostics.clockEquivalent = verifySchedule('clock');

  normalizedTimerSchedule = function normalizedTimerScheduleFromSharedEngine() {
    if (!diagnostics.timerEquivalent) return legacy.normalizedTimerSchedule();
    try {
      return engineTimerSchedule();
    } catch (error) {
      diagnostics.errors.push(`timer-runtime: ${error?.message || String(error)}`);
      console.warn('所要時間型の共通計算に失敗したため、従来計算へ戻します。', error);
      return legacy.normalizedTimerSchedule();
    }
  };

  normalizedClockSchedule = function normalizedClockScheduleFromSharedEngine() {
    if (!diagnostics.clockEquivalent) return legacy.normalizedClockSchedule();
    try {
      return engineClockSchedule();
    } catch (error) {
      diagnostics.errors.push(`clock-runtime: ${error?.message || String(error)}`);
      console.warn('実時刻型の共通計算に失敗したため、従来計算へ戻します。', error);
      return legacy.normalizedClockSchedule();
    }
  };

  normalizedSchedule = function normalizedScheduleFromSharedEngine() {
    return state.mode === 'clock'
      ? normalizedClockSchedule()
      : normalizedTimerSchedule();
  };

  getElapsedMs = function getElapsedMsFromSharedEngine() {
    try {
      const schedule = normalizedSchedule();
      return engine.elapsedMsForMode(state.mode, schedule, {
        running: state.running,
        timerStartedAt: state.timerStartedAt,
        pausedElapsedMs: state.pausedElapsedMs,
        autoRunning: state.autoRunning,
        autoStartedAt: state.autoStartedAt,
        autoPausedElapsedMs: state.autoPausedElapsedMs
      }, new Date());
    } catch (error) {
      diagnostics.errors.push(`elapsed-runtime: ${error?.message || String(error)}`);
      console.warn('共通の経過時間計算に失敗したため、従来計算へ戻します。', error);
      return legacy.getElapsedMs();
    }
  };

  diagnostics.timerEnabled = diagnostics.timerEquivalent;
  diagnostics.clockEnabled = diagnostics.clockEquivalent;
  diagnostics.elapsedEnabled = diagnostics.timerEquivalent && diagnostics.clockEquivalent;

  window.TrainThreeModeTimeAdapter = Object.freeze({
    enabled: diagnostics.timerEnabled || diagnostics.clockEnabled,
    diagnostics: Object.freeze({ ...diagnostics, errors: Object.freeze([...diagnostics.errors]) }),
    buildSchedule(mode = state.requestedMode ?? state.mode) {
      return engine.buildSchedule(mode, migratedStations());
    },
    progressSnapshot(mode = state.requestedMode ?? state.mode, now = new Date()) {
      return engine.progressSnapshot(mode, migratedStations(), {
        running: state.running,
        timerStartedAt: state.timerStartedAt,
        pausedElapsedMs: state.pausedElapsedMs,
        autoRunning: state.autoRunning,
        autoStartedAt: state.autoStartedAt,
        autoPausedElapsedMs: state.autoPausedElapsedMs
      }, now);
    }
  });

  if (!diagnostics.timerEquivalent || !diagnostics.clockEquivalent) {
    console.warn('共通時間計算と従来計算の一部に差があったため、該当部分は従来計算を継続します。', diagnostics);
  }

  if (typeof renderEditor === 'function') renderEditor();
  if (typeof render === 'function') render();
  loadModeRuntimeModules();
})();
