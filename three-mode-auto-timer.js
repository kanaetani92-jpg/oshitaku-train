(() => {
  'use strict';

  function initialize() {
    const core = window.TrainAutoTimerCore;
    const storage = window.TrainThreeModeStorage;
    if (!core || !storage || typeof state === 'undefined') {
      console.warn('自動タイマーを初期化できませんでした。');
      return;
    }
    if (typeof normalizedTimerSchedule !== 'function' || typeof render !== 'function') {
      console.warn('自動タイマーに必要な既存関数が見つかりませんでした。');
      return;
    }

    const legacyCheckStationEvents = typeof checkStationEvents === 'function' ? checkStationEvents : null;
    const legacyResetRunState = typeof resetRunState === 'function' ? resetRunState : null;
    const legacyResetForScheduleChange = typeof resetForScheduleChange === 'function' ? resetForScheduleChange : null;
    let tickTimer = null;
    let rendering = false;

    function requestedMode() {
      return storage.normalizeMode(state.requestedMode ?? state.mode, 'timer');
    }

    function isAuto() {
      return requestedMode() === 'auto';
    }

    function schedule() {
      return normalizedTimerSchedule();
    }

    function assignRuntime(runtime) {
      state.autoRunning = runtime.autoRunning === true;
      state.autoStartedAt = Number.isFinite(Number(runtime.autoStartedAt)) ? Number(runtime.autoStartedAt) : null;
      state.autoPausedElapsedMs = Math.max(0, Number(runtime.autoPausedElapsedMs) || 0);
    }

    function resetAutoRuntime() {
      assignRuntime(core.reset());
      state.autoCompletedNotified = false;
    }

    function autoElapsedMs(currentSchedule = schedule()) {
      return core.elapsedMs(state, Date.now(), core.totalMs(currentSchedule));
    }

    function autoSnapshot(currentSchedule = schedule()) {
      return core.snapshot(currentSchedule, autoElapsedMs(currentSchedule));
    }

    function projectToLegacy(currentSchedule, snapshot) {
      state.mode = 'timer';
      state.running = state.autoRunning === true;
      state.timerStartedAt = state.autoRunning ? state.autoStartedAt : null;
      state.pausedElapsedMs = state.autoPausedElapsedMs;
      state.doneUntilIndex = snapshot.doneUntilIndex;

      if (snapshot.completed) {
        state.running = false;
        state.timerStartedAt = null;
        state.pausedElapsedMs = core.totalMs(currentSchedule);
        state.doneUntilIndex = Math.max(-1, snapshot.count - 1);
      }
    }

    function formatTime(ms) {
      const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
      const minutes = Math.floor(seconds / 60);
      return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function setText(selector, text) {
      const element = document.querySelector(selector);
      if (element && element.textContent !== text) element.textContent = text;
      return element;
    }

    function handleAutoEvents(currentSchedule, snapshot) {
      if (!isAuto()) return;

      if (!snapshot.completed && snapshot.currentIndex > (state.lastReachedIndex ?? -1)) {
        const station = currentSchedule.stations[snapshot.currentIndex];
        state.lastReachedIndex = snapshot.currentIndex;
        if (snapshot.currentIndex > 0 && station) {
          if (typeof announceStation === 'function') announceStation(station, false);
          if (typeof announceAccessibleStatus === 'function') {
            announceAccessibleStatus(`${station.name}の時間になりました。`, true);
          }
        }
      }

      if (snapshot.completed && !state.autoCompletedNotified) {
        state.autoCompletedNotified = true;
        state.lastReachedIndex = Math.max(-1, snapshot.count - 1);
        if (state.sound && typeof playChime === 'function') playChime(true);
        if (typeof announceAccessibleStatus === 'function') {
          announceAccessibleStatus('予定の時間が終了しました。おつかれさまでした。', true);
        }
        if (typeof saveState === 'function') saveState();
      }
    }

    function updateTrackLabels(currentSchedule, snapshot) {
      document.querySelectorAll('#track .station').forEach((element, index) => {
        const station = currentSchedule.stations[index];
        const current = !snapshot.completed && index === snapshot.currentIndex;
        const passed = snapshot.completed || index < snapshot.currentIndex;
        const upcoming = index > snapshot.currentIndex;

        element.classList.remove('done', 'late');
        if (passed) element.classList.add('reached');
        element.classList.toggle('current', current);
        if (current) element.setAttribute('aria-current', 'step');
        else element.removeAttribute('aria-current');

        const label = passed ? '通過済み' : (current ? '現在' : (upcoming ? 'これから' : '予定'));
        element.dataset.stationState = label;
        element.setAttribute('aria-label', `${station?.name || '予定'}駅、${label}`);
      });
    }

    function updateControls(snapshot) {
      const controls = document.querySelector('#timerControls');
      const heading = controls?.querySelector('h2');
      const start = document.querySelector('#startBtn');
      const pause = document.querySelector('#pauseBtn');
      const reset = document.querySelector('#resetBtn');
      const startPlan = document.querySelector('#startPlanBtn');
      const preview = document.querySelector('#previewBtn');

      controls?.classList.remove('hidden');
      if (heading) heading.textContent = '4. 自動タイマー操作';

      if (start) {
        start.textContent = snapshot.completed
          ? 'もう一度出発'
          : (state.autoRunning ? '走行中' : (state.autoPausedElapsedMs > 0 ? '再出発' : '出発'));
        start.disabled = state.autoRunning;
      }
      if (pause) {
        pause.textContent = '一時停止';
        pause.disabled = !state.autoRunning;
      }
      if (reset) reset.textContent = '最初の駅に戻る';
      if (startPlan) {
        startPlan.disabled = false;
        startPlan.textContent = state.autoRunning
          ? '見るモードへ'
          : (snapshot.completed ? 'もう一度始める' : (state.autoPausedElapsedMs > 0 ? '再開して見る' : 'この予定で始める'));
      }
      if (preview) preview.disabled = false;
    }

    function updateAutoUi(currentSchedule, snapshot) {
      if (!isAuto()) return;
      document.body.dataset.autoTimerState = snapshot.completed
        ? 'completed'
        : (state.autoRunning ? 'running' : (state.autoPausedElapsedMs > 0 ? 'paused' : 'ready'));

      const currentStation = currentSchedule.stations[snapshot.currentIndex] || currentSchedule.stations[0];
      const nextStation = currentSchedule.stations[snapshot.nextIndex] || currentSchedule.stations.at(-1);
      const timeLabel = document.querySelector('#timeBox small');
      const remaining = document.querySelector('#remainingText');
      const completion = document.querySelector('#completion');
      const doneButton = document.querySelector('#doneBtn');
      const progressMetrics = document.querySelectorAll('.progress-panel .metric');

      if (timeLabel) timeLabel.textContent = snapshot.completed ? '終了' : 'この予定ののこり';
      if (remaining) remaining.textContent = snapshot.completed ? '時間終了' : formatTime(snapshot.remainingMs);
      setText('#currentCardKicker', snapshot.completed ? '時間終了' : 'いまの予定');
      setText('#currentCardTime', snapshot.completed ? '予定終了' : `つぎまで ${formatTime(snapshot.remainingMs)}`);

      if (snapshot.completed) {
        setText('#nextBox', '予定の時間が終了しました。おつかれさまでした');
      } else if (snapshot.nextIndex === snapshot.currentIndex) {
        setText('#nextBox', `「${currentStation?.name || '予定'}」の時間です`);
      } else {
        setText('#nextBox', `つぎは「${nextStation?.name || '予定'}」です`);
      }

      setText('#nowMetric', snapshot.completed ? '時間終了' : `${currentStation?.name || '予定'}
${snapshot.currentIndex + 1}番目`);
      setText('#nextMetric', snapshot.completed ? '終了' : `あと ${formatTime(snapshot.remainingMs)}`);
      setText('#percentMetric', `${snapshot.positionCount}/${snapshot.count}`);

      if (progressMetrics[0]?.querySelector('span')) progressMetrics[0].querySelector('span').textContent = '現在';
      if (progressMetrics[1]?.querySelector('span')) progressMetrics[1].querySelector('span').textContent = 'つぎまで';
      if (progressMetrics[2]?.querySelector('span')) progressMetrics[2].querySelector('span').textContent = '予定';

      if (completion) {
        completion.textContent = '⏰ 予定の時間が終了しました。おつかれさまでした。';
        completion.classList.toggle('show', snapshot.completed);
        completion.setAttribute('aria-hidden', snapshot.completed ? 'false' : 'true');
      }
      if (doneButton) {
        doneButton.hidden = true;
        doneButton.setAttribute('aria-hidden', 'true');
        doneButton.tabIndex = -1;
      }

      const upcomingEmpty = document.querySelector('#upcomingCards .upcoming-empty');
      if (upcomingEmpty && snapshot.completed) upcomingEmpty.textContent = '予定の時間が終了しました ⏰';

      updateTrackLabels(currentSchedule, snapshot);
      updateControls(snapshot);
    }

    function restoreNonAutoUi() {
      const doneButton = document.querySelector('#doneBtn');
      if (doneButton) {
        doneButton.hidden = false;
        doneButton.removeAttribute('aria-hidden');
        doneButton.removeAttribute('tabindex');
      }
      delete document.body.dataset.autoTimerState;
    }

    function synchronize({ renderNow = false, save = false } = {}) {
      if (!isAuto()) {
        restoreNonAutoUi();
        return null;
      }

      const currentSchedule = schedule();
      let snapshot = autoSnapshot(currentSchedule);

      if (snapshot.completed && state.autoRunning) {
        assignRuntime(core.finish(currentSchedule));
        snapshot = core.snapshot(currentSchedule, core.totalMs(currentSchedule));
        if (save && typeof saveState === 'function') saveState();
      }

      projectToLegacy(currentSchedule, snapshot);
      handleAutoEvents(currentSchedule, snapshot);

      if (renderNow && !rendering) {
        rendering = true;
        try {
          render();
        } finally {
          rendering = false;
        }
      }

      updateAutoUi(currentSchedule, snapshot);
      return snapshot;
    }

    async function startAuto({ openView = false } = {}) {
      if (!isAuto()) return;
      const currentSchedule = schedule();
      const started = core.start(currentSchedule, state, Date.now());
      assignRuntime(started);
      state.autoCompletedNotified = false;
      state.celebrated = false;
      if (state.autoPausedElapsedMs === 0) state.lastReachedIndex = 0;
      if (openView) state.uiMode = 'view';
      if (state.sound && typeof unlockAudio === 'function') await unlockAudio();
      synchronize({ renderNow:true });
      if (typeof saveState === 'function') saveState();
      if (typeof announceAccessibleStatus === 'function') {
        announceAccessibleStatus(`${state.title}の自動タイマーを始めます。`, true);
      }
    }

    function pauseAuto() {
      if (!isAuto() || !state.autoRunning) return;
      assignRuntime(core.pause(schedule(), state, Date.now()));
      synchronize({ renderNow:true });
      if (typeof saveState === 'function') saveState();
      if (typeof announceAccessibleStatus === 'function') announceAccessibleStatus('自動タイマーを一時停止しました。', true);
    }

    function resetAuto({ ask = true } = {}) {
      if (!isAuto()) return;
      const hasProgress = state.autoRunning || state.autoPausedElapsedMs > 0;
      if (ask && hasProgress && !window.confirm('最初の駅に戻りますか？')) return;
      resetAutoRuntime();
      state.lastReachedIndex = -1;
      state.doneUntilIndex = -1;
      state.celebrated = false;
      synchronize({ renderNow:true });
      if (typeof saveState === 'function') saveState();
      if (typeof announceAccessibleStatus === 'function') announceAccessibleStatus('最初の駅に戻しました。', true);
    }

    if (legacyCheckStationEvents) {
      checkStationEvents = function checkStationEventsWithAuto(data, allDone) {
        if (!isAuto()) return legacyCheckStationEvents(data, allDone);
        const currentSchedule = schedule();
        const snapshot = autoSnapshot(currentSchedule);
        handleAutoEvents(currentSchedule, snapshot);
      };
    }

    if (legacyResetRunState) {
      resetRunState = function resetRunStateWithAuto() {
        legacyResetRunState();
        resetAutoRuntime();
      };
    }

    if (legacyResetForScheduleChange) {
      resetForScheduleChange = function resetForScheduleChangeWithAuto() {
        legacyResetForScheduleChange();
        resetAutoRuntime();
        state.lastReachedIndex = -1;
      };
    }

    document.querySelector('#startPlanBtn')?.addEventListener('click', (event) => {
      if (!isAuto()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      startAuto({ openView:true });
    }, { capture:true });

    document.querySelector('#previewBtn')?.addEventListener('click', (event) => {
      if (!isAuto()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      state.uiMode = 'view';
      synchronize({ renderNow:true });
      if (typeof saveState === 'function') saveState();
    }, { capture:true });

    document.querySelector('#startBtn')?.addEventListener('click', (event) => {
      if (!isAuto()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      startAuto();
    }, { capture:true });

    document.querySelector('#pauseBtn')?.addEventListener('click', (event) => {
      if (!isAuto()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      pauseAuto();
    }, { capture:true });

    document.querySelector('#resetBtn')?.addEventListener('click', (event) => {
      if (!isAuto()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      resetAuto();
    }, { capture:true });

    tickTimer = window.setInterval(() => {
      if (isAuto()) synchronize({ renderNow:true, save:true });
    }, 500);

    window.addEventListener('beforeunload', () => {
      if (tickTimer) window.clearInterval(tickTimer);
    });

    window.TrainAutoTimer = Object.freeze({
      isActive: isAuto,
      start: startAuto,
      pause: pauseAuto,
      reset: resetAuto,
      synchronize,
      snapshot() {
        const currentSchedule = schedule();
        return core.snapshot(currentSchedule, autoElapsedMs(currentSchedule));
      }
    });

    if (isAuto()) synchronize({ renderNow:true, save:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once:true });
  } else {
    initialize();
  }
})();
