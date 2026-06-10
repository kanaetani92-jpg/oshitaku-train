(() => {
  'use strict';

  function initialize() {
    const core = window.TrainClockModeCore;
    const storage = window.TrainThreeModeStorage;
    if (!core || !storage || typeof state === 'undefined') {
      console.warn('時計にあわせるモードを初期化できませんでした。');
      return;
    }
    if (typeof normalizedClockSchedule !== 'function') {
      console.warn('時計にあわせるモードに必要な時刻計算が見つかりませんでした。');
      return;
    }

    const legacyCheckStationEvents = typeof checkStationEvents === 'function' ? checkStationEvents : null;
    let lastAnnouncementKey = '';

    function requestedMode() {
      return storage.normalizeMode(state.requestedMode ?? state.mode, 'timer');
    }

    function isClock() {
      return requestedMode() === 'clock' && state.mode === 'clock';
    }

    function schedule() {
      return normalizedClockSchedule();
    }

    function snapshot(currentSchedule = schedule(), now = new Date()) {
      return core.snapshot(currentSchedule, now);
    }

    function escapeText(value) {
      if (typeof escapeHtml === 'function') return escapeHtml(value);
      return String(value ?? '').replace(/[&<>\"]/g, (character) => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'
      }[character]));
    }

    function visual(station, className = 'picture-card-icon') {
      if (typeof visualHtml === 'function') return visualHtml(station, className);
      return `<span class="${className}">${escapeText(station?.icon || '⭐')}</span>`;
    }

    function setText(selector, value) {
      const element = document.querySelector(selector);
      const text = String(value ?? '');
      if (element && element.textContent !== text) element.textContent = text;
      return element;
    }

    function setHtml(selector, value) {
      const element = document.querySelector(selector);
      const html = String(value ?? '');
      if (element && element.innerHTML !== html) element.innerHTML = html;
      return element;
    }

    function formatRemaining(milliseconds) {
      const totalSeconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
      if (!state.showNumbers) {
        const minutes = totalSeconds / 60;
        if (minutes <= 1) return 'あと少し';
        if (minutes <= 5) return 'もうすぐ';
        return 'まっています';
      }
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function phaseLabel(clockSnapshot) {
      if (clockSnapshot.phase === 'before') return '開始前';
      if (clockSnapshot.phase === 'active') return '予定中';
      if (clockSnapshot.phase === 'between') return '予定のあいだ';
      return '時間終了';
    }

    function positionCount(clockSnapshot) {
      if (clockSnapshot.phase === 'before') return 0;
      if (clockSnapshot.phase === 'active') return clockSnapshot.activeIndex + 1;
      if (clockSnapshot.phase === 'between') return Math.max(0, clockSnapshot.previousIndex + 1);
      return clockSnapshot.count;
    }

    function updateCurrentCard(currentSchedule, clockSnapshot) {
      const station = currentSchedule.stations[clockSnapshot.displayIndex] || currentSchedule.stations[0];
      if (!station) return;

      setHtml('#currentCardVisual', visual(station));
      setText('#currentCardName', station.name);

      if (clockSnapshot.phase === 'before') {
        setText('#currentCardKicker', 'つぎの予定');
        setText('#currentCardTime', `${station.arrive || station.depart}から`);
      } else if (clockSnapshot.phase === 'active') {
        setText('#currentCardKicker', 'いまの予定');
        setText('#currentCardTime', `${station.depart}まで`);
      } else if (clockSnapshot.phase === 'between') {
        setText('#currentCardKicker', 'つぎの予定');
        setText('#currentCardTime', `${station.arrive}から`);
      } else {
        setText('#currentCardKicker', '時間終了');
        setText('#currentCardTime', '予定終了');
      }

      const currentCard = document.querySelector('#currentCard');
      if (currentCard) currentCard.setAttribute('aria-label', `${phaseLabel(clockSnapshot)}、${station.name}`);
    }

    function updateStatus(currentSchedule, clockSnapshot) {
      const displayStation = currentSchedule.stations[clockSnapshot.displayIndex] || currentSchedule.stations[0];
      const timeLabel = document.querySelector('#timeBox small');
      const remaining = document.querySelector('#remainingText');

      if (clockSnapshot.phase === 'before') {
        if (timeLabel) timeLabel.textContent = 'はじまるまで';
        if (remaining) remaining.textContent = formatRemaining(clockSnapshot.remainingMs);
        setText('#nextBox', `${displayStation.arrive || displayStation.depart}から「${displayStation.name}」です`);
      } else if (clockSnapshot.phase === 'active') {
        if (timeLabel) timeLabel.textContent = 'この予定ののこり';
        if (remaining) remaining.textContent = formatRemaining(clockSnapshot.remainingMs);
        setText('#nextBox', `いまは「${displayStation.name}」の時間です`);
      } else if (clockSnapshot.phase === 'between') {
        if (timeLabel) timeLabel.textContent = 'つぎまで';
        if (remaining) remaining.textContent = formatRemaining(clockSnapshot.remainingMs);
        setText('#nextBox', `つぎは${displayStation.arrive}から「${displayStation.name}」です`);
      } else {
        if (timeLabel) timeLabel.textContent = '終了';
        if (remaining) remaining.textContent = '時間終了';
        setText('#nextBox', 'この予定は終了しました。おつかれさまでした');
      }

      document.querySelector('#timeBox')?.classList.toggle('hidden', !state.showNumbers);
      document.querySelector('#slowBadge')?.classList.remove('show');
      document.querySelector('#nextBox')?.classList.remove('slow');
    }

    function updateMetrics(currentSchedule, clockSnapshot) {
      const displayStation = currentSchedule.stations[clockSnapshot.displayIndex] || currentSchedule.stations[0];
      const metrics = document.querySelectorAll('.progress-panel .metric');
      const count = positionCount(clockSnapshot);

      if (metrics[0]?.querySelector('span')) metrics[0].querySelector('span').textContent = '現在';
      if (metrics[1]?.querySelector('span')) metrics[1].querySelector('span').textContent = 'つぎ';
      if (metrics[2]?.querySelector('span')) metrics[2].querySelector('span').textContent = '予定';

      if (clockSnapshot.phase === 'before') {
        setText('#nowMetric', '開始前');
        setText('#nextMetric', `${displayStation.arrive || displayStation.depart}から`);
      } else if (clockSnapshot.phase === 'active') {
        setText('#nowMetric', `${displayStation.name}\n${displayStation.depart}まで`);
        const next = clockSnapshot.nextIndex >= 0 ? currentSchedule.stations[clockSnapshot.nextIndex] : null;
        setText('#nextMetric', next ? `${next.arrive}から\n${next.name}` : 'この予定が最後');
      } else if (clockSnapshot.phase === 'between') {
        setText('#nowMetric', '予定のあいだ');
        setText('#nextMetric', `${displayStation.arrive}から\n${displayStation.name}`);
      } else {
        setText('#nowMetric', '時間終了');
        setText('#nextMetric', '終了');
      }
      setText('#percentMetric', `${count}/${clockSnapshot.count}`);
    }

    function updateUpcoming(currentSchedule, clockSnapshot) {
      const root = document.querySelector('#upcomingCards');
      const title = document.querySelector('.upcoming-title');
      if (!root) return;

      let startIndex;
      if (clockSnapshot.phase === 'active') startIndex = clockSnapshot.activeIndex + 1;
      else if (clockSnapshot.phase === 'before' || clockSnapshot.phase === 'between') startIndex = clockSnapshot.displayIndex + 1;
      else startIndex = currentSchedule.stations.length;

      const items = currentSchedule.stations.slice(Math.max(0, startIndex));
      if (title) title.textContent = clockSnapshot.phase === 'ended' ? '予定は終了しました' : 'これからすること';

      if (!items.length) {
        root.innerHTML = clockSnapshot.phase === 'ended'
          ? '<div class="upcoming-empty">この予定は終了しました ⏰</div>'
          : '<div class="upcoming-empty">この予定が最後です</div>';
        return;
      }

      root.innerHTML = items.map((station) => `
        <div class="picture-card upcoming-card">
          ${visual(station)}
          <span class="picture-card-name">${escapeText(station.name)}</span>
          <span class="picture-card-time">${escapeText(station.arrive)}から</span>
        </div>`).join('');
    }

    function updateTrack(currentSchedule, clockSnapshot) {
      document.querySelectorAll('#track .station').forEach((element, index) => {
        const station = currentSchedule.stations[index];
        const current = clockSnapshot.phase === 'active' && index === clockSnapshot.activeIndex;
        const next = (clockSnapshot.phase === 'before' || clockSnapshot.phase === 'between') && index === clockSnapshot.nextIndex;
        const passed = clockSnapshot.phase === 'ended' || index <= clockSnapshot.reachedIndex;

        element.classList.remove('done', 'late');
        element.classList.toggle('reached', passed && !current);
        element.classList.toggle('current', current || next);
        if (current || next) element.setAttribute('aria-current', 'step');
        else element.removeAttribute('aria-current');

        const label = clockSnapshot.phase === 'ended'
          ? '時間終了'
          : (current ? '現在の予定' : (next ? '次の予定' : (passed ? '時刻通過済み' : 'これから')));
        element.dataset.stationState = label;
        element.setAttribute('aria-label', `${station?.name || '予定'}駅、${label}`);
      });

      const percent = Math.max(0, Math.min(100, clockSnapshot.position * 100));
      const vehicle = document.querySelector('#vehicle');
      if (vehicle) {
        vehicle.style.left = `${percent}%`;
        vehicle.style.setProperty('--vehicle-left', `${percent}%`);
        vehicle.style.setProperty('--mobile-vehicle-top', `${percent}%`);
      }
      document.querySelector('#trackDone')?.style.setProperty('--progress', `${percent}%`);
    }

    function updateControls() {
      document.querySelector('#timerControls')?.classList.add('hidden');
      const startPlan = document.querySelector('#startPlanBtn');
      const preview = document.querySelector('#previewBtn');
      const sort = document.querySelector('#sortBtn');

      if (startPlan) {
        startPlan.disabled = false;
        startPlan.textContent = 'この予定を見る';
        startPlan.title = '現在時刻に合った予定を表示します';
      }
      if (preview) {
        preview.disabled = false;
        preview.title = '現在時刻に合った表示を確認します';
      }
      if (sort) {
        sort.disabled = false;
        sort.title = '到着時刻の早い順に並べます';
      }

      document.querySelectorAll('#stationEditor .edit-subtitle').forEach((element) => {
        element.textContent = '「時計にあわせる」では、開始時刻と終了時刻を使います。';
      });
    }

    function updateCompletion(clockSnapshot) {
      const completion = document.querySelector('#completion');
      if (!completion) return;
      const ended = clockSnapshot.phase === 'ended';
      completion.textContent = '⏰ この予定は終了しました。おつかれさまでした。';
      completion.classList.toggle('show', ended);
      completion.setAttribute('aria-hidden', ended ? 'false' : 'true');
    }

    function hideDoneAction() {
      const doneButton = document.querySelector('#doneBtn');
      if (doneButton) {
        doneButton.hidden = true;
        doneButton.setAttribute('aria-hidden', 'true');
        doneButton.tabIndex = -1;
      }
    }

    function restoreNonClockUi() {
      delete document.body.dataset.clockPhase;
      if (requestedMode() === 'auto') return;
      const doneButton = document.querySelector('#doneBtn');
      if (doneButton) {
        doneButton.hidden = false;
        doneButton.removeAttribute('aria-hidden');
        doneButton.removeAttribute('tabindex');
      }
    }

    function handleAnnouncements(currentSchedule, clockSnapshot) {
      let key = '';
      let message = '';
      if (clockSnapshot.phase === 'active') {
        const station = currentSchedule.stations[clockSnapshot.activeIndex];
        key = `active:${clockSnapshot.activeIndex}:${station?.depart || ''}`;
        message = `${station?.name || '予定'}の時間です。`;
      } else if (clockSnapshot.phase === 'ended') {
        key = 'ended';
        message = 'この予定は終了しました。おつかれさまでした。';
      }

      if (!key || key === lastAnnouncementKey) return;
      lastAnnouncementKey = key;
      if (typeof announceAccessibleStatus === 'function') announceAccessibleStatus(message, true);
      if (clockSnapshot.phase === 'active') {
        const station = currentSchedule.stations[clockSnapshot.activeIndex];
        if (station && typeof announceStation === 'function') announceStation(station, false);
      }
    }

    function synchronize({ announce = true } = {}) {
      if (!isClock()) {
        restoreNonClockUi();
        return null;
      }

      const currentSchedule = schedule();
      const clockSnapshot = snapshot(currentSchedule);
      document.body.dataset.clockPhase = clockSnapshot.phase;

      updateStatus(currentSchedule, clockSnapshot);
      updateCurrentCard(currentSchedule, clockSnapshot);
      updateMetrics(currentSchedule, clockSnapshot);
      updateUpcoming(currentSchedule, clockSnapshot);
      updateTrack(currentSchedule, clockSnapshot);
      updateControls();
      updateCompletion(clockSnapshot);
      hideDoneAction();
      if (announce) handleAnnouncements(currentSchedule, clockSnapshot);
      return clockSnapshot;
    }

    if (legacyCheckStationEvents) {
      checkStationEvents = function checkStationEventsWithClock(data, allDone) {
        if (!isClock()) return legacyCheckStationEvents(data, allDone);
        synchronize({ announce:true });
      };
    }

    document.querySelector('#doneBtn')?.addEventListener('click', (event) => {
      if (!isClock()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, { capture:true });

    window.TrainClockMode = Object.freeze({
      isActive: isClock,
      synchronize,
      snapshot() {
        const currentSchedule = schedule();
        return snapshot(currentSchedule);
      }
    });

    if (isClock()) synchronize({ announce:false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once:true });
  } else {
    initialize();
  }
})();
