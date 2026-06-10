(() => {
  'use strict';

  const core = window.TrainStage8EditorCore;
  if (!core || typeof state === 'undefined') {
    console.warn('To Doの進み方表示を初期化できませんでした。');
    return;
  }

  function selectedMode() {
    return core.normalizeMode(state.requestedMode ?? state.mode, 'timer');
  }

  function synchronizeTodoModeVisibility() {
    const target = document.querySelector('#todoTargetPreset');
    const formMode = document.querySelector('#todoDefaultModeWrap');
    if (formMode) formMode.hidden = target?.value !== 'new';

    document.querySelectorAll('#todoList .todo-item[data-todo-id]').forEach((article) => {
      const todo = state.todos.find((item) => item.id === article.dataset.todoId);
      const createsNewSchedule = todo?.status === 'inbox' && todo.targetPresetId === 'new';
      const badge = article.querySelector('.stage8-todo-mode-badge');
      const control = article.querySelector('.stage8-todo-mode-control');

      if (!createsNewSchedule) {
        badge?.remove();
        control?.remove();
      }
    });
  }

  if (typeof renderTodoPage === 'function') {
    const baseRenderTodoPage = renderTodoPage;
    renderTodoPage = function renderStage8TodoVisibility() {
      const result = baseRenderTodoPage();
      synchronizeTodoModeVisibility();
      return result;
    };
  }

  document.querySelector('#todoTargetPreset')?.addEventListener('change', () => {
    synchronizeTodoModeVisibility();
  });

  document.querySelector('#todoList')?.addEventListener('change', (event) => {
    if (!event.target.dataset.todoTarget) return;
    queueMicrotask(() => synchronizeTodoModeVisibility());
  });

  synchronizeTodoModeVisibility();

  window.TrainStage8Todo = Object.freeze({
    selectedMode,
    synchronize:synchronizeTodoModeVisibility
  });
})();
