const assert = require('node:assert/strict');
const time = require('../three-mode-time.js');
const clock = require('../three-mode-clock-core.js');

function localDate(hour, minute, second = 0) {
  return new Date(2026, 5, 10, hour, minute, second, 0);
}

const schedule = time.buildClockSchedule([
  { name:'おうち', arrive:'07:30', depart:'07:30' },
  { name:'きがえ', arrive:'07:35', depart:'07:38' },
  { name:'あさごはん', arrive:'07:45', depart:'07:50' },
  { name:'はみがき', arrive:'07:55', depart:'07:57' },
  { name:'しゅっぱつ', arrive:'08:00', depart:'08:00' }
]);

const before = clock.snapshot(schedule, localDate(7, 20));
assert.equal(before.phase, 'before');
assert.equal(before.displayIndex, 0);
assert.equal(before.nextIndex, 0);
assert.equal(before.remainingMs, 10 * 60000);
assert.equal(before.position, 0);

const betweenFirstAndSecond = clock.snapshot(schedule, localDate(7, 32));
assert.equal(betweenFirstAndSecond.phase, 'between');
assert.equal(betweenFirstAndSecond.previousIndex, 0);
assert.equal(betweenFirstAndSecond.nextIndex, 1);
assert.equal(betweenFirstAndSecond.displayIndex, 1);
assert.equal(betweenFirstAndSecond.remainingMs, 3 * 60000);

const active = clock.snapshot(schedule, localDate(7, 36));
assert.equal(active.phase, 'active');
assert.equal(active.activeIndex, 1);
assert.equal(active.displayIndex, 1);
assert.equal(active.nextIndex, 2);
assert.equal(active.remainingMs, 2 * 60000);

const between = clock.snapshot(schedule, localDate(7, 40));
assert.equal(between.phase, 'between');
assert.equal(between.previousIndex, 1);
assert.equal(between.nextIndex, 2);
assert.equal(between.displayIndex, 2);
assert.equal(between.remainingMs, 5 * 60000);

const ended = clock.snapshot(schedule, localDate(8, 1));
assert.equal(ended.phase, 'ended');
assert.equal(ended.displayIndex, 4);
assert.equal(ended.nextIndex, -1);
assert.equal(ended.remainingMs, 0);
assert.equal(ended.position, 1);

const overnight = time.buildClockSchedule([
  { name:'開始', arrive:'23:50', depart:'23:55' },
  { name:'休憩', arrive:'00:10', depart:'00:20' },
  { name:'終了', arrive:'00:40', depart:'00:40' }
]);

const overnightActive = clock.snapshot(overnight, localDate(0, 15));
assert.equal(overnightActive.phase, 'active');
assert.equal(overnightActive.activeIndex, 1);
assert.equal(overnightActive.remainingMs, 5 * 60000);

assert.equal(clock.minutesToHHMM(1450), '00:10');
assert.equal(clock.minutesToHHMM(-10), '23:50');

console.log('three-mode-clock-mode tests passed');
