const assert = require('node:assert/strict');
const time = require('../three-mode-time.js');

const stations = [
  { name:'スタート', intervalMin:0, arrive:'07:30', depart:'07:30' },
  { name:'きがえ', intervalMin:5, arrive:'07:35', depart:'07:40' },
  { name:'ごはん', intervalMin:10, arrive:'07:50', depart:'07:55' },
  { name:'ゴール', intervalMin:3, arrive:'08:00', depart:'08:00' }
];

assert.equal(time.modeType('timer'), 'duration');
assert.equal(time.modeType('auto'), 'duration');
assert.equal(time.modeType('clock'), 'clock');

const duration = time.buildDurationSchedule(stations);
assert.equal(duration.total, 18);
assert.deepEqual(duration.stations.map((station) => station.markerOffset), [0, 5, 15, 18]);
assert.deepEqual(duration.stations.map((station) => station.durationToNextMin), [5, 10, 3, 0]);

const clock = time.buildClockSchedule(stations);
assert.equal(clock.startAbs, 450);
assert.equal(clock.endAbs, 480);
assert.equal(clock.total, 30);
assert.deepEqual(clock.stations.map((station) => station.markerOffset), [0, 5, 20, 30]);

const overnight = time.buildClockSchedule([
  { name:'開始', arrive:'23:50', depart:'23:50' },
  { name:'休憩', arrive:'00:10', depart:'00:20' },
  { name:'終了', arrive:'00:40', depart:'00:40' }
]);
assert.equal(overnight.startAbs, 1430);
assert.equal(overnight.endAbs, 1480);
assert.equal(overnight.total, 50);

assert.equal(time.durationElapsedMs({
  totalMs:600000,
  running:true,
  startedAt:1000,
  pausedElapsedMs:120000,
  nowMs:181000
}), 300000);

assert.equal(time.autoElapsedMs({
  totalMs:600000,
  autoRunning:true,
  autoStartedAt:1000,
  autoPausedElapsedMs:60000,
  nowMs:121000
}), 180000);

const durationPosition = time.locateDuration(duration, 7.5);
assert.equal(durationPosition.stationIndex, 1);
assert.equal(durationPosition.nextIndex, 2);
assert.equal(durationPosition.activeIndex, 2);
assert.equal(durationPosition.status, 'run');

const clockStop = time.locateClock(clock, 7);
assert.equal(clockStop.stationIndex, 1);
assert.equal(clockStop.status, 'stop');

const clockRun = time.locateClock(clock, 12);
assert.equal(clockRun.stationIndex, 1);
assert.equal(clockRun.nextIndex, 2);
assert.equal(clockRun.status, 'run');

const autoSnapshot = time.progressSnapshot('auto', stations, {
  autoRunning:true,
  autoStartedAt:0,
  autoPausedElapsedMs:6 * 60000
}, new Date(0));
assert.equal(autoSnapshot.kind, 'duration');
assert.equal(autoSnapshot.elapsedMin, 6);

console.log('three-mode-time tests passed');
