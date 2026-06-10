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
    let applying = false;
    let lastIssueKey = '';

    function requestedMode() {
      return storage.normalizeMode(state.requestedMode ?? state.mode, 'timer');
    }

    function setText(selector, value) {
      const element = document.querySelector(selector);
      const text = String(value ?? '');
      if (element && element.textContent !== text) element.textContent = text;
      return element;
    }

    function currentSchedule(mode) {
      try {
        // 画面で実際に使用している正規化結果を優先します。
        // 特に時計モードは最初の開始時刻と最後の終了時刻を実効範囲として扱います。
        if (mode === 'clock' && typeof normalizedClockSchedule === 'function') {
          return normalizedClockSchedule();
        }
        if (mode !== 'clock' && typeof normalizedTimerSchedule === 'function') {
          return normalizedTimerSchedule();
        }
        if (window.TrainThreeModeTimeAdapter?.buildSchedule) {
          return window.TrainThreeModeTimeAdapter.buildSchedule(mode);
        }
      } catch (error) {
        console.warn('第9段階の予定情報を取得できませんでした。', error);
      }
      return { stations:[], total:1 };
    }

    function applyNumberVisibility(showNumbers) {
      document.body.classList.toggle('numbers-hidden', !showNumbers);
      document.body.dataset.showNumbers = showNumbers ? 'true' : 'false';

      // 数字を消す場合も、残り時間の意味を表す言葉は表示します。
      const timeBox = document.querySelector('#timeBox');
      if (timeBox) {
        timeBox.classList.remove('hidden');
        timeBox.hidden = false;
        timeBox.setAttribute('aria-hidden', 'false');
      }
    }

    function applyTimer(showNumbers) {
      if (!window.TrainDoneTimer?.isActive?.()) return false;
      const schedule = currentSchedule('timer');
      const timing = window.TrainDoneTimer.timing();
      const count = Array.isArray(schedule.stations) ? schedule.stations.length : 0;
      const doneCount = Math.max(0, Math.min(count, Number(state.doneUntilIndex ?? -1) + 1));
      const view = core.timerView({
        ...timing,
        count,
        doneCount
      }, showNumbers);

      setText('#remainingText', view.remaining);
      setText('#currentCardTime', view.currentCardTime);
      setText('#nextMetric', view.nextMetric);
      setText('#percentMetric', view.progress);
      const progressLabel = document.querySelector('.progress-panel .metric:nth-child(3) span');
      if (progressLabel) progressLabel.textContent = showNumbers ? 'できた' : '進み具合';
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
      const issueKey = issues.join('|');
      if (issues.length && issueKey !== lastIssueKey) {
        console.info('第9段階：予定データは安全な表示用に補正されています。', issues);
      }
      lastIssueKey = issueKey;
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
        apply();
      });
    }

    document.querySelector('#showNumbers')?.addEventListener('change', scheduleApply);
    window.addEventListener('resize', scheduleApply, { passive:true });
    window.addEventListener('orientationchange', scheduleApply, { passive:true });
    window.addEventListener('pageshow', scheduleApply, { passive:true });
    window.addEventListener('focus', scheduleApply, { passive:true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleApply();
    });

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
