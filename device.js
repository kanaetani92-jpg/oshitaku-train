(() => {
  const STATE_KEYS = ['oshitakuTrainNoPhotoStateV16', 'oshitakuTrainNoPhotoStateV18'];

  function fixLastStationInterval() {
    const editor = document.getElementById('stationEditor');
    if (!editor) return;
    const rows = Array.from(editor.querySelectorAll('.station-row'));
    rows.forEach((row) => row.querySelectorAll('.last-station-no-interval').forEach((note) => note.remove()));
    const lastRow = rows[rows.length - 1];
    if (!lastRow) return;
    const input = lastRow.querySelector('input[data-field="intervalMin"], input[data-field="nextIntervalMin"]');
    if (!input) return;
    const label = input.closest('label');
    const target = label?.parentElement || lastRow.querySelector('.station-edit-grid.three') || lastRow.querySelector('.station-edit-body');
    if (label) label.remove();
    const note = document.createElement('div');
    note.className = 'last-station-no-interval';
    note.textContent = 'さいごの駅です。次の駅までの時間はありません。';
    target?.appendChild(note);
  }

  function finalStationNameFromTrack() {
    const stations = Array.from(document.querySelectorAll('#track .station'));
    const last = stations[stations.length - 1];
    if (!last) return '';
    const label = last.querySelector('.station-label');
    if (!label) return '';
    return String(label.childNodes[0]?.textContent || '').replace(/駅$/, '').trim();
  }

  function patchGoalLabels() {
    const stations = Array.from(document.querySelectorAll('#track .station'));
    const lastStation = stations[stations.length - 1];
    if (lastStation) {
      const time = lastStation.querySelector('.station-time');
      if (time) time.textContent = 'ゴール';
    }

    const upcomingCards = Array.from(document.querySelectorAll('#upcomingCards .upcoming-card'));
    const lastUpcoming = upcomingCards[upcomingCards.length - 1];
    if (lastUpcoming) {
      const time = lastUpcoming.querySelector('.picture-card-time');
      if (time) time.textContent = 'ゴール';
    }

    const finalName = finalStationNameFromTrack();
    const currentName = document.getElementById('currentCardName')?.textContent?.trim() || '';
    const currentTime = document.getElementById('currentCardTime');
    if (finalName && currentName === finalName && currentTime) currentTime.textContent = 'ゴール';
  }

  function patchMetricLabels() {
    const nextLabel = document.getElementById('nextMetric')?.previousElementSibling;
    const doneLabel = document.getElementById('percentMetric')?.previousElementSibling;
    if (nextLabel) nextLabel.textContent = 'つぎの予定まで';
    if (doneLabel) doneLabel.textContent = 'できた';
  }

  function patchGuideSkip() {
    const close = document.getElementById('guideCloseBtn');
    const skip = document.getElementById('guideSkip');
    if (!close || !skip || close.dataset.devicePatch === '1') return;
    close.dataset.devicePatch = '1';
    close.addEventListener('click', () => {
      setTimeout(() => {
        STATE_KEYS.forEach((key) => {
          try {
            const state = JSON.parse(localStorage.getItem(key) || '{}');
            state.seenGuide = Boolean(skip.checked);
            localStorage.setItem(key, JSON.stringify(state));
          } catch {}
        });
      }, 0);
    }, true);
  }

  function patchAll() {
    fixLastStationInterval();
    patchGoalLabels();
    patchMetricLabels();
    patchGuideSkip();
  }

  function boot() {
    const editor = document.getElementById('stationEditor');
    if (editor) {
      const observer = new MutationObserver(fixLastStationInterval);
      observer.observe(editor, { childList: true, subtree: true });
    }
    const appRoot = document.querySelector('.app');
    if (appRoot) {
      const observer = new MutationObserver(patchAll);
      observer.observe(appRoot, { childList: true, subtree: true, characterData: true });
    }
    patchAll();
    setInterval(patchAll, 1000);
    window.addEventListener('resize', patchAll);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
