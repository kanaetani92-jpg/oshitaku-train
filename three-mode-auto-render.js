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
  // そのため、この位置で専用表示を確定すると、旧表示が画面に出る前に上書きできます。
  if (baseCheckStationEvents) {
    checkStationEvents = function checkStationEventsWithThreeModeFinalizer(data, allDone) {
      const result = baseCheckStationEvents(data, allDone);
      if (specialModeActive()) synchronizeSpecialMode({ announce:false });
      return result;
    };
  }

  observer = new MutationObserver(() => {
    if (insideRender || !specialModeActive()) return;

    // 動的に呼ばれる render() 以外にも、起動時に登録済みの旧renderタイマーがあるため、
    // DOM変更後・ブラウザ描画前にも専用表示を確認します。
    observer.disconnect();
    insideRender = true;
    try {
      synchronizeSpecialMode({ announce:false });
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
      synchronizeSpecialMode({ announce:false });
      return result;
    } finally {
      insideRender = false;
      observeSchedulePage();
    }
  };

  observeSchedulePage();
  if (specialModeActive()) synchronizeSpecialMode({ announce:false });

  window.TrainThreeModeRenderCoordinator = Object.freeze({
    synchronize: synchronizeSpecialMode,
    isSpecialModeActive: specialModeActive
  });
})();
