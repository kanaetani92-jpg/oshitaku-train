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
    note.textContent = 'さいごの駅です。駅間分はありません。';
    target?.appendChild(note);
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

  function boot() {
    const editor = document.getElementById('stationEditor');
    if (editor) {
      const observer = new MutationObserver(fixLastStationInterval);
      observer.observe(editor, { childList: true, subtree: true });
    }
    fixLastStationInterval();
    patchGuideSkip();
    window.addEventListener('resize', fixLastStationInterval);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
