(function attachThreeModeRegressionCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrainThreeModeRegressionCore = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createThreeModeRegressionCore() {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function formatClock(milliseconds) {
    const seconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function gentleTime(milliseconds, showNumbers = true, fallback = 'すすんでいます') {
    if (showNumbers) return formatClock(milliseconds);
    const seconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
    if (seconds <= 0) return 'おじかんです';
    if (seconds <= 60) return 'あと少し';
    if (seconds <= 5 * 60) return 'もうすぐ';
    return fallback;
  }

  function qualitativeProgress(position, count, completed = false, completedLabel = '時間終了') {
    const safeCount = Math.max(0, Math.round(Number(count) || 0));
    const safePosition = clamp(Math.round(Number(position) || 0), 0, safeCount);
    if (!safeCount) return '予定なし';
    if (completed) return completedLabel;
    if (safePosition <= 0) return '開始前';
    if (safeCount === 1 || safePosition >= safeCount) return 'さいごの予定';
    if (safePosition === 1) return 'はじめ';
    if (safePosition >= safeCount - 1) return 'もうすぐ最後';
    return '進行中';
  }

  function progressText(position, count, showNumbers = true, completed = false, completedLabel = '時間終了') {
    if (!showNumbers) return qualitativeProgress(position, count, completed, completedLabel);
    const safeCount = Math.max(0, Math.round(Number(count) || 0));
    const safePosition = clamp(Math.round(Number(position) || 0), 0, safeCount);
    return `${safePosition}/${safeCount}`;
  }

  function timerView(timing = {}, showNumbers = true) {
    const completed = timing.completed === true;
    const isLast = timing.isLast === true;
    const overdue = timing.overdue === true;
    const count = Math.max(0, Number(timing.count) || 0);
    const currentPosition = completed
      ? count
      : Math.max(0, Number(timing.currentIndex || 0) + 1);
    const doneCount = completed
      ? count
      : clamp(Math.round(Number(timing.doneCount) || 0), 0, count);

    let remaining;
    if (completed) remaining = 'できた！';
    else if (isLast) remaining = 'できたらゴール';
    else if (overdue) remaining = 'おじかんになったよ';
    else remaining = gentleTime(timing.remainingMs, showNumbers, 'すすんでいます');

    return {
      remaining,
      currentCardTime: completed
        ? 'ゴール'
        : (isLast
          ? 'できたらゴール'
          : (showNumbers
            ? `つぎまで ${Math.max(1, Math.ceil(Number(timing.durationMs || 0) / 60000))}分`
            : 'つぎまで')),
      nextMetric: completed
        ? '完了'
        : (isLast ? 'さいごの予定' : gentleTime(timing.remainingMs, showNumbers, 'すすんでいます')),
      progress: showNumbers
        ? progressText(doneCount, count, true, completed)
        : progressText(currentPosition, count, false, completed, 'できた！')
    };
  }

  function autoView(snapshot = {}, showNumbers = true) {
    const completed = snapshot.completed === true;
    const count = Math.max(0, Number(snapshot.count) || 0);
    const position = completed ? count : Number(snapshot.positionCount || 0);
    const time = completed ? '時間終了' : gentleTime(snapshot.remainingMs, showNumbers, 'すすんでいます');
    return {
      remaining: time,
      currentCardTime: completed ? '予定終了' : (showNumbers ? `つぎまで ${time}` : time),
      nextMetric: completed ? '終了' : (showNumbers ? `あと ${time}` : time),
      progress: progressText(position, count, showNumbers, completed)
    };
  }

  function clockView(snapshot = {}, schedule = {}, showNumbers = true) {
    const stations = Array.isArray(schedule.stations) ? schedule.stations : [];
    const station = stations[snapshot.displayIndex] || stations[0] || {};
    const next = snapshot.nextIndex >= 0 ? stations[snapshot.nextIndex] : null;
    const phase = snapshot.phase || 'ended';
    const count = Math.max(0, Number(snapshot.count) || stations.length);
    let position = 0;
    if (phase === 'active') position = Number(snapshot.activeIndex || 0) + 1;
    else if (phase === 'between') position = Math.max(0, Number(snapshot.previousIndex || -1) + 1);
    else if (phase === 'ended') position = count;

    if (phase === 'before') {
      return {
        remaining: gentleTime(snapshot.remainingMs, showNumbers, 'まっています'),
        currentCardTime: showNumbers ? `${station.arrive || station.depart || ''}から` : 'これから',
        nextBox: showNumbers
          ? `${station.arrive || station.depart || ''}から「${station.name || '予定'}」です`
          : `つぎは「${station.name || '予定'}」です`,
        nextMetric: showNumbers ? `${station.arrive || station.depart || ''}から` : 'つぎの予定',
        progress: progressText(position, count, showNumbers, false)
      };
    }

    if (phase === 'active') {
      return {
        remaining: gentleTime(snapshot.remainingMs, showNumbers, 'すすんでいます'),
        currentCardTime: showNumbers ? `${station.depart || ''}まで` : '予定中',
        nextBox: `いまは「${station.name || '予定'}」の時間です`,
        nextMetric: next
          ? (showNumbers ? `${next.arrive || ''}から\n${next.name || '予定'}` : `${next.name || 'つぎの予定'}`)
          : 'この予定が最後',
        progress: progressText(position, count, showNumbers, false)
      };
    }

    if (phase === 'between') {
      return {
        remaining: gentleTime(snapshot.remainingMs, showNumbers, 'まっています'),
        currentCardTime: showNumbers ? `${station.arrive || ''}から` : 'これから',
        nextBox: showNumbers
          ? `つぎは${station.arrive || ''}から「${station.name || '予定'}」です`
          : `つぎは「${station.name || '予定'}」です`,
        nextMetric: showNumbers ? `${station.arrive || ''}から\n${station.name || '予定'}` : `${station.name || 'つぎの予定'}`,
        progress: progressText(position, count, showNumbers, false)
      };
    }

    return {
      remaining: '時間終了',
      currentCardTime: '予定終了',
      nextBox: 'この予定は終了しました。おつかれさまでした',
      nextMetric: '終了',
      progress: progressText(count, count, showNumbers, true)
    };
  }

  function scheduleIssues(schedule) {
    const issues = [];
    const stations = Array.isArray(schedule?.stations) ? schedule.stations : [];
    if (!stations.length) issues.push('stations-empty');
    if (stations.length === 1) issues.push('stations-single');
    if (!Number.isFinite(Number(schedule?.total)) || Number(schedule?.total) <= 0) issues.push('total-invalid');
    stations.forEach((station, index) => {
      if (!Number.isFinite(Number(station?.markerOffset))) issues.push(`marker-invalid:${index}`);
      if (index > 0 && Number(station?.markerOffset) < Number(stations[index - 1]?.markerOffset)) {
        issues.push(`marker-order:${index}`);
      }
    });
    return issues;
  }

  return {
    clamp,
    formatClock,
    gentleTime,
    qualitativeProgress,
    progressText,
    timerView,
    autoView,
    clockView,
    scheduleIssues
  };
});
