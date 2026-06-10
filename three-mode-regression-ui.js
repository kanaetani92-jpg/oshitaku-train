(() => {
  'use strict';

  function initialize() {
    const core = window.TrainThreeModeRegressionCore;
    const storage = window.TrainThreeModeStorage;
    if (!core || !storage || typeof state === 'undefined') {
      console.warn('第9段階の表示調整を初期化できませんでした。');
      return;
    }

    let frame = 0;
    let observer = null;
    let applying = false;

    function requestedMode() {
      return storage.normalizeMode(state.requestedMode ?? state.mode, 'timer');
    }

    function setText(selector, value) {
      const element = document.querySelector(selector);
      const text = String(value ?? '');
      if (element && element.textContent !== text) element.textContent = text;
      return element;
    }

    function setHidden(element, hidden) {
      if (!element) return;
      element.classList.toggle('hidden', hidden);
      element.hidden = hidden;
      element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    }

    function currentSchedule(mode) {
      try {
        if (window.TrainThreeModeTimeAdapter?.buildSchedule) {
          return window.TrainThreeModeTimeAdapter.buildSchedule(mode);
        }
        if (mode === 'clock' && typeof normalizedClockSchedule === 'function') return normalizedClockSchedule();
        if (typeof normalizedTimerSchedule === 'function') return normalizedTimerSchedule();
      } catch (error) {
        console.warn('第9段階の予定情報を取得できませんでした。', error);
      }
      return { stations:[], total:1 };
    }

    function applyNumberVisibility(showNumbers) {
      document.body.classList.toggle('numbers-hidden', !showNumbers);
      document.body.dataset.showNumbers = showNumbers ? 'true' : 'false';

      const timeBox = document.querySelector('#timeBox');
      if (timeBox) {
        timeBox.classList.remove('hidden');
        timeBox.hidden = false;
        timeBox.setAttribute('aria-hidden', 'false');
      }

      document.querySelectorAll('#track .station-time, #upcomingCards .picture-card-time').forEach((element) => {
        setHidden(element, !showNumbers);
      });
    }

    function applyTimer(showNumbers) {
      if (!window.TrainDoneTimer?.isActive?.()) return false;
      const schedule = currentSchedule('timer');
      const timing = window.TrainDoneTimer.timing();
      const view = core.timerView({
        ...timing,
        count:Array.isArray(schedule.stations) ? schedule.stations.length : 0
      }, showNumbers);

      setText('#remainingText', view.remaining);
      setText('#currentCardTime', view.currentCardTime);
      setText('#nextMetric', view.nextMetric);
      setText('#percentMetric', view.progress);
      return true;
    }

    function applyAuto(showNumbers) {
      if (!window.TrainAutoTimer?.isActive?.()) return false;
      const snapshot = window.TrainAutoTimer.snapshot();
      const view = core.autoView(snapshot, showNumbers);

      setText('#remainingText', view.remaining);
      setText('#currentCardTime', view.currentCardTime);
      setText('#nextMetric', view.nextMetric);
      setText('#percentMetric', view.progress);
      return true;
    }

    function applyClock(showNumbers) {
      if (!window.TrainClockMode?.isActive?.()) return false;
      const schedule = currentSchedule('clock');
      const snapshot = window.TrainClockMode.snapshot();
      const view = core.clockView(snapshot, schedule, showNumbers);
      const station = schedule.stations?.[snapshot.displayIndex] || schedule.stations?.[0] || {};

      setText('#remainingText', view.remaining);
      setText('#currentCardTime', view.currentCardTime);
      setText('#nextBox', view.nextBox);
      setText('#nextMetric', view.nextMetric);
      setText('#percentMetric', view.progress);

      if (!showNumbers) {
        if (snapshot.phase === 'active') setText('#nowMetric', station.name || '予定中');
        else if (snapshot.phase === 'before') setText('#nowMetric', '開始前');
        else if (snapshot.phase === 'between') setText('#nowMetric', '予定のあいだ');
        else setText('#nowMetric', '時間終了');
      }
      return true;
    }

    function updateDiagnostics(mode) {
      const schedule = currentSchedule(mode);
      const issues = core.scheduleIssues(schedule);
      document.body.dataset.scheduleHealth = issues.length ? 'normalized' : 'ok';
      document.body.dataset.scheduleIssueCount = String(issues.length);
      if (issues.length) {
        console.info('第9段階：予定データは安全な表示用に補正されています。', issues);
      }
    }

    function apply() {
      if (applying) return;
      applying = true;
      try {
        const mode = requestedMode();
        const showNumbers = state.showNumbers !== false;
        applyNumberVisibility(showNumbers);

        if (mode === 'auto') applyAuto(showNumbers);
        else if (mode === 'clock') applyClock(showNumbers);
        else applyTimer(showNumbers);

        updateDiagnostics(mode);
      } finally {
        applying = false;
      }
    }

    function scheduleApply() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (observer) observer.disconnect();
        apply();
        observe();
      });
    }

    function observe() {
      const root = document.querySelector('#schedulePage');
      if (!root || !observer) return;
      observer.observe(root, {
        subtree:true,
        childList:true,
        characterData:true,
        attributes:true,
        attributeFilter:['class', 'hidden', 'aria-hidden', 'style']
      });
    }

    observer = new MutationObserver(() => {
      if (!applying) scheduleApply();
    });

    document.querySelector('#showNumbers')?.addEventListener('change', scheduleApply);
    window.addEventListener('resize', scheduleApply, { passive:true });
    window.addEventListener('orientationchange', scheduleApply, { passive:true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleApply();
    });

    const originalCoordinator = window.TrainThreeModeRenderCoordinator;
    if (originalCoordinator?.synchronize) {
      const originalSynchronize = originalCoordinator.synchronize;
      window.TrainStage9Synchronize = function synchronizeStage9(options) {
        originalSynchronize(options);
        scheduleApply();
      };
    }

    observe();
    scheduleApply();

    window.TrainThreeModeRegressionUi = Object.freeze({
      synchronize:scheduleApply,
      applyNow:apply,
      requestedMode
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once:true });
  } else {
    initialize();
  }
})();
