(() => {
  'use strict';

  if (!window.TrainAutoTimer || typeof render !== 'function') {
    console.warn('自動タイマーの表示同期を初期化できませんでした。');
    return;
  }

  const baseRender = render;
  let insideRender = false;

  render = function renderWithAutomaticTimer() {
    if (insideRender) return baseRender();
    insideRender = true;
    try {
      if (window.TrainAutoTimer.isActive()) {
        window.TrainAutoTimer.synchronize({ renderNow:false, save:false });
      }
      const result = baseRender();
      if (window.TrainAutoTimer.isActive()) {
        window.TrainAutoTimer.synchronize({ renderNow:false, save:false });
      }
      return result;
    } finally {
      insideRender = false;
    }
  };

  if (window.TrainAutoTimer.isActive()) render();
})();
