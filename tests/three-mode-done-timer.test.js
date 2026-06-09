const assert = require('node:assert/strict');
const time = require('../three-mode-time.js');
const timer = require('../three-mode-timer-core.js');

const schedule = time.buildDurationSchedule([
  { name:'おうち', intervalMin:0, arrive:'07:30', depart:'07:30' },
  { name:'きがえ', intervalMin:5, arrive:'07:35', depart:'07:35' },
  { name:'ごはん', intervalMin:10, arrive:'07:45', depart:'07:45' },
  { name:'ゴール', intervalMin:3, arrive:'07:48', depart:'07:48' }
]);

assert.equal(timer.activeIndex(schedule, -1), 0);
assert.equal(timer.activeIndex(schedule, 0), 1);
assert.equal(timer.activeIndex(schedule, 2), 3);
assert.equal(timer.allDone(schedule, 2), false);
assert.equal(timer.allDone(schedule, 3), true);

const initialTiming = timer.taskTiming(schedule, -1, 2 * 60000);
assert.equal(initialTiming.currentIndex, 0);
assert.equal(initialTiming.nextIndex, 1);
assert.equal(initialTiming.remainingMs, 3 * 60000);
assert.equal(initialTiming.overdue, false);

const overdueTiming = timer.taskTiming(schedule, -1, 9 * 60000);
assert.equal(overdueTiming.currentIndex, 0);
assert.equal(overdueTiming.remainingMs, 0);
assert.equal(overdueTiming.overdue, true);

const earlyDone = timer.completeCurrent(schedule, {
  doneUntilIndex:-1,
  running:true,
  pausedByLate:false,
  elapsedMs:2 * 60000,
  nowMs:100000
});
assert.equal(earlyDone.changed, true);
assert.equal(earlyDone.doneUntilIndex, 0);
assert.equal(earlyDone.nextActiveIndex, 1);
assert.equal(earlyDone.elapsedMs, 5 * 60000);
assert.equal(earlyDone.running, true);
assert.equal(earlyDone.timerStartedAt, 100000);

const overdueDone = timer.completeCurrent(schedule, {
  doneUntilIndex:-1,
  running:true,
  pausedByLate:false,
  elapsedMs:12 * 60000,
  nowMs:200000
});
assert.equal(overdueDone.doneUntilIndex, 0);
assert.equal(overdueDone.nextActiveIndex, 1);
assert.equal(overdueDone.elapsedMs, 5 * 60000);
assert.equal(overdueDone.running, true);

const pausedDone = timer.completeCurrent(schedule, {
  doneUntilIndex:0,
  running:false,
  pausedByLate:false,
  elapsedMs:8 * 60000,
  nowMs:300000
});
assert.equal(pausedDone.doneUntilIndex, 1);
assert.equal(pausedDone.nextActiveIndex, 2);
assert.equal(pausedDone.elapsedMs, 15 * 60000);
assert.equal(pausedDone.running, false);
assert.equal(pausedDone.timerStartedAt, null);

const lateWaitDone = timer.completeCurrent(schedule, {
  doneUntilIndex:1,
  running:false,
  pausedByLate:true,
  elapsedMs:18 * 60000,
  nowMs:400000
});
assert.equal(lateWaitDone.doneUntilIndex, 2);
assert.equal(lateWaitDone.nextActiveIndex, 3);
assert.equal(lateWaitDone.elapsedMs, 18 * 60000);
assert.equal(lateWaitDone.running, true);
assert.equal(lateWaitDone.timerStartedAt, 400000);

const finalDone = timer.completeCurrent(schedule, {
  doneUntilIndex:2,
  running:true,
  pausedByLate:false,
  elapsedMs:18 * 60000,
  nowMs:500000
});
assert.equal(finalDone.completed, true);
assert.equal(finalDone.doneUntilIndex, 3);
assert.equal(finalDone.elapsedMs, schedule.total * 60000);
assert.equal(finalDone.running, false);
assert.equal(finalDone.timerStartedAt, null);

const repeatedDone = timer.completeCurrent(schedule, {
  doneUntilIndex:3,
  running:false,
  pausedByLate:false,
  elapsedMs:schedule.total * 60000,
  nowMs:600000
});
assert.equal(repeatedDone.changed, false);
assert.equal(repeatedDone.doneUntilIndex, 3);
assert.equal(repeatedDone.completed, true);

console.log('three-mode-done-timer tests passed');
