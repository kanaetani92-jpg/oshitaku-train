(() => {
  'use strict';

  const core = window.TrainStage8EditorCore;
  const storage = window.TrainThreeModeStorage;
  if (!core || !storage || typeof state === 'undefined') {
    console.warn('第8段階の編集画面を初期化できませんでした。');
    return;
  }

  const MODE_LABELS = Object.freeze({
    timer:'できた！タイマー',
    auto:'自動タイマー',
    clock:'時計にあわせる'
  });

  let pendingModeSwitch = null;
  let pendingTodoSubmission = null;
  let enhancingEditor = false;

  function selectedMode() {
    return core.normalizeMode(state.requestedMode ?? state.mode, 'timer');
  }

  function modeLabel(mode) {
    return MODE_LABELS[core.normalizeMode(mode, 'timer')] || MODE_LABELS.timer;
  }

  function nextMicrotask(callback) {
    if (typeof queueMicrotask === 'function') queueMicrotask(callback);
    else Promise.resolve().then(callback);
  }

  function mergeRenderedStations(prepared, rendered) {
    return (Array.isArray(rendered) ? rendered : []).map((station, index) => {
      const full = prepared[index] || core.normalizeStation(station, index, selectedMode());
      return {
        ...full,
        ...station,
        timerIntervalMin:full.timerIntervalMin,
        autoIntervalMin:full.autoIntervalMin,
        clockStart:full.clockStart,
        clockEnd:full.clockEnd
      };
    });
  }

  function normalizeStateForCurrentMode({ capture = true } = {}) {
    const mode = selectedMode();
    state.stations = capture
      ? core.captureModeData(state.stations, mode)
      : core.normalizeStations(state.stations, mode);
    state.presets = (Array.isArray(state.presets) ? state.presets : [])
      .map((preset) => core.normalizePreset(preset, preset?.defaultMode ?? 'timer'))
      .filter(Boolean);
    state.todos = (Array.isArray(state.todos) ? state.todos : [])
      .map((todo) => core.normalizeTodo(todo, mode))
      .filter(Boolean);
  }

  if (typeof saveState === 'function') {
    const baseSaveState = saveState;
    saveState = function saveStage8State() {
      try {
        normalizeStateForCurrentMode({ capture:!pendingModeSwitch });
      } catch (error) {
        console.warn('モード別時間を保存用に整理できませんでした。', error);
      }
      return baseSaveState();
    };
  }

  if (typeof normalizePreset === 'function') {
    const baseNormalizePreset = normalizePreset;
    normalizePreset = function normalizeStage8Preset(preset) {
      const defaultMode = core.normalizeMode(preset?.defaultMode ?? preset?.mode, 'timer');
      const sourceStations = core.normalizeStations(preset?.stations, defaultMode);
      const normalized = baseNormalizePreset({ ...preset, defaultMode });
      if (!normalized) return null;
      const renderedStations = Array.isArray(normalized.stations) ? normalized.stations : [];
      const mergedStations = renderedStations.map((station, index) => ({
        ...(sourceStations[index] || {}),
        ...station
      }));
      return core.normalizePreset({
        ...normalized,
        defaultMode,
        stations:mergedStations
      }, defaultMode);
    };
  }

  if (typeof normalizeTodo === 'function') {
    const baseNormalizeTodo = normalizeTodo;
    normalizeTodo = function normalizeStage8Todo(todo) {
      const fallbackMode = pendingTodoSubmission?.mode || selectedMode();
      const defaultMode = core.normalizeMode(todo?.defaultMode ?? todo?.mode, fallbackMode);
      const normalized = baseNormalizeTodo({ ...todo, defaultMode });
      return normalized ? core.normalizeTodo({ ...normalized, defaultMode }, fallbackMode) : null;
    };
  }

  function replaceLabelText(label, text) {
    if (!label) return;
    const node = [...label.childNodes].find((item) => item.nodeType === Node.TEXT_NODE);
    if (node) node.nodeValue = text;
    else label.insertBefore(document.createTextNode(text), label.firstChild || null);
  }

  function ensureEditorNote(mode) {
    const editor = document.querySelector('#stationEditor');
    if (!editor) return;
    let note = document.querySelector('#stage8EditorNote');
    if (!note) {
      note = document.createElement('p');
      note.id = 'stage8EditorNote';
      note.className = 'parent-note stage8-editor-note';
      editor.insertAdjacentElement('beforebegin', note);
    }
    if (mode === 'timer') {
      note.textContent = '予定ごとに、「できた！」を押すまでの目安時間を設定します。最後の予定には次へ進む時間を設定しません。';
    } else if (mode === 'auto') {
      note.textContent = '予定ごとに、自動で次の予定へ移るまでの表示時間を設定します。最後の予定には次へ進む時間を設定しません。';
    } else {
      note.textContent = '各予定を表示する開始時刻と終了時刻を設定します。端末の時計に合わせて表示が切り替わります。';
    }
  }

  function enhanceEditorFields() {
    if (enhancingEditor) return;
    enhancingEditor = true;
    try {
      const mode = selectedMode();
      ensureEditorNote(mode);
      document.querySelectorAll('#stationEditor .station-row').forEach((row) => {
        const interval = row.querySelector('input[data-field="nextIntervalMin"]');
        if (interval) {
          const text = mode === 'auto'
            ? 'この予定を表示する時間（分）'
            : 'この予定に使う時間（分）';
          replaceLabelText(interval.closest('label'), text);
          interval.setAttribute('aria-label', text);
        }

        const arrive = row.querySelector('input[data-field="arrive"]');
        const depart = row.querySelector('input[data-field="depart"]');
        if (arrive) {
          replaceLabelText(arrive.closest('label'), '開始時刻');
          arrive.setAttribute('aria-label', '開始時刻');
        }
        if (depart) {
          replaceLabelText(depart.closest('label'), '終了時刻');
          depart.setAttribute('aria-label', '終了時刻');
        }

        const subtitle = row.querySelector('.edit-subtitle');
        if (subtitle) {
          subtitle.textContent = mode === 'timer'
            ? 'できた！タイマー専用の時間です。自動タイマーの時間とは別に保存されます。'
            : (mode === 'auto'
              ? '自動タイマー専用の時間です。できた！タイマーの時間とは別に保存されます。'
              : '「時計にあわせる」専用の開始時刻と終了時刻です。');
        }
      });
    } finally {
      enhancingEditor = false;
    }
  }

  if (typeof renderEditor === 'function') {
    const baseRenderEditor = renderEditor;
    renderEditor = function renderStage8Editor() {
      const mode = selectedMode();
      const prepared = core.applyModeData(core.normalizeStations(state.stations, mode), mode);
      state.stations = prepared;
      const result = baseRenderEditor();
      state.stations = mergeRenderedStations(prepared, state.stations);
      enhanceEditorFields();
      return result;
    };
  }

  function modeOptions(selected) {
    return Object.entries(MODE_LABELS).map(([value, label]) =>
      `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`
    ).join('');
  }

  function ensureTodoModeField() {
    const newPresetWrap = document.querySelector('#todoNewPresetWrap');
    if (!newPresetWrap) return null;
    let wrap = document.querySelector('#todoDefaultModeWrap');
    if (!wrap) {
      wrap = document.createElement('label');
      wrap.id = 'todoDefaultModeWrap';
      wrap.className = 'stage8-todo-mode-field';
      wrap.innerHTML = '新しい予定を作るときの進み方<select id="todoDefaultMode"></select><small>既存の予定へ追加する場合は、その予定の進み方を維持します。</small>';
      newPresetWrap.insertAdjacentElement('afterend', wrap);
    }
    const select = wrap.querySelector('#todoDefaultMode');
    if (select && !select.options.length) select.innerHTML = modeOptions(selectedMode());
    return select;
  }

  function setTodoFormMode(mode) {
    const select = ensureTodoModeField();
    if (select) select.value = core.normalizeMode(mode, selectedMode());
  }

  function enhanceTodoCards() {
    document.querySelectorAll('#todoList .todo-item[data-todo-id]').forEach((article) => {
      const todo = state.todos.find((item) => item.id === article.dataset.todoId);
      if (!todo) return;
      const mode = core.normalizeMode(todo.defaultMode, selectedMode());
      const main = article.querySelector('.todo-item-main');
      let badge = article.querySelector('.stage8-todo-mode-badge');
      if (!badge && main) {
        badge = document.createElement('span');
        badge.className = 'stage8-todo-mode-badge';
        main.appendChild(badge);
      }
      if (badge) badge.textContent = `新規予定：${modeLabel(mode)}`;

      const controls = article.querySelector('.todo-item-controls');
      if (controls && !controls.querySelector('[data-todo-default-mode]')) {
        const label = document.createElement('label');
        label.className = 'stage8-todo-mode-control';
        label.innerHTML = `新しい予定の進み方<select data-todo-default-mode="${todo.id}">${modeOptions(mode)}</select>`;
        controls.appendChild(label);
      }
    });
  }

  if (typeof renderTodoPage === 'function') {
    const baseRenderTodoPage = renderTodoPage;
    renderTodoPage = function renderStage8TodoPage() {
      const result = baseRenderTodoPage();
      ensureTodoModeField();
      enhanceTodoCards();
      return result;
    };
  }

  if (typeof editTodo === 'function') {
    const baseEditTodo = editTodo;
    editTodo = function editStage8Todo(id) {
      const result = baseEditTodo(id);
      const todo = state.todos.find((item) => item.id === id);
      setTodoFormMode(todo?.defaultMode ?? selectedMode());
      return result;
    };
  }

  if (typeof applyPreset === 'function') {
    const baseApplyPreset = applyPreset;
    applyPreset = function applyStage8Preset(id, options = {}) {
      const preset = state.presets.find((item) => item.id === id);
      const result = baseApplyPreset(id, options);
      if (!result || !preset) return result;
      const mode = core.normalizeMode(preset.defaultMode, 'timer');
      Object.assign(preset, core.normalizePreset(preset, mode));
      state.requestedMode = mode;
      state.mode = mode === 'auto' ? 'timer' : mode;
      state.stations = core.applyModeData(core.normalizeStations(preset.stations, mode), mode);
      if (typeof saveState === 'function') saveState();
      if (typeof renderEditor === 'function') renderEditor();
      if (typeof render === 'function') render();
      return true;
    };
  }

  if (typeof addTodoToPreset === 'function') {
    const baseAddTodoToPreset = addTodoToPreset;
    addTodoToPreset = function addStage8TodoToPreset(id) {
      const todo = state.todos.find((item) => item.id === id);
      const existingIds = new Set(state.presets.map((preset) => preset.id));
      const result = baseAddTodoToPreset(id);
      if (!todo?.linkedPresetId || existingIds.has(todo.linkedPresetId)) return result;
      const preset = state.presets.find((item) => item.id === todo.linkedPresetId);
      if (!preset) return result;
      const mode = core.normalizeMode(todo.defaultMode, selectedMode());
      preset.defaultMode = mode;
      preset.stations = core.applyModeData(core.normalizeStations(preset.stations, mode), mode);
      if (typeof saveState === 'function') saveState();
      if (typeof renderPresetControls === 'function') renderPresetControls();
      if (typeof renderTodoPage === 'function') renderTodoPage();
      return result;
    };
  }

  document.addEventListener('click', (event) => {
    const modeButton = event.target.closest?.('[data-mode-choice], #timerModeBtn, #autoModeBtn, #clockModeBtn');
    if (modeButton) {
      const nextMode = core.normalizeMode(
        modeButton.dataset.modeChoice || (modeButton.id === 'clockModeBtn' ? 'clock' : (modeButton.id === 'autoModeBtn' ? 'auto' : 'timer')),
        'timer'
      );
      const previousMode = selectedMode();
      if (previousMode !== nextMode) {
        state.stations = core.captureModeData(state.stations, previousMode);
        pendingModeSwitch = { previousMode, nextMode };
        nextMicrotask(() => {
          try {
            const resolvedMode = selectedMode();
            state.stations = core.applyModeData(state.stations, resolvedMode);
          } finally {
            pendingModeSwitch = null;
          }
          if (typeof saveState === 'function') saveState();
          if (typeof renderEditor === 'function') renderEditor();
          if (typeof render === 'function') render();
          if (typeof announceAccessibleStatus === 'function') {
            announceAccessibleStatus(`${modeLabel(selectedMode())}の編集内容を表示しました。`, true);
          }
        });
      }
    }

    if (event.target.closest?.('#todoCancelEdit')) {
      nextMicrotask(() => setTodoFormMode(selectedMode()));
    }
  }, { capture:true });

  document.querySelector('#stationEditor')?.addEventListener('input', (event) => {
    const index = Number(event.target.dataset.index);
    const field = event.target.dataset.field;
    if (!Number.isInteger(index) || !field) return;
    const mode = selectedMode();
    if (field === 'nextIntervalMin' && state.stations[index + 1]) {
      const minutes = Math.max(1, core.nonNegativeMinutes(event.target.value, 5));
      if (mode === 'auto') state.stations[index + 1].autoIntervalMin = minutes;
      else state.stations[index + 1].timerIntervalMin = minutes;
    }
    if (field === 'arrive' && state.stations[index]) {
      state.stations[index].clockStart = core.validHHMM(event.target.value, state.stations[index].clockStart);
    }
    if (field === 'depart' && state.stations[index]) {
      state.stations[index].clockEnd = core.validHHMM(event.target.value, state.stations[index].clockEnd);
    }
  });

  const todoForm = document.querySelector('#todoForm');
  todoForm?.addEventListener('submit', () => {
    pendingTodoSubmission = {
      editingId:document.querySelector('#todoEditingId')?.value || '',
      mode:core.normalizeMode(document.querySelector('#todoDefaultMode')?.value, selectedMode())
    };
  }, { capture:true });

  todoForm?.addEventListener('submit', () => {
    const submission = pendingTodoSubmission;
    pendingTodoSubmission = null;
    if (submission?.editingId) {
      const todo = state.todos.find((item) => item.id === submission.editingId);
      if (todo) todo.defaultMode = submission.mode;
    }
    if (typeof saveState === 'function') saveState();
    if (typeof renderTodoPage === 'function') renderTodoPage();
    setTodoFormMode(selectedMode());
  });

  document.addEventListener('change', (event) => {
    const todoId = event.target.dataset?.todoDefaultMode;
    if (todoId) {
      const todo = state.todos.find((item) => item.id === todoId);
      if (!todo) return;
      todo.defaultMode = core.normalizeMode(event.target.value, selectedMode());
      if (typeof saveState === 'function') saveState();
      if (typeof renderTodoPage === 'function') renderTodoPage();
      return;
    }
  });

  document.querySelector('#savePresetBtn')?.addEventListener('click', () => {
    const preset = state.presets.find((item) => item.id === state.currentPresetId);
    if (!preset) return;
    const mode = selectedMode();
    preset.defaultMode = mode;
    preset.stations = core.captureModeData(preset.stations, mode);
    if (typeof saveState === 'function') saveState();
    if (typeof renderPresetControls === 'function') renderPresetControls();
  });

  document.querySelector('#restoreDefaultPresetsBtn')?.addEventListener('click', () => {
    state.presets = state.presets.map((preset) => core.normalizePreset(preset, preset.defaultMode ?? 'timer'));
    if (typeof saveState === 'function') saveState();
    if (typeof renderPresetControls === 'function') renderPresetControls();
  });

  normalizeStateForCurrentMode({ capture:false });
  state.stations = core.applyModeData(state.stations, selectedMode());
  ensureTodoModeField();
  setTodoFormMode(selectedMode());
  if (typeof saveState === 'function') saveState();
  if (typeof renderEditor === 'function') renderEditor();
  if (typeof renderTodoPage === 'function') renderTodoPage();
  if (typeof render === 'function') render();

  window.TrainStage8Editor = Object.freeze({
    selectedMode,
    synchronize() {
      normalizeStateForCurrentMode();
      state.stations = core.applyModeData(state.stations, selectedMode());
      if (typeof renderEditor === 'function') renderEditor();
      if (typeof renderTodoPage === 'function') renderTodoPage();
    }
  });
})();
