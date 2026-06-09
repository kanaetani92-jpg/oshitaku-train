const assert = require('node:assert/strict');
const time = require('../three-mode-time.js');
const auto = require('../three-mode-auto-core.js');

const schedule = time.buildDurationSchedule([
  { name:'おうち', intervalMin:0, arrive:'07:30', depart:'07:30' },
  { name:'きがえ', intervalMin:5, arrive:'07:35', depart:'07:35' },
  { name:'ごはん', intervalMin:10, arrive:'07:45', depart:'07:45' },
  { name:'ゴール', intervalMin:3, arrive:'07:48', depart:'07:48' }
]);

assert.equal(auto.totalMs(schedule), 18 * 60000);
assert.equal(auto.markerMs(schedule, 0), 0);
assert.equal(auto.markerMs(schedule, 1), 5 * 60000);
assert.equal(auto.markerMs(schedule, 2), 15 * 60000);
assert.equal(auto.markerMs(schedule, 3), 18 * 60000);

const initial = auto.snapshot(schedule, 0);
assert.equal(initial.completed, false);
assert.equal(initial.currentIndex, 0);
assert.equal(initial.nextIndex, 1);
assert.equal(initial.doneUntilIndex, -1);
assert.equal(initial.remainingMs, 5 * 60000);
assert.equal(initial.positionCount, 1);

const started = auto.start(schedule, auto.reset(), 100000);
assert.equal(started.autoRunning, true);
assert.equal(started.autoStartedAt, 100000);
assert.equal(started.autoPausedElapsedMs, 0);

const afterTwoMinutes = auto.elapsedMs(started, 220000, auto.totalMs(schedule));
assert.equal(afterTwoMinutes, 2 * 60000);

const firstBoundary = auto.snapshot(schedule, 5 * 60000);
assert.equal(firstBoundary.currentIndex, 1);
assert.equal(firstBoundary.nextIndex, 2);
assert.equal(firstBoundary.doneUntilIndex, 0);
assert.equal(firstBoundary.remainingMs, 10 * 60000);
assert.equal(firstBoundary.positionCount, 2);

const middle = auto.snapshot(schedule, 9 * 60000);
assert.equal(middle.currentIndex, 1);
assert.equal(middle.segmentElapsedMs, 4 * 60000);
assert.equal(middle.remainingMs, 6 * 60000);

const paused = auto.pause(schedule, {
  autoRunning:true,
  autoStartedAt:100000,
  autoPausedElapsedMs:0
}, 640000);
assert.equal(paused.autoRunning, false);
assert.equal(paused.autoStartedAt, null);
assert.equal(paused.autoPausedElapsedMs, 9 * 60000);
assert.equal(paused.completed, false);

const elapsedWhilePaused = auto.elapsedMs(paused, 940000, auto.totalMs(schedule));
assert.equal(elapsedWhilePaused, 9 * 60000);

const resumed = auto.start(schedule, paused, 1000000);
assert.equal(resumed.autoRunning, true);
assert.equal(resumed.autoStartedAt, 1000000);
assert.equal(resumed.autoPausedElapsedMs, 9 * 60000);

const afterResume = auto.elapsedMs(resumed, 1060000, auto.totalMs(schedule));
assert.equal(afterResume, 10 * 60000);

const restoredFromStorage = {
  autoRunning:true,
  autoStartedAt:1000000,
  autoPausedElapsedMs:9 * 60000
};
assert.equal(
  auto.elapsedMs(restoredFromStorage, 1120000, auto.totalMs(schedule)),
  11 * 60000
);

const secondBoundary = auto.snapshot(schedule, 15 * 60000);
assert.equal(secondBoundary.currentIndex, 2);
assert.equal(secondBoundary.nextIndex, 3);
assert.equal(secondBoundary.doneUntilIndex, 1);
assert.equal(secondBoundary.remainingMs, 3 * 60000);

const completed = auto.snapshot(schedule, 18 * 60000);
assert.equal(completed.completed, true);
assert.equal(completed.currentIndex, 3);
assert.equal(completed.doneUntilIndex, 3);
assert.equal(completed.remainingMs, 0);
assert.equal(completed.positionCount, 4);

const finishedRuntime = auto.finish(schedule);
assert.equal(finishedRuntime.autoRunning, false);
assert.equal(finishedRuntime.autoStartedAt, null);
assert.equal(finishedRuntime.autoPausedElapsedMs, 18 * 60000);
assert.equal(finishedRuntime.completed, true);

const restartAfterCompletion = auto.start(schedule, finishedRuntime, 2000000);
assert.equal(restartAfterCompletion.autoRunning, true);
assert.equal(restartAfterCompletion.autoStartedAt, 2000000);
assert.equal(restartAfterCompletion.autoPausedElapsedMs, 0);

console.log('three-mode-auto-timer tests passed');
