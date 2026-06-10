const assert = require('node:assert/strict');
const regression = require('../three-mode-regression-core.js');

assert.equal(regression.formatClock(0), '00:00');
assert.equal(regression.formatClock(65_000), '01:05');
assert.equal(regression.gentleTime(30_000, false), 'あと少し');
assert.equal(regression.gentleTime(4 * 60_000, false), 'もうすぐ');
assert.equal(regression.gentleTime(10 * 60_000, false), 'すすんでいます');
assert.equal(regression.gentleTime(10 * 60_000, false, 'まっています'), 'まっています');

assert.equal(regression.qualitativeProgress(0, 5, false), '開始前');
assert.equal(regression.qualitativeProgress(1, 5, false), 'はじめ');
assert.equal(regression.qualitativeProgress(3, 5, false), '進行中');
assert.equal(regression.qualitativeProgress(4, 5, false), 'もうすぐ最後');
assert.equal(regression.qualitativeProgress(1, 1, false), 'さいごの予定');
assert.equal(regression.qualitativeProgress(1, 1, true, 'できた！'), 'できた！');
assert.equal(regression.progressText(2, 5, true), '2/5');

const timerVisible = regression.timerView({
  count:5,
  currentIndex:2,
  doneCount:2,
  completed:false,
  isLast:false,
  overdue:false,
  remainingMs:90_000,
  durationMs:5 * 60_000
}, true);
assert.equal(timerVisible.remaining, '01:30');
assert.equal(timerVisible.currentCardTime, 'つぎまで 5分');
assert.equal(timerVisible.progress, '2/5');

const timerHidden = regression.timerView({
  count:5,
  currentIndex:2,
  doneCount:2,
  completed:false,
  isLast:false,
  overdue:false,
  remainingMs:90_000,
  durationMs:5 * 60_000
}, false);
assert.equal(timerHidden.remaining, 'もうすぐ');
assert.equal(timerHidden.currentCardTime, 'つぎまで');
assert.equal(timerHidden.progress, '進行中');

const singleTimer = regression.timerView({
  count:1,
  currentIndex:0,
  doneCount:0,
  completed:false,
  isLast:true,
  remainingMs:0,
  durationMs:0
}, false);
assert.equal(singleTimer.remaining, 'できたらゴール');
assert.equal(singleTimer.progress, 'さいごの予定');

const singleTimerDone = regression.timerView({
  count:1,
  currentIndex:0,
  doneCount:1,
  completed:true,
  isLast:true,
  remainingMs:0,
  durationMs:0
}, false);
assert.equal(singleTimerDone.remaining, 'できた！');
assert.equal(singleTimerDone.progress, 'できた！');

const autoVisible = regression.autoView({
  count:5,
  positionCount:2,
  completed:false,
  remainingMs:125_000
}, true);
assert.equal(autoVisible.remaining, '02:05');
assert.equal(autoVisible.nextMetric, 'あと 02:05');
assert.equal(autoVisible.progress, '2/5');

const autoHidden = regression.autoView({
  count:5,
  positionCount:2,
  completed:false,
  remainingMs:125_000
}, false);
assert.equal(autoHidden.remaining, 'もうすぐ');
assert.equal(autoHidden.currentCardTime, 'もうすぐ');
assert.equal(autoHidden.progress, '進行中');

const autoCompleted = regression.autoView({
  count:5,
  positionCount:5,
  completed:true,
  remainingMs:0
}, false);
assert.equal(autoCompleted.remaining, '時間終了');
assert.equal(autoCompleted.progress, '時間終了');

const clockSchedule = {
  stations:[
    { name:'おうち', arrive:'07:30', depart:'07:35' },
    { name:'きがえ', arrive:'07:40', depart:'07:45' },
    { name:'しゅっぱつ', arrive:'07:50', depart:'07:55' }
  ]
};

const beforeHidden = regression.clockView({
  phase:'before',
  displayIndex:0,
  nextIndex:0,
  count:3,
  remainingMs:10 * 60_000
}, clockSchedule, false);
assert.equal(beforeHidden.currentCardTime, 'これから');
assert.equal(beforeHidden.nextBox, 'つぎは「おうち」です');
assert.equal(beforeHidden.progress, '開始前');

const activeVisible = regression.clockView({
  phase:'active',
  displayIndex:1,
  activeIndex:1,
  nextIndex:2,
  count:3,
  remainingMs:2 * 60_000
}, clockSchedule, true);
assert.equal(activeVisible.remaining, '02:00');
assert.equal(activeVisible.currentCardTime, '07:45まで');
assert.equal(activeVisible.nextMetric, '07:50から\nしゅっぱつ');
assert.equal(activeVisible.progress, '2/3');

const activeHidden = regression.clockView({
  phase:'active',
  displayIndex:1,
  activeIndex:1,
  nextIndex:2,
  count:3,
  remainingMs:2 * 60_000
}, clockSchedule, false);
assert.equal(activeHidden.remaining, 'もうすぐ');
assert.equal(activeHidden.currentCardTime, '予定中');
assert.equal(activeHidden.nextMetric, 'しゅっぱつ');
assert.equal(activeHidden.progress, 'もうすぐ最後');

const betweenHidden = regression.clockView({
  phase:'between',
  displayIndex:2,
  previousIndex:1,
  nextIndex:2,
  count:3,
  remainingMs:3 * 60_000
}, clockSchedule, false);
assert.equal(betweenHidden.remaining, 'もうすぐ');
assert.equal(betweenHidden.nextBox, 'つぎは「しゅっぱつ」です');
assert.equal(betweenHidden.progress, 'もうすぐ最後');

const clockEnded = regression.clockView({
  phase:'ended',
  displayIndex:2,
  nextIndex:-1,
  count:3,
  remainingMs:0
}, clockSchedule, false);
assert.equal(clockEnded.remaining, '時間終了');
assert.equal(clockEnded.nextMetric, '終了');
assert.equal(clockEnded.progress, '時間終了');

assert.deepEqual(regression.scheduleIssues({
  total:10,
  stations:[
    { markerOffset:0 },
    { markerOffset:5 },
    { markerOffset:10 }
  ]
}), []);
assert.deepEqual(regression.scheduleIssues({ total:0, stations:[] }), [
  'stations-empty',
  'total-invalid'
]);
assert.deepEqual(regression.scheduleIssues({ total:1, stations:[{ markerOffset:0 }] }), [
  'stations-single'
]);
assert.deepEqual(regression.scheduleIssues({
  total:5,
  stations:[{ markerOffset:3 }, { markerOffset:2 }]
}), ['marker-order:1']);

console.log('three-mode-regression tests passed');
