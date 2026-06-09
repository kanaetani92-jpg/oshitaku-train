(() => {
  'use strict';

  const STORAGE_SCHEMA_VERSION = 21;
  const STORAGE_KEY = 'oshitakuTrainNoPhotoStateV21';
  const LEGACY_STORAGE_KEYS = [
    'oshitakuTrainNoPhotoStateV20',
    'oshitakuTrainNoPhotoStateV19',
    'oshitakuTrainNoPhotoStateV18',
    'oshitakuTrainNoPhotoStateV17',
    'oshitakuTrainNoPhotoState'
  ];
  const ALLOWED_MODES = ['timer', 'auto', 'clock'];
  const MODE_ALIASES = {
    timer: 'timer',
    manual: 'timer',
    done: 'timer',
    auto: 'auto',
    automatic: 'auto',
    schedule: 'auto',
    clock: 'clock',
    today: 'clock',
    realtime: 'clock'
  };

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      console.warn('3モード保存データを複製できませんでした。', error);
      return null;
    }
  }

  function normalizeMode(value, fallback = 'timer') {
    const normalized = MODE_ALIASES[String(value || '').toLowerCase()];
    if (ALLOWED_MODES.includes(normalized)) return normalized;
    const normalizedFallback = MODE_ALIASES[String(fallback || '').toLowerCase()];
    return ALLOWED_MODES.includes(normalizedFallback) ? normalizedFallback : 'timer';
  }

  function normalizePresetMode(preset, fallbackMode = 'timer') {
    if (!preset || typeof preset !== 'object') return preset;
    const normalized = { ...preset };
    normalized.defaultMode = normalizeMode(
      preset.defaultMode ?? preset.mode,
      fallbackMode
    );
    return normalized;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      console.warn(`保存データ「${key}」を読み込めませんでした。`, error);
      return null;
    }
  }

  function readNewestState() {
    const current = readJson(STORAGE_KEY);
    if (current) return { value: current, sourceKey: STORAGE_KEY };

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = readJson(key);
      if (legacy) return { value: legacy, sourceKey: key };
    }
    return { value: null, sourceKey: '' };
  }

  function normalizeRuntimeState(source, fallbackState) {
    const fallback = clone(fallbackState) || {};
    const incoming = clone(source) || {};
    const merged = { ...fallback, ...incoming };

    const requestedMode = normalizeMode(
      incoming.requestedMode ?? incoming.mode,
      fallback.requestedMode ?? fallback.mode ?? 'timer'
    );

    // 第2段階では自動タイマーの画面と進行処理は未実装です。
    // auto の希望値は保持しつつ、利用画面では安全な timer として開きます。
    merged.requestedMode = requestedMode;
    merged.mode = requestedMode === 'auto' ? 'timer' : requestedMode;

    // モード情報を持たない旧プリセットは、従来どおり timer として移行します。
    const sourcePresets = Array.isArray(incoming.presets)
      ? incoming.presets
      : (Array.isArray(fallback.presets) ? fallback.presets : []);
    merged.presets = sourcePresets
      .map((preset) => normalizePresetMode(preset, 'timer'))
      .filter(Boolean);

    merged.autoRunning = incoming.autoRunning === true;
    merged.autoStartedAt = Number.isFinite(Number(incoming.autoStartedAt))
      ? Number(incoming.autoStartedAt)
      : null;
    merged.autoPausedElapsedMs = Math.max(
      0,
      Number.isFinite(Number(incoming.autoPausedElapsedMs))
        ? Number(incoming.autoPausedElapsedMs)
        : 0
    );

    if (!merged.autoRunning) merged.autoStartedAt = null;
    if (merged.autoRunning && !merged.autoStartedAt) merged.autoRunning = false;

    merged.schemaVersion = STORAGE_SCHEMA_VERSION;
    return merged;
  }

  function prepareStateForStorage(currentState) {
    const prepared = clone(currentState) || {};
    const activeMode = normalizeMode(prepared.mode, 'timer');
    const requestedMode = normalizeMode(prepared.requestedMode, activeMode);

    prepared.mode = activeMode === 'auto' ? 'timer' : activeMode;
    prepared.requestedMode = requestedMode;
    prepared.presets = (Array.isArray(prepared.presets) ? prepared.presets : [])
      .map((preset) => normalizePresetMode(preset, 'timer'))
      .filter(Boolean);
    prepared.autoRunning = prepared.autoRunning === true;
    prepared.autoStartedAt = Number.isFinite(Number(prepared.autoStartedAt))
      ? Number(prepared.autoStartedAt)
      : null;
    prepared.autoPausedElapsedMs = Math.max(
      0,
      Number.isFinite(Number(prepared.autoPausedElapsedMs))
        ? Number(prepared.autoPausedElapsedMs)
        : 0
    );
    if (!prepared.autoRunning) prepared.autoStartedAt = null;
    if (prepared.autoRunning && !prepared.autoStartedAt) prepared.autoRunning = false;
    prepared.schemaVersion = STORAGE_SCHEMA_VERSION;
    return prepared;
  }

  window.TrainThreeModeStorage = Object.freeze({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    storageKey: STORAGE_KEY,
    allowedModes: Object.freeze([...ALLOWED_MODES]),
    normalizeMode,
    normalizePresetMode,
    normalizeState: normalizeRuntimeState,
    prepareStateForStorage
  });

  if (typeof state === 'undefined') {
    console.warn('3モード保存モジュールを初期化できませんでした。');
    return;
  }

  if (typeof initialPresets !== 'undefined' && Array.isArray(initialPresets)) {
    initialPresets.forEach((preset) => {
      preset.defaultMode = normalizeMode(preset.defaultMode, 'timer');
    });
  }

  const saved = readNewestState();
  // V20以前は app.js が既に移行・検証した state を利用します。
  // V21が存在するときだけ、V21を現在のstateへ重ねます。
  const sourceForRuntime = saved.sourceKey === STORAGE_KEY ? saved.value : state;
  state = normalizeRuntimeState(sourceForRuntime, state);

  // V21用の保存処理へ切り替えます。V20以前のキーは削除せず、
  // 問題が起きた場合に戻せる移行元として残します。
  saveState = function saveThreeModeState() {
    try {
      const prepared = prepareStateForStorage(state);
      Object.assign(state, prepared);
      const json = JSON.stringify(prepared);

      if (typeof lastSavedJson !== 'undefined' && json === lastSavedJson) {
        if (typeof updateSaveStatus === 'function') updateSaveStatus();
        return true;
      }

      localStorage.setItem(STORAGE_KEY, json);
      if (typeof lastSavedJson !== 'undefined') lastSavedJson = json;
      if (typeof updateSaveStatus === 'function') updateSaveStatus();
      return true;
    } catch (error) {
      console.error('3モード対応の設定を保存できませんでした。', error);
      if (typeof updateSaveStatus === 'function') updateSaveStatus('保存できませんでした', true);
      if (typeof announceAccessibleStatus === 'function') {
        announceAccessibleStatus('設定を保存できませんでした。ブラウザーの保存設定や空き容量を確認してください。', true);
      }
      return false;
    }
  };

  if (typeof normalizePreset === 'function') {
    const baseNormalizePreset = normalizePreset;
    normalizePreset = function normalizeThreeModePreset(preset) {
      const normalized = baseNormalizePreset(preset);
      return normalized
        ? normalizePresetMode(normalized, preset?.defaultMode ?? preset?.mode ?? 'timer')
        : null;
    };
  }

  // 既存のモード選択では、app.jsの処理より先に希望モードを同期します。
  document.querySelector('#timerModeBtn')?.addEventListener('click', () => {
    state.requestedMode = 'timer';
  }, { capture:true });
  document.querySelector('#clockModeBtn')?.addEventListener('click', () => {
    state.requestedMode = 'clock';
  }, { capture:true });

  // 新しく保存したプリセットには、保存時点の進み方を標準モードとして付けます。
  const savePresetButton = document.querySelector('#savePresetBtn');
  savePresetButton?.addEventListener('click', () => {
    const preset = state.presets.find((item) => item.id === state.currentPresetId);
    if (!preset) return;
    preset.defaultMode = normalizeMode(state.requestedMode ?? state.mode, 'timer');
    saveState();
    if (typeof renderPresetControls === 'function') renderPresetControls();
  });

  // 一覧、To Do、初回ガイドなど、どの経路からプリセットを開いても
  // 保存された標準モードを復元します。
  if (typeof applyPreset === 'function') {
    const baseApplyPreset = applyPreset;
    applyPreset = function applyThreeModePreset(id, options = {}) {
      const preset = state.presets.find((item) => item.id === id);
      const applied = baseApplyPreset(id, options);
      if (!applied || !preset) return applied;

      const requestedMode = normalizeMode(preset.defaultMode, 'timer');
      state.requestedMode = requestedMode;
      state.mode = requestedMode === 'auto' ? 'timer' : requestedMode;
      saveState();
      if (typeof renderEditor === 'function') renderEditor();
      if (typeof render === 'function') render();
      return true;
    };
  }

  // V20以前から読み込んだ場合も、初回読み込み時にV21へ保存します。
  saveState();

  if (typeof renderEditor === 'function') renderEditor();
  if (typeof renderTodoPage === 'function') renderTodoPage();
  if (typeof render === 'function') render();

  if (saved.sourceKey && saved.sourceKey !== STORAGE_KEY) {
    console.info(`保存データを「${saved.sourceKey}」からV${STORAGE_SCHEMA_VERSION}へ移行しました。`);
  }
})();
