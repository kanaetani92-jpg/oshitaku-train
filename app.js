const $ = (selector) => document.querySelector(selector);
    const LS_KEY = 'oshitakuTrainNoPhotoStateV18';
    const OLD_LS_KEY = null;

    const iconOptions = [
      ['🏠','おうち'], ['🚽','トイレ'], ['👕','きがえ'], ['🍚','ごはん'], ['🥛','のみもの'], ['🪥','はみがき'],
      ['🛁','おふろ'], ['📖','えほん'], ['✏️','べんきょう'], ['📘','本'], ['📝','プリント'], ['🧸','おもちゃ'],
      ['🧹','かたづけ'], ['🎒','しゅっぱつ'], ['🌙','おやすみ'], ['⭐','がんばる'], ['🏁','ゴール'], ['🎉','できた']
    ];

    const initialPresets = [
      { id:'morning', label:'朝の支度', favorite:true, title:'朝の支度', vehicle:'🚃', stations:[
        { name:'おうち', speakText:'おうち', icon:'🏠', intervalMin:0, arrive:'07:30', depart:'07:30' },
        { name:'きがえ', speakText:'きがえ', icon:'👕', intervalMin:5, arrive:'07:35', depart:'07:38' },
        { name:'あさごはん', speakText:'あさごはん', icon:'🍚', intervalMin:7, arrive:'07:45', depart:'07:50' },
        { name:'はみがき', speakText:'はみがき', icon:'🪥', intervalMin:5, arrive:'07:55', depart:'07:57' },
        { name:'しゅっぱつ', speakText:'しゅっぱつ', icon:'🎒', intervalMin:3, arrive:'08:00', depart:'08:00' }
      ]},
      { id:'bedtime', label:'寝る前', favorite:false, title:'おやすみライナー', vehicle:'🚄', stations:[
        { name:'おふろ', speakText:'おふろ', icon:'🛁', intervalMin:0, arrive:'20:00', depart:'20:00' },
        { name:'パジャマ', speakText:'パジャマ', icon:'👕', intervalMin:8, arrive:'20:08', depart:'20:10' },
        { name:'はみがき', speakText:'はみがき', icon:'🪥', intervalMin:5, arrive:'20:15', depart:'20:17' },
        { name:'えほん', speakText:'えほん', icon:'📖', intervalMin:7, arrive:'20:24', depart:'20:28' },
        { name:'おやすみ', speakText:'おやすみ', icon:'🌙', intervalMin:2, arrive:'20:30', depart:'20:30' }
      ]},
      { id:'study', label:'べんきょう', favorite:false, title:'べんきょう号', vehicle:'✈️', stations:[
        { name:'スタート', speakText:'スタート', icon:'✏️', intervalMin:0, arrive:'16:00', depart:'16:00' },
        { name:'こくご', speakText:'こくご', icon:'📘', intervalMin:5, arrive:'16:05', depart:'16:05' },
        { name:'さんすう', speakText:'さんすう', icon:'📝', intervalMin:5, arrive:'16:10', depart:'16:10' },
        { name:'えいご', speakText:'えいご', icon:'⭐', intervalMin:5, arrive:'16:15', depart:'16:15' },
        { name:'ゴール', speakText:'ゴール', icon:'🏁', intervalMin:10, arrive:'16:25', depart:'16:25' }
      ]}
    ];

    const defaultState = {
      uiMode:'edit', mode:'timer', title:'朝の支度', vehicle:'🚃', stations: deepCopy(initialPresets[0].stations),
      presets: deepCopy(initialPresets), currentPresetId:'morning', running:false, timerStartedAt:null, pausedElapsedMs:0,
      showNumbers:true, showTopCards:true, showBottomCards:true, sound:true, voice:false, lateGraceMin:2,
      lateBehavior:'display', timelineMode:'auto', seenGuide:false,
      doneUntilIndex:-1, lastReachedIndex:-1, celebrated:false, clockDoneIndexes: []
    };

    let state = loadState();
    let audioCtx = null;

    function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
    function uid(prefix='id') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

    function loadState() {
      try {
        const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        const base = deepCopy(defaultState);
        if (!saved) return base;
        const merged = { ...base, ...saved };
        merged.stations = migrateStations(saved.stations || base.stations, saved.clockStart || '07:30');
        merged.presets = migratePresets(saved.presets, saved.customPresets);
        if (!Array.isArray(merged.presets) || merged.presets.length === 0) merged.presets = deepCopy(initialPresets);
        if (!Number.isInteger(merged.doneUntilIndex)) merged.doneUntilIndex = -1;
        if (!Number.isInteger(merged.lastReachedIndex)) merged.lastReachedIndex = -1;
        if (!Array.isArray(merged.clockDoneIndexes)) merged.clockDoneIndexes = [];
        if (typeof merged.showTopCards !== 'boolean') merged.showTopCards = true;
        if (typeof merged.showBottomCards !== 'boolean') merged.showBottomCards = true;
        if (!['view','edit'].includes(merged.uiMode)) merged.uiMode = 'edit';
        if (!['display','wait','adjust'].includes(merged.lateBehavior)) merged.lateBehavior = 'display';
        if (!['auto','horizontal','vertical'].includes(merged.timelineMode)) merged.timelineMode = 'auto';
        if (typeof merged.seenGuide !== 'boolean') merged.seenGuide = false;
        merged.lateGraceMin = toNonNegativeNumber(merged.lateGraceMin ?? 2);
        return merged;
      } catch {
        return deepCopy(defaultState);
      }
    }

    function saveState() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

    function migratePresets(presets, customPresets) {
      if (Array.isArray(presets)) return presets.map(normalizePreset).filter(Boolean);
      const migrated = deepCopy(initialPresets);
      if (Array.isArray(customPresets)) {
        customPresets.forEach((p) => migrated.push(normalizePreset({ ...p, id:p.id || uid('preset'), favorite:false })));
      }
      return migrated.filter(Boolean);
    }

    function normalizePreset(preset) {
      if (!preset) return null;
      return {
        id: String(preset.id || uid('preset')),
        label: String(preset.label || preset.title || 'プリセット').slice(0, 18),
        favorite: Boolean(preset.favorite),
        title: String(preset.title || preset.label || 'おしたくトレイン').slice(0, 28),
        vehicle: preset.vehicle || '🚃',
        stations: migrateStations(preset.stations || initialPresets[0].stations, '07:30')
      };
    }

    function migrateStations(stations, fallbackStart) {
      const start = timeToMinutes(fallbackStart) ?? 450;
      const list = Array.isArray(stations) && stations.length ? stations : initialPresets[0].stations;
      return list.map((s, index) => {
        const name = String(s?.name || '駅').slice(0, 18);
        const minute = Math.max(0, Number(s?.minute ?? s?.intervalMin ?? (index === 0 ? 0 : 5)) || 0);
        const arrival = s?.arrive ? normalizeHHMM(s.arrive) : minutesToHHMM(start + list.slice(1, index + 1).reduce((sum, item) => sum + (Number(item?.intervalMin ?? item?.minute ?? 5) || 0), 0));
        const depart = s?.depart ? normalizeHHMM(s.depart) : arrival;
        return {
          name,
          speakText: String(s?.speakText || name).slice(0, 30),
          icon: normalizeIcon(s?.icon || guessIcon(name)),
          intervalMin: index === 0 ? 0 : minute,
          arrive: arrival,
          depart
        };
      });
    }

    function iconOptionsHtml(selected) {
      return iconOptions.map(([icon, label]) => `<option value="${escapeAttr(icon)}" ${icon === selected ? 'selected' : ''}>${escapeHtml(icon)} ${escapeHtml(label)}</option>`).join('');
    }

    function guessIcon(name) {
      const text = String(name || '');
      if (/おうち|家|スタート/.test(text)) return '🏠';
      if (/トイレ/.test(text)) return '🚽';
      if (/きがえ|着替|パジャマ/.test(text)) return '👕';
      if (/ごはん|朝|食/.test(text)) return '🍚';
      if (/はみがき|歯/.test(text)) return '🪥';
      if (/おふろ|風呂/.test(text)) return '🛁';
      if (/えほん|本|読む|国語|こくご/.test(text)) return '📖';
      if (/べんきょう|宿題|勉強|英語|えいご|算数|さんすう/.test(text)) return '✏️';
      if (/しゅっぱつ|出発|学校|園/.test(text)) return '🎒';
      if (/おやすみ|寝る/.test(text)) return '🌙';
      if (/ゴール|終わり/.test(text)) return '🏁';
      return '⭐';
    }
    function normalizeIcon(value) { return iconOptions.some(([icon]) => icon === value) ? value : '⭐'; }
    function toNonNegativeNumber(value) { return Math.max(0, Math.round(Number(value) || 0)); }
    function timeToMinutes(hhmm) {
      const match = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;
      const h = Number(match[1]); const m = Number(match[2]);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return ((h % 24 + 24) % 24) * 60 + Math.min(59, Math.max(0, m));
    }
    function minutesToHHMM(minutes) {
      const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
      const h = Math.floor(value / 60); const m = value % 60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    function normalizeHHMM(value) { return minutesToHHMM(timeToMinutes(value) ?? 0); }
    function addMinutesHHMM(hhmm, add) { return minutesToHHMM((timeToMinutes(hhmm) ?? 0) + add); }
    function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

    function normalizedSchedule() {
      return state.mode === 'clock' ? normalizedClockSchedule() : normalizedTimerSchedule();
    }

    function normalizedTimerSchedule() {
      const stations = migrateStations(state.stations, '07:30');
      let offset = 0;
      const withOffsets = stations.map((station, index) => {
        if (index > 0) offset += Math.max(1, toNonNegativeNumber(station.intervalMin || 5));
        return { ...station, arriveAbs: offset, departAbs: offset, markerAbs: offset, arriveOffset: offset, departOffset: offset, markerOffset: offset };
      });
      if (withOffsets.length < 2) withOffsets.push({ name:'ゴール', speakText:'ゴール', icon:'🏁', intervalMin:5, arrive:'00:05', depart:'00:05', arriveAbs:5, departAbs:5, markerAbs:5, arriveOffset:5, departOffset:5, markerOffset:5 });
      const total = Math.max(1, withOffsets.at(-1).markerOffset);
      return { stations: withOffsets, startAbs: 0, endAbs: total, total };
    }

    function normalizedClockSchedule() {
      const cleaned = migrateStations(state.stations, '07:30');
      let previousDepart = null;
      const stations = cleaned.map((station, index) => {
        let arriveAbs = timeToMinutes(station.arrive) ?? 0;
        let departAbs = timeToMinutes(station.depart) ?? arriveAbs;
        if (index === 0) {
          while (departAbs < arriveAbs) departAbs += 1440;
        } else {
          while (previousDepart !== null && arriveAbs < previousDepart) arriveAbs += 1440;
          while (departAbs < arriveAbs) departAbs += 1440;
        }
        previousDepart = departAbs;
        return { ...station, arriveAbs, departAbs };
      });
      if (stations.length < 2) {
        const start = stations[0]?.departAbs || 450;
        stations.push({ name:'ゴール', speakText:'ゴール', icon:'🏁', intervalMin:5, arrive:addMinutesHHMM(stations[0]?.depart || '07:30', 5), depart:addMinutesHHMM(stations[0]?.depart || '07:30', 5), arriveAbs:start+5, departAbs:start+5 });
      }
      const startAbs = stations[0].departAbs;
      let endAbs = stations.at(-1).arriveAbs;
      if (endAbs <= startAbs) endAbs = startAbs + 1;
      const total = endAbs - startAbs;
      const withOffsets = stations.map((station, index) => ({
        ...station,
        markerAbs: index === 0 ? startAbs : station.arriveAbs,
        arriveOffset: Math.max(0, station.arriveAbs - startAbs),
        departOffset: Math.max(0, station.departAbs - startAbs),
        markerOffset: Math.max(0, (index === 0 ? startAbs : station.arriveAbs) - startAbs)
      }));
      return { stations: withOffsets, startAbs, endAbs, total };
    }

    function sortStationsForEditor() {
      const schedule = normalizedClockSchedule();
      return schedule.stations.map(({ name, speakText, icon, intervalMin, arrive, depart, arriveAbs }) => ({ name, speakText, icon, intervalMin, arrive, depart, arriveAbs }))
        .sort((a, b) => a.arriveAbs - b.arriveAbs)
        .map(({ name, speakText, icon, intervalMin, arrive, depart }) => ({ name, speakText, icon, intervalMin, arrive, depart }));
    }

    function getElapsedMs() {
      const schedule = normalizedSchedule();
      const totalMs = schedule.total * 60000;
      if (state.mode === 'clock') {
        const now = new Date();
        let nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds()/60;
        if (schedule.endAbs > 1440 && nowMin <= schedule.endAbs - 1440) nowMin += 1440;
        return clamp((nowMin - schedule.startAbs) * 60000, 0, totalMs);
      }
      if (!state.running || !state.timerStartedAt) return clamp(state.pausedElapsedMs, 0, totalMs);
      return clamp(state.pausedElapsedMs + (Date.now() - state.timerStartedAt), 0, totalMs);
    }

    function setTimerElapsed(ms, keepRunning = state.running) {
      const totalMs = normalizedTimerSchedule().total * 60000;
      state.pausedElapsedMs = clamp(ms, 0, totalMs);
      state.running = keepRunning && state.pausedElapsedMs < totalMs;
      state.timerStartedAt = state.running ? Date.now() : null;
    }

    function vehiclePosition(schedule, elapsedMin) {
      const stations = schedule.stations;
      const t = state.mode === 'clock' ? schedule.startAbs + elapsedMin : elapsedMin;
      if (elapsedMin <= 0) {
        const initialNextIndex = state.mode === 'timer' ? Math.min(1, stations.length - 1) : 0;
        const initialNextAt = state.mode === 'timer' ? (stations[initialNextIndex]?.markerOffset ?? 0) : 0;
        const initialNextType = state.mode === 'timer' && initialNextIndex > 0 ? 'arrive' : 'depart';
        return { pos:0, status:'waiting', stationIndex:0, nextIndex:initialNextIndex, nextType:initialNextType, nextAt:initialNextAt, activeIndex:0 };
      }
      if (state.mode === 'timer') {
        for (let i=0; i<stations.length-1; i++) {
          const cur = stations[i]; const next = stations[i+1];
          if (elapsedMin >= cur.markerOffset && elapsedMin < next.markerOffset) {
            const span = Math.max(1/60, next.markerOffset - cur.markerOffset);
            const ratio = clamp((elapsedMin - cur.markerOffset) / span, 0, 1);
            const from = clamp(cur.markerOffset / schedule.total, 0, 1);
            const to = clamp(next.markerOffset / schedule.total, 0, 1);
            return { pos: from + (to-from)*ratio, status:'run', stationIndex:i, nextIndex:i+1, nextType:'arrive', nextAt:next.markerOffset, activeIndex:i+1 };
          }
        }
        return { pos:1, status:'goal', stationIndex:stations.length-1, nextIndex:stations.length-1, nextType:'goal', nextAt:schedule.total, activeIndex:stations.length-1 };
      }
      if (t <= schedule.startAbs) return { pos:0, status:'waiting', stationIndex:0, nextIndex:0, nextType:'depart', nextAt:schedule.startAbs, activeIndex:0 };
      for (let i=0; i<stations.length; i++) {
        const current = stations[i];
        const marker = current.markerAbs;
        const depart = i === stations.length - 1 ? current.arriveAbs : current.departAbs;
        if (t >= marker && t < depart) return { pos:clamp((marker - schedule.startAbs)/schedule.total, 0, 1), status:'stop', stationIndex:i, nextIndex:i, nextType:'depart', nextAt:depart, activeIndex:i };
        const next = stations[i+1];
        if (next && t >= depart && t < next.arriveAbs) {
          const span = Math.max(1/60, next.arriveAbs - depart);
          const ratio = clamp((t - depart) / span, 0, 1);
          const from = clamp((marker - schedule.startAbs)/schedule.total, 0, 1);
          const to = clamp((next.markerAbs - schedule.startAbs)/schedule.total, 0, 1);
          return { pos:from+(to-from)*ratio, status:'run', stationIndex:i, nextIndex:i+1, nextType:'arrive', nextAt:next.arriveAbs, activeIndex:i+1 };
        }
      }
      return { pos:1, status:'goal', stationIndex:stations.length-1, nextIndex:stations.length-1, nextType:'goal', nextAt:schedule.endAbs, activeIndex:stations.length-1 };
    }


    function effectiveTimelineMode() {
      if (state.timelineMode === 'horizontal' || state.timelineMode === 'vertical') return state.timelineMode;
      return 'horizontal';
    }

    function timerDoingIndex(schedule) {
      return clamp((state.doneUntilIndex ?? -1) + 1, 0, schedule.stations.length - 1);
    }

    function timerNextIndex(schedule, activeIndex) {
      return clamp(activeIndex + 1, 0, schedule.stations.length - 1);
    }

    function progressData() {
      const schedule = normalizedSchedule();
      const elapsedMs = getElapsedMs();
      const elapsedMin = elapsedMs / 60000;
      const percent = clamp(elapsedMin / schedule.total, 0, 1);
      const vehicle = vehiclePosition(schedule, elapsedMin);
      const reachedIndex = Math.max(0, schedule.stations.findLastIndex((s) => s.markerOffset <= elapsedMin + 1/120));
      const activeIndex = state.mode === 'timer'
        ? timerDoingIndex(schedule)
        : clamp(vehicle.activeIndex ?? vehicle.stationIndex ?? vehicle.nextIndex ?? 0, 0, schedule.stations.length - 1);
      const late = isLate(schedule, elapsedMin, activeIndex, reachedIndex);
      return { schedule, elapsedMs, elapsedMin, percent, vehicle, reachedIndex, activeIndex, late };
    }

    function isLate(schedule, elapsedMin, activeIndex, reachedIndex) {
      if (activeIndex <= 0 || activeIndex >= schedule.stations.length) return false;
      const grace = toNonNegativeNumber(state.lateGraceMin || 0);
      if (state.mode === 'timer') {
        const dueIndex = timerNextIndex(schedule, activeIndex);
        if (dueIndex === activeIndex) return false;
        const due = schedule.stations[dueIndex].markerOffset;
        return elapsedMin > due + grace && state.doneUntilIndex < activeIndex;
      }
      const due = schedule.stations[activeIndex].departOffset || schedule.stations[activeIndex].arriveOffset;
      return elapsedMin > due + grace && !state.clockDoneIndexes.includes(activeIndex);
    }

    function formatRemaining(ms) {
      const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60;
      if (!state.showNumbers) {
        if (totalSeconds <= 0) return 'とうちゃく';
        if (minutes < 2) return 'あと少し';
        if (minutes < 8) return 'もうすぐ';
        return '出発中';
      }
      return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    }
    function formatMinutes(n) { if (!state.showNumbers) return n <= 1 ? 'あと少し' : 'すすんでいます'; if (n < 1) return '1分未満'; return `${Math.ceil(n)}分`; }
    function formatElapsedMinutes(n) {
      if (!state.showNumbers) return n < 1 ? 'はじまったところ' : '進行中';
      if (n < 1) return '1分未満経過';
      return `${Math.floor(n)}分経過`;
    }
    function metricStartOffset(schedule, index) {
      const station = schedule.stations[index];
      if (!station) return 0;
      if (state.mode === 'timer') return station.markerOffset || 0;
      return station.markerOffset ?? station.arriveOffset ?? 0;
    }
    function isGoalStationLabel(station, index, lastIndex) {
      return (Number.isFinite(lastIndex) && index >= lastIndex) || station?.icon === '🏁' || /ゴール|おしまい|終わり/.test(String(station?.name || ''));
    }

    function stationTimeLabel(station, index, lastIndex) {
      const isLast = isGoalStationLabel(station, index, lastIndex);
      if (state.mode === 'timer') {
        if (isLast) return 'ゴール';
        if (index === 0) return state.showNumbers ? 'スタート' : '';
        if (!state.showNumbers) return '';
        return `${station.intervalMin || 0}分で到着`;
      }
      if (!state.showNumbers) return isLast ? 'ゴール' : '';
      if (isLast) return 'ゴール';
      if (index === 0) return `${station.depart}発`;
      return `${station.arrive}着 / ${station.depart}発`;
    }
    function shouldReverseVehicle(vehicle) { return ['🚄','🚌','🚢'].includes(vehicle); }

    function visualHtml(station, sizeClass = 'picture-card-icon') {
      return `<span class="${sizeClass}">${escapeHtml(station?.icon || '⭐')}</span>`;
    }

    function render() {
      const data = progressData();
      const { schedule, elapsedMin, vehicle } = data;
      const remainingMs = schedule.total * 60000 - data.elapsedMs;
      const currentAbs = state.mode === 'clock' ? schedule.startAbs + elapsedMin : elapsedMin;
      const currentStation = schedule.stations[vehicle.stationIndex];
      const nextIndexForDisplay = state.mode === 'timer' ? timerNextIndex(schedule, data.activeIndex) : vehicle.nextIndex;
      const nextStation = schedule.stations[nextIndexForDisplay];
      const activeStation = schedule.stations[data.activeIndex] || currentStation;

      const timelineMode = effectiveTimelineMode();
      document.body.classList.toggle('view-mode', state.uiMode === 'view');
      document.body.classList.toggle('timeline-horizontal', timelineMode === 'horizontal');
      document.body.classList.toggle('timeline-vertical', timelineMode === 'vertical');
      $('#viewEditToggle').textContent = state.uiMode === 'view' ? '編集モード' : '見るモード';
      $('#displayTitle').textContent = state.title || 'おしたくトレイン';
      $('#vehicleIcon').textContent = state.vehicle;
      $('#vehicleIcon').classList.toggle('reverse', shouldReverseVehicle(state.vehicle));
      $('#remainingText').textContent = formatRemaining(remainingMs);
      $('#timeBox').classList.toggle('hidden', !state.showNumbers);
      $('#currentCardSection').classList.toggle('hidden', !state.showTopCards);
      $('#upcomingSection').classList.toggle('hidden', !state.showBottomCards);
      $('#slowBadge').classList.toggle('show', data.late);
      $('#nextBox').classList.toggle('slow', data.late);

      if (data.late && state.lateBehavior === 'wait' && state.running) {
        state.pausedElapsedMs = data.elapsedMs;
        state.running = false;
        state.timerStartedAt = null;
      }

      if (data.late) {
        const lateLabel = state.lateBehavior === 'wait' ? 'できた！を押すまで停車中' : (state.lateBehavior === 'adjust' ? 'できた！で予定に追いつきます' : 'ゆっくり運転中');
        $('#nextBox').textContent = `🐢 ${lateLabel}。「${activeStation.name}」を進めています`;
      } else if (vehicle.status === 'goal' || data.percent >= 1) {
        $('#nextBox').textContent = 'ゴール駅に到着しました';
      } else if (state.mode === 'timer') {
        $('#nextBox').textContent = `つぎは「${nextStation.name}駅」です`;
      } else if (vehicle.status === 'stop') {
        $('#nextBox').textContent = `「${currentStation.name}駅」に停車中。${currentStation.depart}に出発します`;
      } else if (vehicle.status === 'waiting') {
        $('#nextBox').textContent = `「${currentStation.name}駅」を${currentStation.depart}に出発します`;
      } else {
        $('#nextBox').textContent = `つぎは「${nextStation.name}駅」です。${nextStation.arrive}に到着します`;
      }

      $('#currentCardKicker').textContent = data.late ? 'ゆっくり運転中' : (vehicle.status === 'goal' ? 'できた！' : 'いますること');
      $('#currentCardVisual').innerHTML = visualHtml(activeStation);
      $('#currentCardName').textContent = activeStation.name;
      $('#currentCardTime').textContent = stationTimeLabel(activeStation, data.activeIndex, schedule.stations.length - 1);

      renderUpcomingCards(data);
      renderTrack(data);
      forceGoalLabels(data);

      const nowMetricLabel = $('#nowMetric')?.previousElementSibling;
      const nextMetricLabel = $('#nextMetric')?.previousElementSibling;
      const doneMetricLabel = $('#percentMetric')?.previousElementSibling;
      if (nowMetricLabel) nowMetricLabel.textContent = 'いま';
      if (nextMetricLabel) nextMetricLabel.textContent = 'つぎの予定まで';
      if (doneMetricLabel) doneMetricLabel.textContent = 'できた';

      const activeStart = metricStartOffset(schedule, data.activeIndex);
      const activeElapsed = Math.max(0, elapsedMin - activeStart);
      if (vehicle.status === 'goal' || data.percent >= 1) {
        $('#nowMetric').textContent = 'ゴール';
      } else if (data.late) {
        $('#nowMetric').textContent = state.showNumbers ? `${activeStation.name}中・${formatElapsedMinutes(activeElapsed)}・ゆっくり` : 'ゆっくり運転中';
      } else {
        $('#nowMetric').textContent = state.showNumbers ? `${activeStation.name}中・${formatElapsedMinutes(activeElapsed)}` : `${activeStation.name}中`;
      }

      let nextRemaining;
      if (state.mode === 'timer') {
        const nextMarker = schedule.stations[nextIndexForDisplay]?.markerOffset ?? schedule.total;
        nextRemaining = nextMarker - elapsedMin;
      } else {
        nextRemaining = vehicle.nextAt - currentAbs;
      }
      if (vehicle.status === 'goal' || data.percent >= 1) $('#nextMetric').textContent = 'とうちゃく';
      else $('#nextMetric').textContent = `${nextStation.name}まで あと ${formatMinutes(nextRemaining)}`;

      const totalStations = schedule.stations.length;
      const doneCount = vehicle.status === 'goal' || data.percent >= 1
        ? totalStations
        : state.mode === 'timer'
          ? clamp((state.doneUntilIndex ?? -1) + 1, 0, totalStations)
          : clamp(Math.max(state.clockDoneIndexes.length, data.reachedIndex), 0, totalStations);
      $('#percentMetric').textContent = `${doneCount}/${totalStations}できた`;
      $('#completion').classList.toggle('show', data.percent >= 1);
      $('#doneBtn').disabled = data.percent >= 1;

      renderModeControls();
      checkStationEvents(data);
      saveState();
    }

    function renderUpcomingCards(data) {
      const list = data.schedule.stations.slice(data.activeIndex + 1);
      const root = $('#upcomingCards');
      if (!list.length) { root.innerHTML = '<div class="upcoming-empty">ぜんぶできました！よくがんばりました 🎉</div>'; return; }
      root.innerHTML = list.map((station, idx) => {
        const actualIndex = data.activeIndex + 1 + idx;
        const timeLabel = stationTimeLabel(station, actualIndex, data.schedule.stations.length - 1);
        return `<div class="picture-card upcoming-card">${visualHtml(station)}<span class="picture-card-name">${escapeHtml(station.name)}</span><span class="picture-card-time">${escapeHtml(timeLabel)}</span></div>`;
      }).join('');
    }

    function renderTrack(data) {
      const track = $('#track');
      [...track.querySelectorAll('.station')].forEach((el) => el.remove());
      data.schedule.stations.forEach((station, index) => {
        const pos = clamp(station.markerOffset / data.schedule.total, 0, 1) * 100;
        const el = document.createElement('div');
        el.className = 'station';
        const isDone = state.mode === 'clock' ? state.clockDoneIndexes.includes(index) || station.markerOffset <= data.elapsedMin + 1/120 : state.doneUntilIndex >= index || station.markerOffset <= data.elapsedMin + 1/120;
        if (isDone) el.classList.add('done');
        if (index === data.activeIndex && data.percent < 1) el.classList.add('current');
        if (data.late && index === data.activeIndex) el.classList.add('late');
        el.style.left = `${pos}%`; el.style.setProperty('--station-left', `${pos}%`); el.style.setProperty('--mobile-top', `${pos}%`);
        const label = stationTimeLabel(station, index, data.schedule.stations.length - 1);
        el.innerHTML = `${visualHtml(station, 'station-mini-icon')}<span class="station-label">${escapeHtml(station.name)}駅<span class="station-time">${escapeHtml(label)}</span></span>`;
        track.appendChild(el);
      });
      const vehiclePos = data.vehicle.pos * 100;
      $('#vehicle').style.left = `${vehiclePos}%`;
      $('#vehicle').style.setProperty('--vehicle-left', `${vehiclePos}%`);
      $('#vehicle').style.setProperty('--mobile-vehicle-top', `${vehiclePos}%`);
      $('#trackDone').style.setProperty('--progress', `${vehiclePos}%`);
    }

    function forceGoalLabels(data) {
      const lastIndex = data.schedule.stations.length - 1;
      if (lastIndex < 0) return;

      // 現在の大きい絵カードが最後の駅なら、時間ではなく必ず「ゴール」と表示する。
      if (data.activeIndex >= lastIndex) {
        const currentTime = $('#currentCardTime');
        if (currentTime) currentTime.textContent = 'ゴール';
      }

      // 下の「これからすること」の絵カードに最後の駅が含まれる場合も必ず「ゴール」。
      const upcomingCards = Array.from(document.querySelectorAll('#upcomingCards .upcoming-card'));
      upcomingCards.forEach((card, idx) => {
        const actualIndex = data.activeIndex + 1 + idx;
        if (actualIndex >= lastIndex) {
          const time = card.querySelector('.picture-card-time');
          if (time) time.textContent = 'ゴール';
        }
      });

      // タイムラインの最後の駅も必ず「ゴール」。保存済みの駅間分が残っていても表示しない。
      const trackStations = Array.from(document.querySelectorAll('#track .station'));
      const lastTrackStation = trackStations[trackStations.length - 1];
      const lastTime = lastTrackStation?.querySelector('.station-time');
      if (lastTime) lastTime.textContent = 'ゴール';
    }

    function renderEditor() {
      state.stations = migrateStations(state.stations, '07:30');
      $('#titleInput').value = state.title;
      $('#vehicleSelect').value = state.vehicle;
      $('#showNumbers').checked = state.showNumbers;
      $('#showTopCards').checked = state.showTopCards;
      $('#showBottomCards').checked = state.showBottomCards;
      $('#soundToggle').checked = state.sound;
      $('#voiceToggle').checked = state.voice;
      $('#lateGraceInput').value = state.lateGraceMin;
      $('#lateBehaviorSelect').value = state.lateBehavior;
      $('#timelineModeSelect').value = state.timelineMode;
      const editor = $('#stationEditor'); editor.innerHTML = '';
      state.stations.forEach((station, index) => {
        const row = document.createElement('div');
        row.className = 'station-row'; row.dataset.index = index; row.draggable = true;
        const isLastStation = index === state.stations.length - 1;
        const nextStation = state.stations[index + 1];
        const timeFields = state.mode === 'timer'
          ? (isLastStation
            ? `<div class="last-station-no-interval">さいごの駅です。次の駅までの時間はありません。</div>`
            : `<label>次まで何分？<input type="number" min="1" max="240" data-field="nextIntervalMin" data-index="${index}" value="${escapeAttr(nextStation?.intervalMin ?? 5)}"></label>`)
          : `<label>到着<input type="time" data-field="arrive" data-index="${index}" value="${escapeAttr(station.arrive)}"></label><label>出発<input type="time" data-field="depart" data-index="${index}" value="${escapeAttr(station.depart)}"></label>`;
        row.innerHTML = `
          <span class="drag-handle" title="ドラッグして並び替え">☰</span>
          <div class="station-edit-body">
            <div class="station-edit-grid">
              <label>駅名<input type="text" data-field="name" data-index="${index}" value="${escapeAttr(station.name)}" maxlength="16"></label>
              <label>読み上げ用<input type="text" data-field="speakText" data-index="${index}" value="${escapeAttr(station.speakText || station.name)}" placeholder="例：こくご" maxlength="30"></label>
            </div>
            <div class="icon-select-wrap">
              <span class="icon-preview" data-preview="${index}">${escapeHtml(station.icon)}</span>
              <label>絵カードアイコン<select data-field="icon" data-index="${index}">${iconOptionsHtml(station.icon)}</select></label>
            </div>
            <div class="station-edit-grid ${state.mode === 'clock' ? '' : 'three'}">${timeFields}</div>
            <div class="edit-subtitle">${state.mode === 'timer' ? 'タイマーでは「この駅から次の駅までの時間」を使います。' : '今日の時刻では到着・出発を使います。'}</div>
          </div>
          <button class="icon-btn" type="button" data-delete="${index}" aria-label="駅を削除">×</button>`;
        editor.appendChild(row);
      });
      renderPresetControls();
      renderModeControls();
    }

    function renderModeControls() {
      const isClock = state.mode === 'clock';
      $('#timerModeBtn').classList.toggle('active', !isClock);
      $('#clockModeBtn').classList.toggle('active', isClock);
      $('#timerControls').classList.toggle('hidden', isClock);
      $('#sortBtn').textContent = isClock ? '時刻で並べる' : '駅順を整える';
      $('#startBtn').textContent = state.running ? '走行中' : (state.pausedElapsedMs > 0 ? '再出発' : '出発');
    }

    function renderPresetControls() {
      const root = $('#presetList');
      const presets = [...state.presets].sort((a,b) => Number(b.favorite) - Number(a.favorite) || a.label.localeCompare(b.label, 'ja'));
      if (!presets.length) { root.innerHTML = '<p class="help">プリセットがありません。今の設定を追加するか、初期プリセットを復元してください。</p>'; return; }
      root.innerHTML = presets.map((preset) => `
        <div class="preset-row">
          <div><strong>${preset.favorite ? '★ ' : ''}${escapeHtml(preset.label)}</strong><small>${escapeHtml(preset.title)} / ${escapeHtml(preset.vehicle)} / ${preset.stations.length}駅</small></div>
          <button class="btn" type="button" data-apply-preset="${escapeAttr(preset.id)}">適用</button>
          <button class="btn star" type="button" data-favorite-preset="${escapeAttr(preset.id)}">${preset.favorite ? '★' : '☆'}</button>
          <button class="btn danger" type="button" data-delete-preset="${escapeAttr(preset.id)}">削除</button>
        </div>`).join('');
    }

    function checkStationEvents(data) {
      if (data.reachedIndex > state.lastReachedIndex) {
        if (data.reachedIndex > 0) announceStation(data.schedule.stations[data.reachedIndex], data.reachedIndex === data.schedule.stations.length - 1);
        state.lastReachedIndex = data.reachedIndex;
      }
      if (data.percent >= 1 && !state.celebrated) { state.celebrated = true; makeConfetti(); }
    }

    function selectJapaneseVoice() {
      if (!('speechSynthesis' in window)) return null;
      const voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
      return voices.find((voice) => /^ja[-_]?JP/i.test(voice.lang)) || voices.find((voice) => /^ja/i.test(voice.lang)) || null;
    }
    function announceStation(station, isGoal) {
      const label = station.speakText || station.name;
      if (state.sound) playChime(isGoal);
      if (state.voice && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(isGoal ? `${label}駅に到着しました。よくできました。` : `${label}駅に到着しました。`);
        utter.lang = 'ja-JP';
        const voice = selectJapaneseVoice(); if (voice) utter.voice = voice;
        utter.rate = .88;
        speechSynthesis.cancel(); speechSynthesis.speak(utter);
      }
    }
    function playChime(isGoal) {
      try {
        audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime; const notes = isGoal ? [523.25,659.25,783.99] : [659.25,783.99];
        notes.forEach((freq, i) => {
          const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
          osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + i*.13);
          gain.gain.setValueAtTime(.0001, now + i*.13); gain.gain.exponentialRampToValueAtTime(.18, now + i*.13 + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + i*.13 + .22);
          osc.connect(gain).connect(audioCtx.destination); osc.start(now + i*.13); osc.stop(now + i*.13 + .24);
        });
      } catch {}
    }
    function makeConfetti() {
      const root = $('#confetti'); root.innerHTML = '';
      for (let i=0; i<46; i++) { const piece = document.createElement('i'); piece.style.left = `${Math.random()*100}%`; piece.style.setProperty('--h', `${Math.random()*360}`); piece.style.animationDelay = `${Math.random()*.45}s`; piece.style.transform = `rotate(${Math.random()*360}deg)`; root.appendChild(piece); }
      setTimeout(() => { root.innerHTML = ''; }, 2300);
    }

    function resetProgressMarkers() { state.doneUntilIndex = -1; state.clockDoneIndexes = []; state.lastReachedIndex = -1; state.celebrated = false; }
    function resetRunState() { state.running = false; state.timerStartedAt = null; state.pausedElapsedMs = 0; resetProgressMarkers(); }

    function applyPreset(id) {
      const preset = state.presets.find((p) => p.id === id); if (!preset) return;
      state.title = preset.title; state.vehicle = preset.vehicle; state.stations = deepCopy(preset.stations); state.currentPresetId = id;
      resetRunState(); renderEditor(); render();
    }
    function addCurrentPreset() {
      const input = $('#presetNameInput');
      const label = String(input.value || state.title || 'プリセット').trim().slice(0, 18) || 'プリセット';
      state.presets.push({ id:uid('preset'), label, favorite:false, title:state.title, vehicle:state.vehicle, stations:deepCopy(state.stations) });
      input.value = ''; saveState(); renderPresetControls();
    }
    function deletePreset(id) {
      state.presets = state.presets.filter((p) => p.id !== id);
      if (state.currentPresetId === id) state.currentPresetId = '';
      saveState(); renderPresetControls();
    }
    function toggleFavoritePreset(id) {
      const preset = state.presets.find((p) => p.id === id); if (!preset) return;
      preset.favorite = !preset.favorite; saveState(); renderPresetControls();
    }
    function restoreDefaultPresets() {
      const existingIds = new Set(state.presets.map((p) => p.id));
      initialPresets.forEach((preset) => { if (!existingIds.has(preset.id)) state.presets.push(deepCopy(preset)); });
      saveState(); renderPresetControls();
    }
    function moveStation(fromIndex, toIndex) {
      if (fromIndex === toIndex || !state.stations[fromIndex] || !state.stations[toIndex]) return;
      const [moved] = state.stations.splice(fromIndex, 1); state.stations.splice(toIndex, 0, moved);
      resetProgressMarkers(); renderEditor(); render();
    }

    function handleDone() {
      const data = progressData();
      const activeIndex = data.activeIndex;
      if (state.mode === 'timer') {
        state.doneUntilIndex = Math.max(state.doneUntilIndex, activeIndex);
        const nextIndex = timerNextIndex(data.schedule, activeIndex);
        let target = data.schedule.stations[nextIndex]?.markerOffset ?? data.schedule.total;
        if (state.lateBehavior === 'adjust') target = Math.max(target, data.elapsedMin);
        const keepRunning = state.lateBehavior !== 'wait' && state.running;
        setTimerElapsed(target * 60000, keepRunning);
      } else {
        if (!state.clockDoneIndexes.includes(activeIndex)) state.clockDoneIndexes.push(activeIndex);
      }
      if (state.sound) playChime(activeIndex >= data.schedule.stations.length - 1);
      if (activeIndex >= data.schedule.stations.length - 1) makeConfetti();
      saveState(); render();
    }


    function escapeHtml(text) { return String(text).replace(/[&<>\"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
    function escapeAttr(text) { return escapeHtml(text).replace(/'/g, '&#39;'); }

    $('#viewEditToggle').addEventListener('click', () => { state.uiMode = state.uiMode === 'view' ? 'edit' : 'view'; render(); });
    $('#titleInput').addEventListener('input', (e) => { state.title = e.target.value; render(); });
    $('#vehicleSelect').addEventListener('change', (e) => { state.vehicle = e.target.value; render(); });
    $('#showTopCards').addEventListener('change', (e) => { state.showTopCards = e.target.checked; render(); });
    $('#showBottomCards').addEventListener('change', (e) => { state.showBottomCards = e.target.checked; render(); });
    $('#showNumbers').addEventListener('change', (e) => { state.showNumbers = e.target.checked; render(); });
    $('#soundToggle').addEventListener('change', (e) => { state.sound = e.target.checked; saveState(); });
    $('#voiceToggle').addEventListener('change', (e) => { state.voice = e.target.checked; saveState(); });
    $('#lateGraceInput').addEventListener('change', (e) => { state.lateGraceMin = toNonNegativeNumber(e.target.value); render(); });
    $('#lateBehaviorSelect').addEventListener('change', (e) => { state.lateBehavior = e.target.value; render(); });
    $('#timelineModeSelect').addEventListener('change', (e) => { state.timelineMode = e.target.value; render(); });
    $('#timerModeBtn').addEventListener('click', () => { state.mode = 'timer'; resetRunState(); renderEditor(); render(); });
    $('#clockModeBtn').addEventListener('click', () => { state.mode = 'clock'; resetRunState(); renderEditor(); render(); });
    $('#startBtn').addEventListener('click', () => { if (state.running) return; state.running = true; state.timerStartedAt = Date.now(); state.celebrated = false; render(); });
    $('#pauseBtn').addEventListener('click', () => { if (!state.running) return; state.pausedElapsedMs = getElapsedMs(); state.running = false; state.timerStartedAt = null; render(); });
    $('#resetBtn').addEventListener('click', () => { resetRunState(); render(); });
    $('#doneBtn').addEventListener('click', handleDone);

    $('#stationEditor').addEventListener('input', (e) => {
      const index = Number(e.target.dataset.index); const field = e.target.dataset.field;
      if (!Number.isInteger(index) || !field || !state.stations[index]) return;
      if (field === 'name') { state.stations[index].name = e.target.value; if (!state.stations[index].speakText) state.stations[index].speakText = e.target.value; }
      if (field === 'speakText') state.stations[index].speakText = e.target.value;
      if (field === 'icon') state.stations[index].icon = normalizeIcon(e.target.value);
      if (field === 'intervalMin') state.stations[index].intervalMin = index === 0 ? 0 : toNonNegativeNumber(e.target.value);
      if (field === 'nextIntervalMin' && state.stations[index + 1]) state.stations[index + 1].intervalMin = Math.max(1, toNonNegativeNumber(e.target.value));
      if (field === 'arrive') state.stations[index].arrive = normalizeHHMM(e.target.value);
      if (field === 'depart') state.stations[index].depart = normalizeHHMM(e.target.value);
      const preview = document.querySelector(`[data-preview="${index}"]`);
      if (preview && field === 'icon') preview.textContent = state.stations[index].icon;
      resetProgressMarkers(); render();
    });

    $('#stationEditor').addEventListener('change', async (e) => {
      const index = Number(e.target.dataset.index); const field = e.target.dataset.field;
      if (!Number.isInteger(index) || !state.stations[index]) return;
      if (field === 'arrive' || field === 'depart') e.target.value = normalizeHHMM(e.target.value);
      if (field === 'intervalMin') state.stations[index].intervalMin = index === 0 ? 0 : toNonNegativeNumber(e.target.value);
      if (field === 'nextIntervalMin' && state.stations[index + 1]) state.stations[index + 1].intervalMin = Math.max(1, toNonNegativeNumber(e.target.value));
      resetProgressMarkers(); renderEditor(); render();
    });

    $('#stationEditor').addEventListener('click', (e) => {
      const deleteIndex = Number(e.target.dataset.delete);
      if (Number.isInteger(deleteIndex)) {
        if (state.stations.length <= 2) return;
        state.stations.splice(deleteIndex, 1); resetProgressMarkers(); renderEditor(); render(); return;
      }
    });

    $('#stationEditor').addEventListener('dragstart', (e) => {
      const handle = e.target.closest('.drag-handle'); if (!handle) { e.preventDefault(); return; }
      const row = handle.closest('.station-row'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', row.dataset.index); row.classList.add('dragging');
    });
    $('#stationEditor').addEventListener('dragend', (e) => { const row = e.target.closest('.station-row'); if (row) row.classList.remove('dragging'); });
    $('#stationEditor').addEventListener('dragover', (e) => { if (!e.target.closest('.station-row')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    $('#stationEditor').addEventListener('drop', (e) => { const row = e.target.closest('.station-row'); if (!row) return; e.preventDefault(); moveStation(Number(e.dataTransfer.getData('text/plain')), Number(row.dataset.index)); });

    $('#addStationBtn').addEventListener('click', () => {
      const last = state.stations.at(-1) || { arrive:'07:30', depart:'07:30' };
      const nextTime = addMinutesHHMM(last.depart || last.arrive, 5);
      state.stations.push({ name:'あたらしい', speakText:'あたらしい', icon:'⭐', intervalMin:5, arrive:nextTime, depart:nextTime });
      renderEditor(); render();
    });
    $('#sortBtn').addEventListener('click', () => { if (state.mode === 'clock') state.stations = sortStationsForEditor(); renderEditor(); render(); });

    $('#presetList').addEventListener('click', (e) => {
      const apply = e.target.closest('[data-apply-preset]'); const favorite = e.target.closest('[data-favorite-preset]'); const del = e.target.closest('[data-delete-preset]');
      if (apply) applyPreset(apply.dataset.applyPreset);
      if (favorite) toggleFavoritePreset(favorite.dataset.favoritePreset);
      if (del) deletePreset(del.dataset.deletePreset);
    });
    $('#savePresetBtn').addEventListener('click', addCurrentPreset);
    $('#restoreDefaultPresetsBtn').addEventListener('click', restoreDefaultPresets);
    $('#fullscreenBtn').addEventListener('click', async () => { const target = document.documentElement; if (!document.fullscreenElement && target.requestFullscreen) await target.requestFullscreen(); else if (document.exitFullscreen) await document.exitFullscreen(); });
    if ('speechSynthesis' in window && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', selectJapaneseVoice);
    $('#guideCloseBtn').addEventListener('click', () => {
      const skip = $('#guideSkip');
      state.seenGuide = Boolean(skip && skip.checked);
      $('#guideModal').classList.remove('show');
      saveState();
    });
    window.addEventListener('resize', () => { if (state.timelineMode === 'auto') render(); });

    setInterval(render, 1000);
    renderEditor(); render();
    if (!state.seenGuide) $('#guideModal').classList.add('show');
