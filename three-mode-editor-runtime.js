(() => {
  'use strict';

  const core = window.TrainStage8EditorCore;
  if (!core || typeof state === 'undefined') {
    console.warn('第8段階のデータ保持補正を初期化できませんでした。');
    return;
  }

  function selectedMode() {
    return core.normalizeMode(state.requestedMode ?? state.mode, 'timer');
  }

  function latentFields(station) {
    return {
      timerIntervalMin:station?.timerIntervalMin,
      autoIntervalMin:station?.autoIntervalMin,
      clockStart:station?.clockStart,
      clockEnd:station?.clockEnd
    };
  }

  function loadScriptOnce(src, marker) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[${marker}]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') resolve(existing);
        else {
          existing.addEventListener('load', () => resolve(existing), { once:true });
          existing.addEventListener('error', reject, { once:true });
        }
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

  async function loadStage9Modules() {
    try {
      await loadScriptOnce('three-mode-regression-core.js', 'data-three-mode-regression-core');
      await loadScriptOnce('three-mode-regression-ui.js', 'data-three-mode-regression-ui');
    } catch (error) {
      console.error('第9段階の総合表示調整を読み込めませんでした。従来表示を継続します。', error);
    }
  }

  if (typeof shiftStationTime === 'function') {
    const baseShiftStationTime = shiftStationTime;
    shiftStationTime = function shiftStage8StationTime(station, minutes) {
      const result = baseShiftStationTime(station, minutes);
      if (station) {
        station.clockStart = core.validHHMM(station.arrive, station.clockStart);
        station.clockEnd = core.validHHMM(station.depart, station.clockEnd);
      }
      return result;
    };
  }

  const sortButton = document.querySelector('#sortBtn');
  sortButton?.addEventListener('click', () => {
    if (selectedMode() !== 'clock') return;
    const byId = new Map(
      state.stations.map((station, index) => [String(station.id || `index-${index}`), latentFields(station)])
    );

    queueMicrotask(() => {
      state.stations = state.stations.map((station, index) => {
        const saved = byId.get(String(station.id || `index-${index}`)) || {};
        return core.normalizeStation({ ...saved, ...station }, index, 'clock');
      });
      if (typeof saveState === 'function') saveState();
      if (typeof renderEditor === 'function') renderEditor();
      if (typeof render === 'function') render();
    });
  }, { capture:true });

  document.querySelector('#addStationBtn')?.addEventListener('click', () => {
    queueMicrotask(() => {
      state.stations = core.applyModeData(core.normalizeStations(state.stations, selectedMode()), selectedMode());
      if (typeof saveState === 'function') saveState();
    });
  }, { capture:true });

  window.TrainStage8Runtime = Object.freeze({
    selectedMode,
    synchronize() {
      state.stations = core.applyModeData(core.normalizeStations(state.stations, selectedMode()), selectedMode());
    }
  });

  loadStage9Modules();
})();
