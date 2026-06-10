(() => {
  'use strict';

  if (typeof render !== 'function') {
    console.warn('3モード表示同期を初期化できませんでした。');
    return;
  }

  const baseRender = render;
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

  function synchronizeSpecialMode({ announce = false } = {}) {
    if (autoActive()) {
      window.TrainAutoTimer.synchronize({ renderNow:false, save:false });
      return;
    }
    if (clockActive()) {
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

  observer = new MutationObserver(() => {
    if (insideRender || !specialModeActive()) return;

    // app.jsの1秒描画が同じ欄を書き換えた直後、ブラウザが描画する前に
    // 選択中モードの表示へ1回だけ戻します。
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
