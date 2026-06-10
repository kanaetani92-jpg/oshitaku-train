(() => {
  'use strict';

  if (typeof render !== 'function') {
    console.warn('3モード表示同期を初期化できませんでした。');
    return;
  }

  const baseRender = render;
  const baseCheckStationEvents = typeof checkStationEvents === 'function' ? checkStationEvents : null;
  let insideRender = false;
  let observer = null;

  function autoActive() {
    return Boolean(window.TrainAutoTimer?.isActive?.());
  }

  function clockActive() {
    return Boolean(window.TrainClockMode?.isActive?.());
  }

  function specialModeActive() {
    return autoActive() || clockActive();
  }

  function finalizeStage9() {
    window.TrainThreeModeRegressionUi?.applyNow?.();
  }

  function normalizeClockRuntime() {
    if (!clockActive() || typeof state === 'undefined') return;

    // 時計モードは現在時刻の表示だけを行い、完了操作やタイマー状態を持ちません。
    state.running = false;
    state.timerStartedAt = null;
    state.pausedElapsedMs = 0;
    state.pausedByLate = false;
    state.doneUntilIndex = -1;
    state.clockDoneIndexes = [];
    state.celebrated = false;
  }

  function synchronizeSpecialMode({ announce = false } = {}) {
    if (autoActive()) {
      window.TrainAutoTimer.synchronize({ renderNow:false, save:false });
      return;
    }
    if (clockActive()) {
      normalizeClockRuntime();
      window.TrainClockMode.synchronize({ announce });
    }
  }

  function synchronizeAll({ announce = false } = {}) {
    synchronizeSpecialMode({ announce });
    finalizeStage9();
  }

  function observeSchedulePage() {
    const root = document.querySelector('#schedulePage');
    if (!root || !observer) return;
    observer.observe(root, {
      subtree:true,
      childList:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class', 'hidden', 'aria-hidden', 'disabled', 'style']
    });
  }

  // app.js の render() は checkStationEvents() のあとに表示を書き換えません。
  // この位置で専用モードと第9段階の表示を確定し、旧表示を画面へ出しません。
  if (baseCheckStationEvents) {
    checkStationEvents = function checkStationEventsWithThreeModeFinalizer(data, allDone) {
      const result = baseCheckStationEvents(data, allDone);
      synchronizeAll({ announce:false });
      return result;
    };
  }

  observer = new MutationObserver(() => {
    if (insideRender || !specialModeActive()) return;

    // 自動タイマーの500ms更新や、起動時に登録済みの旧renderタイマーにも対応します。
    // DOM変更後・ブラウザ描画前に、専用表示と第9段階の表示を順に確定します。
    observer.disconnect();
    insideRender = true;
    try {
      synchronizeAll({ announce:false });
    } finally {
      insideRender = false;
      observeSchedulePage();
    }
  });

  render = function renderWithThreeModeCoordinator() {
    if (insideRender) return baseRender();
    insideRender = true;
    observer.disconnect();
    try {
      const result = baseRender();
      synchronizeAll({ announce:false });
      return result;
    } finally {
      insideRender = false;
      observeSchedulePage();
    }
  };

  observeSchedulePage();
  synchronizeAll({ announce:false });

  window.TrainThreeModeRenderCoordinator = Object.freeze({
    synchronize: synchronizeAll,
    isSpecialModeActive: specialModeActive
  });
})();
