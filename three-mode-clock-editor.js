(() => {
  'use strict';

  const storage = window.TrainThreeModeStorage;
  if (!storage || typeof state === 'undefined') {
    console.warn('時計にあわせる用の編集画面を初期化できませんでした。');
    return;
  }

  let observer = null;
  let syncing = false;

  function requestedMode() {
    return storage.normalizeMode(state.requestedMode ?? state.mode, 'timer');
  }

  function isClock() {
    return requestedMode() === 'clock';
  }

  function replaceLabelText(label, text) {
    if (!label) return;
    const firstTextNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (firstTextNode) {
      if (firstTextNode.nodeValue !== text) firstTextNode.nodeValue = text;
      return;
    }
    label.insertBefore(document.createTextNode(text), label.firstChild || null);
  }

  function setLateSettingsHidden(hidden) {
    const graceLabel = document.querySelector('#lateGraceInput')?.closest('label');
    const behaviorLabel = document.querySelector('#lateBehaviorSelect')?.closest('label');
    [graceLabel, behaviorLabel].forEach((label) => {
      if (label && label.hidden !== hidden) label.hidden = hidden;
    });
  }

  function updateClockTimeLabels() {
    document.querySelectorAll('#stationEditor .station-row').forEach((row) => {
      const inputs = row.querySelectorAll('input[type="time"]');
      if (!inputs.length) return;
      replaceLabelText(inputs[0]?.closest('label'), '開始時刻');
      replaceLabelText(inputs[1]?.closest('label'), '終了時刻');
    });
  }

  function clearLegacyCompletionEffects() {
    const confetti = document.querySelector('#confetti');
    if (confetti?.childElementCount) confetti.innerHTML = '';
  }

  function synchronize() {
    if (syncing) return;
    syncing = true;
    try {
      const clock = isClock();
      setLateSettingsHidden(clock);
      if (clock) {
        updateClockTimeLabels();
        clearLegacyCompletionEffects();
      }
    } finally {
      syncing = false;
    }
  }

  observer = new MutationObserver(() => synchronize());
  observer.observe(document.body, {
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['data-requested-mode', 'hidden']
  });

  window.TrainClockEditor = Object.freeze({
    isActive: isClock,
    synchronize
  });

  synchronize();
})();
