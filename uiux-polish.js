(() => {
  const STATE_KEYS = ['oshitakuTrainNoPhotoStateV16', 'oshitakuTrainNoPhotoStateV18'];

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatMinutesForChild(value) {
    if (!Number.isFinite(value)) return '--分';
    if (value <= 0) return '1分未満';
    return `${Math.ceil(value)}分`;
  }

  function isTimerMode() {
    try { return typeof state !== 'undefined' && state.mode === 'timer'; } catch { return true; }
  }

  function fixLastStationInterval() {
    const editor = $('#stationEditor');
    if (!editor || !isTimerMode()) return;
    const rows = $$('.station-row', editor);
    if (!rows.length) return;

    rows.forEach((row, index) => {
      const grid = row.querySelector('.station-edit-grid.three');
      if (!grid) return;
      const isLast = index === rows.length - 1;
      const nextValue = (() => {
        try {
          return state?.stations?.[index + 1]?.intervalMin ?? 5;
        } catch {
          return 5;
        }
      })();
      if (isLast) {
        if (!grid.querySelector('.last-station-no-interval')) {
          grid.innerHTML = '<div class="last-station-no-interval">さいごの駅です。次の駅までの時間はありません。</div>';
        }
      } else if (!grid.querySelector('[data-uiux-next-index]')) {
        grid.innerHTML = `<label>次まで何分？<input type="number" min="1" max="240" data-uiux-next-index="${index}" value="${String(nextValue).replace(/"/g, '&quot;')}"></label>`;
      }
    });
  }

  function patchEditorEvents() {
    const editor = $('#stationEditor');
    if (!editor || editor.dataset.uiuxEditorPatch === '1') return;
    editor.dataset.uiuxEditorPatch = '1';
    const updateNextInterval = (event) => {
      const input = event.target.closest('[data-uiux-next-index]');
      if (!input) return;
      const index = Number(input.dataset.uiuxNextIndex);
      const minutes = Math.max(1, Math.round(Number(input.value) || 1));
      try {
        if (state?.stations?.[index + 1]) {
          state.stations[index + 1].intervalMin = minutes;
          if (typeof saveState === 'function') saveState();
          if (event.type === 'change' && typeof render === 'function') render();
        }
      } catch {}
    };
    editor.addEventListener('input', updateNextInterval);
    editor.addEventListener('change', updateNextInterval);
  }

  function patchGuideSkip() {
    const close = $('#guideCloseBtn');
    const skip = $('#guideSkip');
    if (!close || !skip || close.dataset.uiuxPatch === '1') return;
    close.dataset.uiuxPatch = '1';
    close.addEventListener('click', () => {
      setTimeout(() => {
        STATE_KEYS.forEach((key) => {
          try {
            const saved = JSON.parse(localStorage.getItem(key) || '{}');
            saved.seenGuide = Boolean(skip.checked);
            localStorage.setItem(key, JSON.stringify(saved));
          } catch {}
        });
      }, 0);
    }, true);
  }

  function getProgressDataSafely() {
    try {
      if (typeof progressData === 'function') return progressData();
    } catch {}
    return null;
  }

  function stationStartOffset(schedule, index) {
    const station = schedule?.stations?.[index];
    if (!station) return 0;
    try {
      if (state.mode === 'timer') return station.markerOffset || 0;
    } catch {}
    return station.markerOffset ?? station.arriveOffset ?? 0;
  }

  function nextIndexFor(data) {
    try {
      if (state.mode === 'timer' && typeof timerNextIndex === 'function') return timerNextIndex(data.schedule, data.activeIndex);
      return data.vehicle.nextIndex;
    } catch {
      return data.activeIndex + 1;
    }
  }

  function patchMetrics() {
    const data = getProgressDataSafely();
    const nowMetric = $('#nowMetric');
    const nextMetric = $('#nextMetric');
    const percentMetric = $('#percentMetric');
    if (!data || !nowMetric || !nextMetric || !percentMetric) return;

    const nowLabel = nowMetric.previousElementSibling;
    const nextLabel = nextMetric.previousElementSibling;
    const doneLabel = percentMetric.previousElementSibling;
    if (nowLabel) nowLabel.textContent = 'いま';
    if (nextLabel) nextLabel.textContent = 'つぎの予定まで';
    if (doneLabel) doneLabel.textContent = 'できた';

    const schedule = data.schedule;
    const total = schedule?.stations?.length || 0;
    const activeIndex = data.activeIndex ?? data.vehicle?.stationIndex ?? 0;
    const activeStation = schedule?.stations?.[activeIndex] || schedule?.stations?.[0] || { name: '予定' };
    const goal = data.vehicle?.status === 'goal' || data.percent >= 1 || activeIndex >= total - 1 && data.percent >= 1;
    const start = stationStartOffset(schedule, activeIndex);
    const activeElapsed = Math.max(0, (data.elapsedMin || 0) - start);

    if (goal) {
      nowMetric.textContent = 'ゴール';
    } else if (data.late) {
      nowMetric.textContent = `${activeStation.name}中・${formatMinutesForChild(activeElapsed)}経過・ゆっくり`;
    } else {
      nowMetric.textContent = `${activeStation.name}中・${formatMinutesForChild(activeElapsed)}経過`;
    }

    const nextIndex = nextIndexFor(data);
    const nextStation = schedule?.stations?.[nextIndex];
    let remain = 0;
    try {
      if (state.mode === 'timer') remain = (nextStation?.markerOffset ?? schedule.total) - data.elapsedMin;
      else {
        const currentAbs = schedule.startAbs + data.elapsedMin;
        remain = data.vehicle.nextAt - currentAbs;
      }
    } catch {
      remain = data.vehicle.nextAt - data.elapsedMin;
    }
    nextMetric.textContent = goal || !nextStation ? 'とうちゃく' : `${nextStation.name}まで あと ${formatMinutesForChild(remain)}`;

    let doneCount = 0;
    try {
      if (goal) doneCount = total;
      else if (state.mode === 'timer') doneCount = clampNumber((state.doneUntilIndex ?? -1) + 1, 0, total);
      else doneCount = clampNumber(Math.max(state.clockDoneIndexes?.length || 0, data.reachedIndex || 0), 0, total);
    } catch {
      doneCount = Math.round((data.percent || 0) * total);
    }
    percentMetric.textContent = `${doneCount}/${total}できた`;
  }

  function patchGoalLabels() {
    const data = getProgressDataSafely();
    if (!data?.schedule?.stations?.length) return;
    const lastIndex = data.schedule.stations.length - 1;

    const trackTimes = $$('.track .station .station-time');
    if (trackTimes.length) trackTimes[trackTimes.length - 1].textContent = 'ゴール';

    const upcomingTimes = $$('#upcomingCards .upcoming-card .picture-card-time');
    if (upcomingTimes.length) upcomingTimes[upcomingTimes.length - 1].textContent = 'ゴール';

    const currentTime = $('#currentCardTime');
    if (currentTime && data.activeIndex >= lastIndex) currentTime.textContent = 'ゴール';
  }

  function patchAll() {
    fixLastStationInterval();
    patchEditorEvents();
    patchGuideSkip();
    patchMetrics();
    patchGoalLabels();
  }

  function wrapRender() {
    try {
      if (typeof render !== 'function' || render.__uiuxWrapped) return;
      const originalRender = render;
      render = function wrappedRender(...args) {
        const result = originalRender.apply(this, args);
        setTimeout(patchAll, 0);
        return result;
      };
      render.__uiuxWrapped = true;
    } catch {}
  }

  function boot() {
    wrapRender();
    const editor = $('#stationEditor');
    if (editor) {
      const observer = new MutationObserver(() => setTimeout(patchAll, 0));
      observer.observe(editor, { childList: true, subtree: true });
    }
    patchAll();
    setInterval(patchAll, 1000);
    window.addEventListener('resize', patchAll);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
