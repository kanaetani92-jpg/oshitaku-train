const assert = require('node:assert/strict');
const clock = require('../three-mode-clock-core.js');

function localDate(hour, minute, second = 0) {
  return new Date(2026, 5, 10, hour, minute, second, 0);
}

const schedule = {
  startAbs: 450,
  endAbs: 480,
  total: 30,
  stations: [
    { name:'おうち', arrive:'07:30', depart:'07:30', arriveAbs:450, departAbs:450, markerAbs:450 },
    { name:'きがえ', arrive:'07:35', depart:'07:38', arriveAbs:455, departAbs:458, markerAbs:455 },
    { name:'あさごはん', arrive:'07:45', depart:'07:50', arriveAbs:465, departAbs:470, markerAbs:465 },
    { name:'はみがき', arrive:'07:55', depart:'07:57', arriveAbs:475, departAbs:477, markerAbs:475 },
    { name:'しゅっぱつ', arrive:'08:00', depart:'08:00', arriveAbs:480, departAbs:480, markerAbs:480 }
  ]
};

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

const overnight = {
  startAbs: 1430,
  endAbs: 1480,
  total: 50,
  stations: [
    { name:'開始', arrive:'23:50', depart:'23:55', arriveAbs:1430, departAbs:1435, markerAbs:1430 },
    { name:'休憩', arrive:'00:10', depart:'00:20', arriveAbs:1450, departAbs:1460, markerAbs:1450 },
    { name:'終了', arrive:'00:40', depart:'00:40', arriveAbs:1480, departAbs:1480, markerAbs:1480 }
  ]
};

const overnightActive = clock.snapshot(overnight, localDate(0, 15));
assert.equal(overnightActive.phase, 'active');
assert.equal(overnightActive.activeIndex, 1);
assert.equal(overnightActive.remainingMs, 5 * 60000);

const extendedBounds = {
  startAbs: 455,
  endAbs: 480,
  total: 25,
  stations: [
    { name:'最初', arrive:'07:30', depart:'07:35', arriveAbs:450, departAbs:455, markerAbs:455 },
    { name:'最後', arrive:'08:00', depart:'08:05', arriveAbs:480, departAbs:485, markerAbs:480 }
  ]
};

assert.deepEqual(clock.effectiveBounds(extendedBounds), {
  startAbs:450,
  endAbs:485,
  total:35
});
assert.equal(clock.snapshot(extendedBounds, localDate(7, 31)).phase, 'active');
assert.equal(clock.snapshot(extendedBounds, localDate(8, 4)).phase, 'active');
assert.equal(clock.snapshot(extendedBounds, localDate(8, 6)).phase, 'ended');

assert.equal(clock.minutesToHHMM(1450), '00:10');
assert.equal(clock.minutesToHHMM(-10), '23:50');

console.log('three-mode-clock-mode tests passed');
