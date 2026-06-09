(() => {
  'use strict';

  const storage = window.TrainThreeModeStorage;
  if (!storage || typeof state === 'undefined') {
    console.warn('3モード選択画面を初期化できませんでした。');
    return;
  }

  const MODES = [
    {
      id: 'timer',
      icon: '✅',
      label: 'できた！タイマー',
      description: '「できた！」を押して、自分のペースで進みます。',
      status: '「できた！」を押すと、次の予定へ進みます。'
    },
    {
      id: 'auto',
      icon: '▶️',
      label: '自動タイマー',
      description: '決めた時間が過ぎると、自動的に次へ進みます。',
      status: '選択内容を保存しました。自動進行の動作は次の段階で追加します。'
    },
    {
      id: 'clock',
      icon: '🕐',
      label: '時計にあわせる',
      description: '実際の時計に合わせて、現在の予定を表示します。',
      status: '端末の時計に合わせて、現在の予定を表示します。'
    }
  ];

  const modeById = new Map(MODES.map((mode) => [mode.id, mode]));
  let baseRenderModeControls = null;
  let baseRenderPresetControls = null;
  let baseRenderEditor = null;

  function loadScriptOnce(src, marker) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[${marker}]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') resolve(existing);
        else {
          existing.addEventListener('load', () => resolve(existing), { once:true });
          existing.addEventListener('error', reject, { once:true });
        }
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.setAttribute(marker, 'true');
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve(script);
      }, { once:true });
      script.addEventListener('error', reject, { once:true });
      document.head.appendChild(script);
    });
  }

  async function loadTimeCalculationModules() {
    try {
      await loadScriptOnce('three-mode-time.js', 'data-three-mode-time');
      await loadScriptOnce('three-mode-time-adapter.js', 'data-three-mode-time-adapter');
    } catch (error) {
      console.error('共通時間計算を読み込めませんでした。従来の時間計算を継続します。', error);
    }
  }

  function addStylesheet() {
    if (document.querySelector('link[data-three-mode-ui]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'three-mode-ui.css';
    link.dataset.threeModeUi = 'true';
    document.head.appendChild(link);
  }

  function modeCardContent(mode) {
    return `<span class="mode-choice-icon" aria-hidden="true">${mode.icon}</span>
      <span class="mode-choice-copy">
        <strong>${mode.label}</strong>
        <small>${mode.description}</small>
      </span>
      <span class="mode-choice-check" aria-hidden="true">✓</span>`;
  }

  function configureModeButton(button, mode) {
    if (!button || button.dataset.modeCardConfigured === 'true') return;
    button.className = 'mode-tab mode-card';
    button.type = 'button';
    button.dataset.modeChoice = mode.id;
    button.dataset.modeCardConfigured = 'true';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `${mode.label}。${mode.description}`);
    button.innerHTML = modeCardContent(mode);
  }

  function ensureModeCards() {
    const root = document.querySelector('.mode-tabs');
    if (!root) return null;

    root.classList.add('mode-choice-grid');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', '予定の進み方を選ぶ');

    const timerButton = document.querySelector('#timerModeBtn');
    const clockButton = document.querySelector('#clockModeBtn');
    let autoButton = document.querySelector('#autoModeBtn');

    if (!autoButton) {
      autoButton = document.createElement('button');
      autoButton.id = 'autoModeBtn';
      if (clockButton) root.insertBefore(autoButton, clockButton);
      else root.appendChild(autoButton);
    }

    configureModeButton(timerButton, modeById.get('timer'));
    configureModeButton(autoButton, modeById.get('auto'));
    configureModeButton(clockButton, modeById.get('clock'));

    let status = document.querySelector('#modeSelectionStatus');
    if (!status) {
      status = document.createElement('p');
      status.id = 'modeSelectionStatus';
      status.className = 'mode-selection-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      root.insertAdjacentElement('afterend', status);
    }

    const oldHelp = root.parentElement?.querySelector(':scope > .help');
    if (oldHelp) oldHelp.classList.add('hidden');

    return root;
  }

  function selectedMode() {
    return storage.normalizeMode(state.requestedMode ?? state.mode, 'timer');
  }

  function modeLabel(modeId) {
    return modeById.get(storage.normalizeMode(modeId, 'timer'))?.label || 'できた！タイマー';
  }

  function updatePresetModeBadges() {
    document.querySelectorAll('#presetList .preset-row').forEach((row) => {
      const applyButton = row.querySelector('[data-apply-preset]');
      if (!applyButton) return;
      const preset = state.presets.find((item) => item.id === applyButton.dataset.applyPreset);
      if (!preset) return;

      const small = row.querySelector('small');
      if (!small) return;
      let badge = row.querySelector('.preset-mode-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'preset-mode-badge';
        small.insertAdjacentElement('afterend', badge);
      }
      badge.textContent = modeLabel(preset.defaultMode);
    });
  }

  function updateAutoUnavailableControls(isAuto) {
    const startPlan = document.querySelector('#startPlanBtn');
    const preview = document.querySelector('#previewBtn');

    if (startPlan) {
      startPlan.disabled = isAuto;
      if (isAuto) startPlan.textContent = '自動タイマーは次の段階で開始できます';
      startPlan.title = isAuto ? '現在は自動タイマーの選択と保存まで利用できます' : '';
    }

    if (preview) {
      preview.disabled = isAuto;
      preview.title = isAuto ? '自動タイマーのプレビューは次の段階で追加します' : '';
    }
  }

  function syncModeCards() {
    ensureModeCards();
    const current = selectedMode();
    document.body.dataset.requestedMode = current;

    document.querySelectorAll('[data-mode-choice]').forEach((button) => {
      const active = button.dataset.modeChoice === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const status = document.querySelector('#modeSelectionStatus');
    const mode = modeById.get(current) || modeById.get('timer');
    if (status) {
      status.textContent = mode.status;
      status.classList.toggle('auto-pending', current === 'auto');
    }

    updateAutoUnavailableControls(current === 'auto');
    updatePresetModeBadges();
  }

  function selectMode(modeId) {
    const nextMode = storage.normalizeMode(modeId, 'timer');
    state.requestedMode = nextMode;
    state.mode = nextMode === 'auto' ? 'timer' : nextMode;

    if (nextMode === 'auto') state.uiMode = 'edit';
    if (typeof resetRunState === 'function') resetRunState();
    if (typeof saveState === 'function') saveState();
    if (typeof renderEditor === 'function') renderEditor();
    if (typeof render === 'function') render();
    syncModeCards();

    const mode = modeById.get(nextMode);
    if (typeof announceAccessibleStatus === 'function' && mode) {
      const suffix = nextMode === 'auto' ? '現在は選択と保存まで利用できます。' : '';
      announceAccessibleStatus(`${mode.label}を選びました。${suffix}`, true);
    }
  }

  function installModeSelectionHandler() {
    const root = ensureModeCards();
    if (!root || root.dataset.threeModeHandler === 'true') return;
    root.dataset.threeModeHandler = 'true';

    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mode-choice]');
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      selectMode(button.dataset.modeChoice);
    }, { capture: true });
  }

  function enhanceAutoEditorCopy() {
    if (selectedMode() !== 'auto') return;
    document.querySelectorAll('#stationEditor .edit-subtitle').forEach((element) => {
      element.textContent = '自動タイマーでは、設定した時間が過ぎると次の予定へ進みます。';
    });
  }

  function wrapRenderFunctions() {
    if (typeof renderModeControls === 'function' && !baseRenderModeControls) {
      baseRenderModeControls = renderModeControls;
      renderModeControls = function renderThreeModeControls() {
        baseRenderModeControls();
        syncModeCards();
      };
    }

    if (typeof renderPresetControls === 'function' && !baseRenderPresetControls) {
      baseRenderPresetControls = renderPresetControls;
      renderPresetControls = function renderThreeModePresetControls() {
        baseRenderPresetControls();
        updatePresetModeBadges();
      };
    }

    if (typeof renderEditor === 'function' && !baseRenderEditor) {
      baseRenderEditor = renderEditor;
      renderEditor = function renderThreeModeEditor() {
        baseRenderEditor();
        enhanceAutoEditorCopy();
        syncModeCards();
      };
    }
  }

  addStylesheet();
  ensureModeCards();
  installModeSelectionHandler();
  wrapRenderFunctions();
  syncModeCards();
  loadTimeCalculationModules();

  if (typeof renderPresetControls === 'function') renderPresetControls();
  if (typeof renderEditor === 'function') renderEditor();
  if (typeof render === 'function') render();
})();
