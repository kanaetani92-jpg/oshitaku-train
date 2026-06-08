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

  function patchGuideSkip() {
    const close = document.getElementById('guideCloseBtn');
    const skip = document.getElementById('guideSkip');
    if (!close || !skip || close.dataset.uiuxPatch === '1') return;
    close.dataset.uiuxPatch = '1';
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

  function patchMetrics() {
    const labels = Array.from(document.querySelectorAll('.metric span'));
    labels.forEach((label) => {
      const text = label.textContent.trim();
      if (text === 'つぎの予定') label.textContent = 'つぎの予定まで';
      if (text === 'すすみぐあい') label.textContent = 'できた';
    });
  }

  function boot() {
    const editor = document.getElementById('stationEditor');
    if (editor) {
      const observer = new MutationObserver(() => {
        fixLastStationInterval();
        patchMetrics();
      });
      observer.observe(editor, { childList: true, subtree: true });
    }
    const metricObserver = new MutationObserver(patchMetrics);
    metricObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    fixLastStationInterval();
    patchGuideSkip();
    patchMetrics();
    window.addEventListener('resize', fixLastStationInterval);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
