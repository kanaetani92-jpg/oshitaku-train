const assert = require('node:assert/strict');
const editor = require('../three-mode-editor-core.js');

const legacy = [
  { id:'a', name:'おうち', intervalMin:0, arrive:'07:30', depart:'07:30' },
  { id:'b', name:'きがえ', intervalMin:5, arrive:'07:35', depart:'07:38' },
  { id:'c', name:'ごはん', intervalMin:10, arrive:'07:45', depart:'07:50' }
];

const migrated = editor.normalizeStations(legacy, 'timer');
assert.equal(migrated[0].timerIntervalMin, 0);
assert.equal(migrated[0].autoIntervalMin, 0);
assert.equal(migrated[1].timerIntervalMin, 5);
assert.equal(migrated[1].autoIntervalMin, 5);
assert.equal(migrated[2].timerIntervalMin, 10);
assert.equal(migrated[2].autoIntervalMin, 10);
assert.equal(migrated[1].clockStart, '07:35');
assert.equal(migrated[1].clockEnd, '07:38');

const timerEdited = editor.captureModeData([
  migrated[0],
  { ...migrated[1], intervalMin:7 },
  { ...migrated[2], intervalMin:12 }
], 'timer');
assert.equal(timerEdited[1].timerIntervalMin, 7);
assert.equal(timerEdited[1].autoIntervalMin, 5);
assert.equal(timerEdited[2].timerIntervalMin, 12);
assert.equal(timerEdited[2].autoIntervalMin, 10);

const autoView = editor.applyModeData(timerEdited, 'auto');
assert.equal(autoView[1].intervalMin, 5);
assert.equal(autoView[2].intervalMin, 10);

const autoEdited = editor.captureModeData([
  autoView[0],
  { ...autoView[1], intervalMin:3 },
  { ...autoView[2], intervalMin:8 }
], 'auto');
assert.equal(autoEdited[1].timerIntervalMin, 7);
assert.equal(autoEdited[1].autoIntervalMin, 3);
assert.equal(autoEdited[2].timerIntervalMin, 12);
assert.equal(autoEdited[2].autoIntervalMin, 8);

const timerRestored = editor.applyModeData(autoEdited, 'timer');
assert.equal(timerRestored[1].intervalMin, 7);
assert.equal(timerRestored[2].intervalMin, 12);

const clockEdited = editor.captureModeData([
  { ...timerRestored[0], arrive:'08:00', depart:'08:05' },
  { ...timerRestored[1], arrive:'08:10', depart:'08:20' },
  { ...timerRestored[2], arrive:'08:25', depart:'08:30' }
], 'clock');
assert.equal(clockEdited[0].clockStart, '08:00');
assert.equal(clockEdited[0].clockEnd, '08:05');
assert.equal(clockEdited[1].clockStart, '08:10');
assert.equal(clockEdited[1].clockEnd, '08:20');

const autoRestored = editor.applyModeData(clockEdited, 'auto');
assert.equal(autoRestored[1].intervalMin, 3);
assert.equal(autoRestored[1].arrive, '08:10');
assert.equal(autoRestored[1].depart, '08:20');

const clockRestored = editor.applyModeData(autoRestored, 'clock');
assert.equal(clockRestored[2].arrive, '08:25');
assert.equal(clockRestored[2].depart, '08:30');

const preset = editor.normalizePreset({
  id:'morning',
  defaultMode:'auto',
  stations:autoEdited
});
assert.equal(preset.defaultMode, 'auto');
assert.equal(preset.stations[1].intervalMin, 3);
assert.equal(preset.stations[1].timerIntervalMin, 7);

const todo = editor.normalizeTodo({ id:'todo-1', text:'そうじ', defaultMode:'clock' });
assert.equal(todo.defaultMode, 'clock');

const prepared = editor.prepareState({
  requestedMode:'auto',
  mode:'timer',
  stations:autoEdited,
  presets:[preset],
  todos:[todo]
});
assert.equal(prepared.requestedMode, 'auto');
assert.equal(prepared.mode, 'timer');
assert.equal(prepared.stations[1].intervalMin, 3);
assert.equal(prepared.presets[0].defaultMode, 'auto');
assert.equal(prepared.todos[0].defaultMode, 'clock');

assert.equal(editor.validHHMM('7:05'), '07:05');
assert.equal(editor.validHHMM('25:99'), '23:59');
assert.equal(editor.normalizeMode('schedule'), 'auto');
assert.equal(editor.normalizeMode('realtime'), 'clock');

console.log('three-mode-editor tests passed');
