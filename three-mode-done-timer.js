(() => {
  'use strict';

  function initialize() {
    const core = window.TrainDoneTimerCore;
    const storage = window.TrainThreeModeStorage;
    if (!core || !storage || typeof state === 'undefined') {
      console.warn('できた！タイマーを初期化できませんでした。');
      return;
    }
    if (
      typeof normalizedTimerSchedule !== 'function' ||
      typeof getElapsedMs !== 'function' ||
      typeof render !== 'function'
    ) {
      console.warn('できた！タイマーに必要な既存関数が見つかりませんでした。');
      return;
    }

    let handlingDone = false;
    let lastDoneAt = 0;
    let syncFrame = 0;
    const originalRender = render;

    function requestedMode() {
      return storage.normalizeMode(state.requestedMode ?? state.mode, 'timer');
    }

    function isDoneTimer() {
      return requestedMode() === 'timer' && state.mode === 'timer';
    }

    function setTextIfChanged(element, text) {
      if (element && element.textContent !== text) element.textContent = text;
    }

    function setAttributeIfChanged(element, name, value) {
      if (element && element.getAttribute(name) !== value) element.setAttribute(name, value);
    }

    function padTime(ms) {
      const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
      const minutes = Math.floor(seconds / 60);
      return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function gentleRemainingLabel(timing) {
      if (timing.completed) return 'できた！';
      if (timing.isLast) return 'できたらゴール';
      if (timing.overdue) return 'おじかんになったよ';
      if (state.showNumbers) return padTime(timing.remainingMs);
      const minutes = timing.remainingMs / 60000;
      if (minutes <= 1) return 'あと少し';
      if (minutes <= 5) return 'もうすぐ';
      return 'すすんでいます';
    }

    function scheduleSync() {
      if (syncFrame) return;
      syncFrame = window.requestAnimationFrame(() => {
        syncFrame = 0;
        syncDoneTimerUi();
      });
    }

    function syncDoneTimerUi() {
      if (!isDoneTimer()) return;

      const schedule = normalizedTimerSchedule();
      const elapsedMs = getElapsedMs();
      const timing = core.taskTiming(schedule, state.doneUntilIndex, elapsedMs);
      const current = schedule.stations[timing.currentIndex] || schedule.stations[0];
      const doneButton = document.querySelector('#doneBtn');
      const timeLabel = document.querySelector('#timeBox small');
      const remaining = document.querySelector('#remainingText');
      const currentCardTime = document.querySelector('#currentCardTime');
      const taskState = timing.completed
        ? 'completed'
        : (timing.isLast ? 'last' : (timing.overdue ? 'overdue' : 'running'));

      if (document.body.dataset.timerTaskState !== taskState) {
        document.body.dataset.timerTaskState = taskState;
      }

      setTextIfChanged(timeLabel, timing.completed
        ? '完了'
        : (timing.isLast ? 'さいごの予定' : 'この予定ののこり'));
      setTextIfChanged(remaining, gentleRemainingLabel(timing));

      if (timing.completed) setTextIfChanged(currentCardTime, 'ゴール');
      else if (timing.isLast) setTextIfChanged(currentCardTime, 'できたらゴール');
      else if (state.showNumbers) setTextIfChanged(currentCardTime, `つぎまで ${Math.max(1, Math.ceil(timing.durationMs / 60000))}分`);
      else setTextIfChanged(currentCardTime, 'つぎまで');

      if (doneButton) {
        const disabled = timing.completed || handlingDone;
        if (doneButton.disabled !== disabled) doneButton.disabled = disabled;
        setTextIfChanged(doneButton, 'できた！');
        setAttributeIfChanged(doneButton, 'aria-label', timing.completed
          ? 'すべて完了しました'
          : `${current?.name || 'いますること'}ができた`);
      }
    }

    render = function renderWithStableDoneTimer() {
      const result = originalRender();
      scheduleSync();
      return result;
    };

    async function completeCurrentTask(event) {
      const mode = requestedMode();

      if (mode === 'auto') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (typeof announceAccessibleStatus === 'function') {
          announceAccessibleStatus('自動タイマーの開始は次の段階で追加します。', true);
        }
        return;
      }

      if (!isDoneTimer()) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const now = Date.now();
      if (handlingDone || now - lastDoneAt < 450) return;
      handlingDone = true;
      lastDoneAt = now;
      syncDoneTimerUi();

      try {
        const schedule = normalizedTimerSchedule();
        const elapsedMs = getElapsedMs();
        const currentIndex = core.activeIndex(schedule, state.doneUntilIndex);
        const currentStation = schedule.stations[currentIndex];
        const result = core.completeCurrent(schedule, {
          doneUntilIndex: state.doneUntilIndex,
          running: state.running,
          pausedByLate: state.pausedByLate,
          elapsedMs,
          nowMs: now
        });

        if (!result.changed) return;

        state.doneUntilIndex = result.doneUntilIndex;
        state.pausedElapsedMs = result.elapsedMs;
        state.running = result.running;
        state.timerStartedAt = result.timerStartedAt;
        state.pausedByLate = false;
        state.lastReachedIndex = result.completed
          ? schedule.stations.length - 1
          : result.activeIndex;

        if (result.completed) {
          state.celebrated = true;
          if (state.sound && typeof playChime === 'function') await playChime(true);
          if (typeof makeConfetti === 'function') makeConfetti();
          if (typeof announceAccessibleStatus === 'function') {
            announceAccessibleStatus('ぜんぶできました。ゴールです。よくできました。', true);
          }
        } else if (typeof announceAccessibleStatus === 'function') {
          announceAccessibleStatus(`${currentStation?.name || '予定'}ができました。つぎの予定を始めます。`, true);
        }

        if (typeof saveState === 'function') saveState();
        render();
      } finally {
        window.setTimeout(() => {
          handlingDone = false;
          syncDoneTimerUi();
        }, 450);
      }
    }

    document.querySelector('#doneBtn')?.addEventListener('click', completeCurrentTask, { capture:true });

    document.querySelector('#viewEditToggle')?.addEventListener('click', (event) => {
      if (requestedMode() !== 'auto') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (typeof announceAccessibleStatus === 'function') {
        announceAccessibleStatus('自動タイマーの見るモードは次の段階で追加します。', true);
      }
    }, { capture:true });

    const observer = new MutationObserver(scheduleSync);
    const timeBox = document.querySelector('#timeBox');
    const currentCard = document.querySelector('#currentCard');
    if (timeBox) observer.observe(timeBox, { childList:true, characterData:true, subtree:true });
    if (currentCard) observer.observe(currentCard, { childList:true, characterData:true, subtree:true });

    window.TrainDoneTimer = Object.freeze({
      sync: syncDoneTimerUi,
      isActive: isDoneTimer,
      timing() {
        const schedule = normalizedTimerSchedule();
        return core.taskTiming(schedule, state.doneUntilIndex, getElapsedMs());
      }
    });

    scheduleSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once:true });
  } else {
    initialize();
  }
})();
