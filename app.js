const $ = (selector) => document.querySelector(selector);
    const SCHEMA_VERSION = 20;
    const LS_KEY = 'oshitakuTrainNoPhotoStateV20';
    const LEGACY_LS_KEYS = [
      'oshitakuTrainNoPhotoStateV19',
      'oshitakuTrainNoPhotoStateV18',
      'oshitakuTrainNoPhotoStateV17',
      'oshitakuTrainNoPhotoState'
    ];
    const allowedVehicles = ['🚃','🚄','✈️','🚌','🚀','🚢','🐰'];

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
      lateBehavior:'display', timelineMode:'auto', seenGuide:false, currentPage:'schedule', todos:[],
      doneUntilIndex:-1, lastReachedIndex:-1, celebrated:false, clockDoneIndexes: [],
      clockDateKey:'', pausedByLate:false, schemaVersion:SCHEMA_VERSION
    };

    let state = loadState();
    let audioCtx = null;
    let lastSavedJson = '';
    let lastLiveMessage = '';
    let menuReturnFocus = null;
    let guideReturnFocus = null;
    let pendingUndoState = null;
    let undoTimer = null;

    function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
    function uid(prefix='id') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

    function readSavedState() {
      const keys = [LS_KEY, ...LEGACY_LS_KEYS];
      for (const key of keys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (error) {
          console.warn(`保存データ「${key}」を読み込めませんでした。`, error);
        }
      }
      return null;
    }

    function finiteNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    function loadState() {
      const saved = readSavedState();
      const base = deepCopy(defaultState);
      if (!saved) return base;

      const merged = { ...base, ...saved };
      merged.stations = migrateStations(saved.stations || base.stations, saved.clockStart || '07:30');
      const seenPresetIds = new Set();
      merged.presets = migratePresets(saved.presets, saved.customPresets).filter((preset) => {
        if (seenPresetIds.has(preset.id)) return false;
        seenPresetIds.add(preset.id);
        return true;
      });
      const seenTodoIds = new Set();
      merged.todos = (Array.isArray(saved.todos) ? saved.todos.map(normalizeTodo).filter(Boolean) : []).filter((todo) => {
        if (seenTodoIds.has(todo.id)) return false;
        seenTodoIds.add(todo.id);
        return true;
      });
      const validPresetIds = new Set(merged.presets.map((preset) => preset.id));
      merged.todos.forEach((todo) => {
        if (todo.targetPresetId !== 'new' && todo.targetPresetId && !validPresetIds.has(todo.targetPresetId)) todo.targetPresetId = '';
        if (todo.linkedPresetId && !validPresetIds.has(todo.linkedPresetId)) {
          todo.linkedPresetId = '';
          if (todo.status === 'added') todo.status = 'inbox';
        }
      });

      merged.uiMode = ['view','edit'].includes(saved.uiMode) ? saved.uiMode : 'edit';
      merged.mode = ['timer','clock'].includes(saved.mode) ? saved.mode : 'timer';
      merged.lateBehavior = ['display','wait','adjust'].includes(saved.lateBehavior) ? saved.lateBehavior : 'display';
      merged.timelineMode = ['auto','horizontal','vertical'].includes(saved.timelineMode) ? saved.timelineMode : 'auto';
      merged.currentPage = ['schedule','todo'].includes(saved.currentPage) ? saved.currentPage : 'schedule';
      merged.vehicle = allowedVehicles.includes(saved.vehicle) ? saved.vehicle : '🚃';
      merged.title = String(saved.title || base.title).slice(0, 28);

      ['showNumbers','showTopCards','showBottomCards','sound','voice','seenGuide','celebrated','pausedByLate'].forEach((key) => {
        merged[key] = typeof saved[key] === 'boolean' ? saved[key] : base[key];
      });

      const maxIndex = Math.max(-1, merged.stations.length - 1);
      merged.doneUntilIndex = clamp(Number.isInteger(saved.doneUntilIndex) ? saved.doneUntilIndex : -1, -1, maxIndex);
      merged.lastReachedIndex = clamp(Number.isInteger(saved.lastReachedIndex) ? saved.lastReachedIndex : -1, -1, maxIndex);
      merged.clockDoneIndexes = [...new Set(Array.isArray(saved.clockDoneIndexes) ? saved.clockDoneIndexes : [])]
        .filter(Number.isInteger)
        .filter((index) => index >= 0 && index <= maxIndex)
        .sort((a, b) => a - b);

      merged.running = saved.running === true;
      merged.timerStartedAt = Number.isFinite(Number(saved.timerStartedAt)) ? Number(saved.timerStartedAt) : null;
      merged.pausedElapsedMs = Math.max(0, finiteNumber(saved.pausedElapsedMs, 0));
      if (!merged.running) merged.timerStartedAt = null;
      if (merged.running && !merged.timerStartedAt) merged.running = false;

      merged.lateGraceMin = Math.min(30, toNonNegativeNumber(saved.lateGraceMin ?? 2));
      merged.clockDateKey = typeof saved.clockDateKey === 'string' ? saved.clockDateKey : '';
      merged.schemaVersion = SCHEMA_VERSION;
      merged.currentPresetId = merged.presets.some((preset) => preset.id === saved.currentPresetId) ? String(saved.currentPresetId) : '';
      return merged;
    }

    function updateSaveStatus(message = '✓ この端末に自動保存しました', isError = false) {
      const element = $('#saveStatus');
      if (!element) return;
      element.textContent = message;
      element.classList.toggle('error', isError);
    }

    function saveState() {
      try {
        state.schemaVersion = SCHEMA_VERSION;
        const json = JSON.stringify(state);
        if (json === lastSavedJson) {
          updateSaveStatus();
          return true;
        }
        localStorage.setItem(LS_KEY, json);
        lastSavedJson = json;
        updateSaveStatus();
        return true;
      } catch (error) {
        console.error('設定を保存できませんでした。', error);
        updateSaveStatus('保存できませんでした', true);
        announceAccessibleStatus('設定を保存できませんでした。ブラウザーの保存設定や空き容量を確認してください。', true);
        return false;
      }
    }

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
        vehicle: allowedVehicles.includes(preset.vehicle) ? preset.vehicle : '🚃',
        stations: migrateStations(preset.stations || initialPresets[0].stations, '07:30')
      };
    }

    function normalizeTodo(todo) {
      if (!todo) return null;
      const text = String(todo.text || todo.name || '').trim().slice(0, 24);
      if (!text) return null;
      const linkedPresetId = String(todo.linkedPresetId || '');
      let status = ['inbox','added','done'].includes(todo.status) ? todo.status : (linkedPresetId ? 'added' : 'inbox');
      if (status === 'added' && !linkedPresetId) status = 'inbox';
      return {
        id: String(todo.id || uid('todo')),
        text,
        icon: normalizeIcon(todo.icon || guessIcon(text)),
        minutes: Math.max(1, Math.min(240, toNonNegativeNumber(todo.minutes || 5) || 5)),
        targetPresetId: String(todo.targetPresetId || ''),
        newPresetName: String(todo.newPresetName || '').slice(0, 18),
        linkedPresetId,
        status,
        createdAt: Math.max(0, finiteNumber(todo.createdAt, Date.now()))
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
          id: String(s?.id || uid('station')),
          sourceTodoId: String(s?.sourceTodoId || ''),
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
    function toNonNegativeNumber(value) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
    }
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
    function localDateKey(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function clockServiceDateKey(schedule, now = new Date()) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      const serviceDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (schedule.endAbs > 1440 && currentMinutes <= schedule.endAbs - 1440) serviceDate.setDate(serviceDate.getDate() - 1);
      return localDateKey(serviceDate);
    }

    function ensureClockDay(schedule) {
      if (state.mode !== 'clock') return;
      const dateKey = clockServiceDateKey(schedule);
      if (state.clockDateKey === dateKey) return;
      state.clockDateKey = dateKey;
      state.clockDoneIndexes = [];
      state.lastReachedIndex = -1;
      state.celebrated = false;
    }

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
      const stations = migrateStations(state.stations, '07:30');
      const hasLikelyMidnightRollover = stations.some((station, index) => {
        if (index === 0) return false;
        const previous = timeToMinutes(stations[index - 1].arrive) ?? 0;
        const current = timeToMinutes(station.arrive) ?? 0;
        return previous >= 18 * 60 && current <= 6 * 60;
      });

      if (hasLikelyMidnightRollover) return stations;
      return stations
        .map((station, index) => ({ ...station, originalIndex:index, sortMinute:timeToMinutes(station.arrive) ?? 0 }))
        .sort((a, b) => a.sortMinute - b.sortMinute || a.originalIndex - b.originalIndex)
        .map(({ originalIndex, sortMinute, ...station }) => station);
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
      return window.matchMedia('(max-width: 640px)').matches ? 'vertical' : 'horizontal';
    }

    function timerDoingIndex(schedule) {
      return clamp((state.doneUntilIndex ?? -1) + 1, 0, schedule.stations.length - 1);
    }

    function timerNextIndex(schedule, activeIndex) {
      return clamp(activeIndex + 1, 0, schedule.stations.length - 1);
    }

    function isAllTasksDone(schedule) {
      if (!schedule.stations.length) return true;
      if (state.mode === 'timer') return state.doneUntilIndex >= schedule.stations.length - 1;
      return schedule.stations.every((_, index) => state.clockDoneIndexes.includes(index));
    }

    function announceAccessibleStatus(message, force = false) {
      const live = $('#statusLive');
      if (!live || (!force && message === lastLiveMessage)) return;
      lastLiveMessage = message;
      live.textContent = '';
      window.requestAnimationFrame(() => { live.textContent = message; });
    }

    function progressData() {
      const schedule = normalizedSchedule();
      ensureClockDay(schedule);
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
    function stationTimeLabel(station, index, lastIndex) {
      if (index === lastIndex) return 'ゴール';
      if (!state.showNumbers) return '';
      if (state.mode === 'timer') return index === 0 ? 'スタート' : `${station.intervalMin || 0}分`;
      if (index === 0) return `${station.depart}発`;
      return `${station.arrive}着 / ${station.depart}発`;
    }
    function shouldReverseVehicle(vehicle) { return ['🚄','🚌','🚢'].includes(vehicle); }

    function visualHtml(station, sizeClass = 'picture-card-icon') {
      return `<span class="${sizeClass}">${escapeHtml(station?.icon || '⭐')}</span>`;
    }

    function renderAppShell() {
      const page = state.currentPage === 'todo' ? 'todo' : 'schedule';
      $('#schedulePage')?.classList.toggle('active', page === 'schedule');
      $('#todoPage')?.classList.toggle('active', page === 'todo');
      $('#viewEditToggle')?.classList.toggle('hidden', page !== 'schedule');
      document.body.classList.toggle('todo-page-open', page === 'todo');
      document.querySelectorAll('[data-page]').forEach((button) => {
        const active = button.dataset.page === page;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
    }

    function todoPresetOptionsHtml(selected = '') {
      const options = [
        `<option value="" ${selected === '' ? 'selected' : ''}>あとで決める</option>`,
        `<option value="new" ${selected === 'new' ? 'selected' : ''}>新しいプリセットを作る</option>`
      ];
      state.presets.forEach((preset) => {
        options.push(`<option value="${escapeAttr(preset.id)}" ${selected === preset.id ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`);
      });
      return options.join('');
    }

    function presetLabelById(id) {
      return state.presets.find((preset) => preset.id === id)?.label || '';
    }

    function renderTodoFormOptions() {
      const select = $('#todoTargetPreset');
      if (!select) return;
      const current = select.value;
      select.innerHTML = todoPresetOptionsHtml(current);
      if ([...select.options].some((option) => option.value === current)) select.value = current;
      $('#todoNewPresetWrap')?.classList.toggle('hidden', select.value !== 'new');
    }

    function renderTodoPage() {
      renderTodoFormOptions();
      const groups = [
        { key:'inbox', title:'未整理', description:'あとで入れる予定を決めます。' },
        { key:'added', title:'予定に追加済み', description:'プリセットへ入れた内容です。' },
        { key:'done', title:'完了', description:'確認が終わったTo Doです。' }
      ];
      const count = state.todos.length;
      const inboxCount = state.todos.filter((todo) => todo.status === 'inbox').length;
      if ($('#todoCount')) $('#todoCount').textContent = count ? `未整理 ${inboxCount}件 / 全${count}件` : '0件';
      const root = $('#todoList');
      if (!root) return;
      if (!count) {
        root.innerHTML = '<div class="todo-empty"><span>📝</span><b>To Doはまだありません</b><p>「すること」だけ入力して、すぐに一時保存できます。</p></div>';
        return;
      }

      const cardHtml = (todo) => {
        const target = todo.targetPresetId || '';
        const linkedLabel = presetLabelById(todo.linkedPresetId);
        const statusBadge = todo.status === 'added'
          ? `<span class="todo-linked-badge">${escapeHtml(linkedLabel || '予定')}に追加済み</span>`
          : (todo.status === 'done' ? '<span class="todo-done-badge">✓ 完了</span>' : '');
        const controls = todo.status === 'inbox' ? `<div class="todo-item-controls">
            <label>入れる予定<select data-todo-target="${escapeAttr(todo.id)}">${todoPresetOptionsHtml(target)}</select></label>
            <label class="todo-new-name ${target === 'new' ? '' : 'hidden'}">新しいプリセット名<input type="text" maxlength="18" data-todo-new-name="${escapeAttr(todo.id)}" value="${escapeAttr(todo.newPresetName || '')}" placeholder="例：休日の予定"></label>
          </div>` : '';
        let actions = '';
        if (todo.status === 'inbox') {
          actions = `<button class="btn green" type="button" data-todo-add-preset="${escapeAttr(todo.id)}">予定に入れる</button>
            <button class="btn" type="button" data-todo-edit="${escapeAttr(todo.id)}">編集</button>`;
        } else if (todo.status === 'added') {
          actions = `<button class="btn primary" type="button" data-todo-view-preset="${escapeAttr(todo.id)}">予定を見る</button>
            <button class="btn" type="button" data-todo-unlink="${escapeAttr(todo.id)}">追加を取り消す</button>
            <button class="btn green" type="button" data-todo-complete="${escapeAttr(todo.id)}">確認して完了</button>`;
        } else {
          actions = `<button class="btn" type="button" data-todo-reopen="${escapeAttr(todo.id)}">未整理に戻す</button>`;
        }
        return `<article class="todo-item todo-status-${escapeAttr(todo.status)}" data-todo-id="${escapeAttr(todo.id)}">
          <div class="todo-item-main">
            <span class="todo-item-icon">${escapeHtml(todo.icon)}</span>
            <div><strong>${escapeHtml(todo.text)}</strong><small>目安 ${todo.minutes}分</small></div>
            ${statusBadge}
          </div>
          ${controls}
          <div class="todo-item-actions">
            ${actions}
            <button class="btn danger" type="button" data-todo-delete="${escapeAttr(todo.id)}">削除</button>
          </div>
        </article>`;
      };

      root.innerHTML = groups.map((group) => {
        const items = [...state.todos]
          .filter((todo) => todo.status === group.key)
          .sort((a,b) => b.createdAt - a.createdAt);
        if (!items.length) return '';
        return `<section class="todo-group" aria-labelledby="todo-group-${group.key}">
          <div class="todo-group-heading"><div><h3 id="todo-group-${group.key}">${group.title}</h3><p>${group.description}</p></div><span>${items.length}件</span></div>
          <div class="todo-group-items">${items.map(cardHtml).join('')}</div>
        </section>`;
      }).join('');
    }

    function resetTodoForm() {
      const form = $('#todoForm');
      if (!form) return;
      form.reset();
      $('#todoEditingId').value = '';
      $('#todoMinutes').value = '5';
      $('#todoFormTitle').textContent = 'To Doを追加';
      $('#todoSaveButton').textContent = '追加する';
      $('#todoCancelEdit').classList.add('hidden');
      const details = $('#todoDetails');
      if (details) details.open = false;
      renderTodoFormOptions();
    }

    function saveTodoFromForm(event) {
      event.preventDefault();
      const text = String($('#todoText').value || '').trim();
      if (!text) return;
      const editingId = $('#todoEditingId').value;
      const values = {
        text: text.slice(0, 24),
        icon: normalizeIcon($('#todoIcon').value || guessIcon(text)),
        minutes: Math.max(1, Math.min(240, toNonNegativeNumber($('#todoMinutes').value) || 5)),
        targetPresetId: $('#todoTargetPreset').value,
        newPresetName: String($('#todoNewPresetName').value || '').trim().slice(0, 18)
      };
      if (editingId) {
        const todo = state.todos.find((item) => item.id === editingId);
        if (todo) {
          const changedAfterLink = todo.linkedPresetId && (
            todo.text !== values.text ||
            todo.icon !== values.icon ||
            todo.minutes !== values.minutes ||
            todo.targetPresetId !== values.targetPresetId
          );
          Object.assign(todo, values);
          if (changedAfterLink) todo.linkedPresetId = '';
        }
      } else {
        state.todos.push(normalizeTodo({ id:uid('todo'), ...values, createdAt:Date.now() }));
      }
      saveState();
      resetTodoForm();
      renderTodoPage();
    }

    function editTodo(id) {
      const todo = state.todos.find((item) => item.id === id);
      if (!todo) return;
      $('#todoEditingId').value = todo.id;
      $('#todoText').value = todo.text;
      $('#todoIcon').value = todo.icon;
      $('#todoMinutes').value = todo.minutes;
      renderTodoFormOptions();
      $('#todoTargetPreset').value = todo.targetPresetId || '';
      $('#todoNewPresetName').value = todo.newPresetName || '';
      $('#todoNewPresetWrap').classList.toggle('hidden', todo.targetPresetId !== 'new');
      $('#todoFormTitle').textContent = 'To Doを編集';
      $('#todoSaveButton').textContent = '変更を保存';
      $('#todoCancelEdit').classList.remove('hidden');
      const details = $('#todoDetails');
      if (details) details.open = true;
      $('#todoForm').scrollIntoView({ behavior:'smooth', block:'start' });
      $('#todoText').focus();
    }

    function stationFromTodo(todo, previousStation) {
      const time = addMinutesHHMM(previousStation?.depart || previousStation?.arrive || '07:30', todo.minutes);
      return { id:uid('station'), sourceTodoId:todo.id, name:todo.text, speakText:todo.text, icon:todo.icon, intervalMin:todo.minutes, arrive:time, depart:time };
    }

    function shiftStationTime(station, minutes) {
      station.arrive = addMinutesHHMM(station.arrive, minutes);
      station.depart = addMinutesHHMM(station.depart, minutes);
    }

    function insertTodoIntoPreset(preset, todo) {
      const insertAt = Math.max(1, preset.stations.length - 1);
      const previous = preset.stations[insertAt - 1];
      for (let index = insertAt; index < preset.stations.length; index += 1) {
        shiftStationTime(preset.stations[index], todo.minutes);
      }
      preset.stations.splice(insertAt, 0, stationFromTodo(todo, previous));
    }

    function showUndo(message, previousState, duration = 8000) {
      pendingUndoState = previousState ? deepCopy(previousState) : null;
      const snackbar = $('#undoSnackbar');
      if (!snackbar) return;
      $('#undoMessage').textContent = message;
      $('#undoButton').classList.toggle('hidden', !pendingUndoState);
      snackbar.classList.add('show');
      snackbar.setAttribute('aria-hidden', 'false');
      clearTimeout(undoTimer);
      undoTimer = window.setTimeout(hideUndo, duration);
    }

    function hideUndo() {
      clearTimeout(undoTimer);
      undoTimer = null;
      pendingUndoState = null;
      const snackbar = $('#undoSnackbar');
      snackbar?.classList.remove('show');
      snackbar?.setAttribute('aria-hidden', 'true');
    }

    function restoreUndoState() {
      if (!pendingUndoState) return;
      state = deepCopy(pendingUndoState);
      lastSavedJson = '';
      hideUndo();
      saveState();
      renderEditor();
      renderTodoPage();
      render();
      announceAccessibleStatus('元に戻しました。', true);
    }

    function removeTodoFromPreset(todo) {
      const preset = state.presets.find((item) => item.id === todo.linkedPresetId);
      if (preset) {
        let stationIndex = preset.stations.findIndex((station) => station.sourceTodoId === todo.id);
        if (stationIndex < 0) {
          stationIndex = preset.stations.findIndex((station, index) => index > 0 && index < preset.stations.length - 1 && station.name === todo.text && station.icon === todo.icon);
        }
        if (stationIndex >= 0) {
          preset.stations.splice(stationIndex, 1);
          for (let index = stationIndex; index < preset.stations.length; index += 1) {
            shiftStationTime(preset.stations[index], -todo.minutes);
          }
        }
        if (state.currentPresetId === preset.id) {
          state.stations = deepCopy(preset.stations);
          resetForScheduleChange();
        }
      }
      todo.linkedPresetId = '';
      todo.status = 'inbox';
    }

    function viewTodoPreset(todo) {
      if (!todo?.linkedPresetId) return;
      applyPreset(todo.linkedPresetId, { confirmReplace:false, offerUndo:false });
      state.uiMode = 'edit';
      showPage('schedule');
    }

    function addTodoToPreset(id) {
      const todo = state.todos.find((item) => item.id === id);
      if (!todo) return;
      const previousState = deepCopy(state);
      let targetId = todo.targetPresetId;
      if (!targetId) {
        window.alert('入れる予定を選んでください。');
        return;
      }
      if (targetId === 'new') {
        const label = String(todo.newPresetName || '').trim() || `${todo.text}の予定`;
        const presetId = uid('preset');
        const start = { name:'スタート', speakText:'スタート', icon:'🏠', intervalMin:0, arrive:'07:30', depart:'07:30' };
        const task = stationFromTodo(todo, start);
        const goalTime = addMinutesHHMM(task.depart, 3);
        const goal = { name:'ゴール', speakText:'ゴール', icon:'🏁', intervalMin:3, arrive:goalTime, depart:goalTime };
        state.presets.push({ id:presetId, label:label.slice(0,18), favorite:false, title:label.slice(0,28), vehicle:'🚃', stations:[start, task, goal] });
        targetId = presetId;
        todo.targetPresetId = presetId;
      } else {
        const preset = state.presets.find((item) => item.id === targetId);
        if (!preset) {
          todo.targetPresetId = '';
          todo.linkedPresetId = '';
          saveState();
          renderTodoPage();
          window.alert('選んだプリセットが見つかりません。もう一度選んでください。');
          return;
        }
        insertTodoIntoPreset(preset, todo);
      }
      const targetPreset = state.presets.find((item) => item.id === targetId);
      if (targetPreset && state.currentPresetId === targetId) {
        state.stations = deepCopy(targetPreset.stations);
        resetForScheduleChange();
      }
      todo.linkedPresetId = targetId;
      todo.status = 'added';
      saveState();
      renderPresetControls();
      renderTodoPage();
      renderEditor();
      render();
      showUndo(`「${todo.text}」を予定に追加しました。`, previousState);
    }

    function openMenu() {
      const menu = $('#appMenu');
      if (!menu || menu.classList.contains('open')) return;
      menuReturnFocus = document.activeElement;
      menu.inert = false;
      menu.classList.add('open');
      $('#menuBackdrop')?.classList.add('show');
      menu.setAttribute('aria-hidden', 'false');
      $('#menuButton')?.setAttribute('aria-expanded', 'true');
      window.requestAnimationFrame(() => $('#menuCloseButton')?.focus());
    }

    function closeMenu({ restoreFocus = true } = {}) {
      const menu = $('#appMenu');
      const wasOpen = Boolean(menu?.classList.contains('open'));
      menu?.classList.remove('open');
      $('#menuBackdrop')?.classList.remove('show');
      menu?.setAttribute('aria-hidden', 'true');
      if (menu) menu.inert = true;
      $('#menuButton')?.setAttribute('aria-expanded', 'false');
      if (wasOpen && restoreFocus && menuReturnFocus instanceof HTMLElement) menuReturnFocus.focus();
      menuReturnFocus = null;
    }

    function showPage(page, { pushHistory = true } = {}) {
      state.currentPage = page === 'todo' ? 'todo' : 'schedule';
      const hash = state.currentPage === 'todo' ? '#todo' : '#schedule';
      if (pushHistory && window.location.hash !== hash) history.pushState({ page:state.currentPage }, '', hash);
      saveState();
      renderAppShell();
      if (state.currentPage === 'todo') renderTodoPage();
      closeMenu({ restoreFocus:false });
      window.scrollTo({ top:0, behavior:'smooth' });
      window.requestAnimationFrame(() => {
        const target = state.currentPage === 'todo' ? $('#todoPageTitle') : $('#displayTitle');
        target?.setAttribute('tabindex', '-1');
        target?.focus();
      });
    }

    function focusableElements(root) {
      if (!root) return [];
      return [...root.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hidden && element.getClientRects().length > 0);
    }

    function trapFocus(event, root) {
      if (event.key !== 'Tab') return;
      const focusable = focusableElements(root);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function showGuide() {
      const modal = $('#guideModal');
      if (!modal) return;
      guideReturnFocus = document.activeElement;
      closeMenu({ restoreFocus:false });
      $('.app').inert = true;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      window.requestAnimationFrame(() => $('#guideTryBtn')?.focus());
    }

    function closeGuide() {
      const modal = $('#guideModal');
      if (!modal?.classList.contains('show')) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      $('.app').inert = false;
      if (guideReturnFocus instanceof HTMLElement) guideReturnFocus.focus();
      guideReturnFocus = null;
    }

    function render() {
      renderAppShell();
      const data = progressData();
      const { schedule, elapsedMin, vehicle } = data;
      const allDone = isAllTasksDone(schedule);
      const remainingMs = allDone ? 0 : schedule.total * 60000 - data.elapsedMs;
      const currentAbs = state.mode === 'clock' ? schedule.startAbs + elapsedMin : elapsedMin;
      const currentStation = schedule.stations[vehicle.stationIndex] || schedule.stations[0];
      const nextIndexForDisplay = state.mode === 'timer' ? timerNextIndex(schedule, data.activeIndex) : vehicle.nextIndex;
      const nextStation = schedule.stations[nextIndexForDisplay] || schedule.stations.at(-1);
      const activeStation = schedule.stations[data.activeIndex] || currentStation;
      const isLastActive = data.activeIndex >= schedule.stations.length - 1;

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
      $('#slowBadge').classList.toggle('show', data.late && !allDone);
      $('#nextBox').classList.toggle('slow', data.late && !allDone);

      if (data.late && state.lateBehavior === 'wait' && state.running) {
        state.pausedElapsedMs = data.elapsedMs;
        state.running = false;
        state.timerStartedAt = null;
        state.pausedByLate = true;
      }

      if (allDone) {
        $('#nextBox').textContent = 'ぜんぶできました！ゴールです';
      } else if (data.late) {
        const lateLabel = state.lateBehavior === 'wait' ? '電車はここで待っているよ' : (state.lateBehavior === 'adjust' ? 'できたら時間を合わせるね' : 'ゆっくりでだいじょうぶ');
        $('#nextBox').textContent = `🐢 ${lateLabel}。「${activeStation.name}」を続けよう`;
      } else if (isLastActive && (vehicle.status === 'goal' || data.percent >= 1)) {
        $('#nextBox').textContent = `さいごの「${activeStation.name}駅」に到着しました。「できた！」を押そう`;
      } else if (state.mode === 'timer') {
        $('#nextBox').textContent = `つぎにすること：${nextStation.name}`;
      } else if (vehicle.status === 'stop') {
        $('#nextBox').textContent = `「${currentStation.name}駅」に停車中。${currentStation.depart}に出発します`;
      } else if (vehicle.status === 'waiting') {
        $('#nextBox').textContent = `「${currentStation.name}駅」を${currentStation.depart}に出発します`;
      } else if (vehicle.status === 'goal') {
        $('#nextBox').textContent = `さいごの「${activeStation.name}駅」です。「できた！」を押そう`;
      } else {
        $('#nextBox').textContent = `つぎにすること：${nextStation.name}（${nextStation.arrive}ごろ）`;
      }

      $('#currentCardKicker').textContent = allDone ? 'できた！' : (data.late ? 'ゆっくり運転中' : 'いますること');
      $('#currentCardVisual').innerHTML = visualHtml(activeStation);
      $('#currentCardName').textContent = activeStation.name;
      $('#currentCardTime').textContent = stationTimeLabel(activeStation, data.activeIndex, schedule.stations.length - 1);
      $('#doneBtn').setAttribute('aria-label', `${activeStation.name}ができた`);

      renderUpcomingCards(data, allDone);
      renderTrack(data);

      const activeStart = activeStation?.markerOffset || 0;
      const activeElapsed = Math.max(0, Math.floor(elapsedMin - activeStart));
      if (allDone) $('#nowMetric').textContent = 'ゴール';
      else if (!state.showNumbers) $('#nowMetric').textContent = `${activeStation.name}中`;
      else $('#nowMetric').textContent = `${activeStation.name}中・${activeElapsed}分経過${data.late ? '・ゆっくりでOK' : ''}`;

      if (allDone) {
        $('#nextMetric').textContent = '完了';
      } else if (isLastActive) {
        $('#nextMetric').textContent = 'さいごの駅';
      } else {
        const nextRemaining = state.mode === 'timer'
          ? (schedule.stations[nextIndexForDisplay]?.markerOffset ?? vehicle.nextAt) - elapsedMin
          : vehicle.nextAt - currentAbs;
        $('#nextMetric').textContent = `${nextStation.name}まで あと ${formatMinutes(nextRemaining)}`;
      }

      const completedCount = state.mode === 'timer'
        ? clamp((state.doneUntilIndex ?? -1) + 1, 0, schedule.stations.length)
        : clamp(new Set(state.clockDoneIndexes).size, 0, schedule.stations.length);
      $('#percentMetric').textContent = `${completedCount}/${schedule.stations.length}できた`;
      $('#completion').classList.toggle('show', allDone);
      $('#completion').setAttribute('aria-hidden', allDone ? 'false' : 'true');
      $('#doneBtn').disabled = allDone;

      renderModeControls();
      checkStationEvents(data, allDone);
      saveState();
    }

    function renderUpcomingCards(data, allDone = isAllTasksDone(data.schedule)) {
      const list = data.schedule.stations.slice(data.activeIndex + 1);
      const root = $('#upcomingCards');
      if (!list.length) {
        root.innerHTML = allDone
          ? '<div class="upcoming-empty">ぜんぶできました！よくがんばりました 🎉</div>'
          : '<div class="upcoming-empty">さいごの駅です。「できた！」を押そう ✅</div>';
        return;
      }
      root.innerHTML = list.map((station, idx) => {
        const actualIndex = data.activeIndex + 1 + idx;
        return `<div class="picture-card upcoming-card">${visualHtml(station)}<span class="picture-card-name">${escapeHtml(station.name)}</span><span class="picture-card-time">${escapeHtml(stationTimeLabel(station, actualIndex, data.schedule.stations.length - 1))}</span></div>`;
      }).join('');
    }

    function renderTrack(data) {
      const track = $('#track');
      [...track.querySelectorAll('.station')].forEach((el) => el.remove());
      data.schedule.stations.forEach((station, index) => {
        const pos = clamp(station.markerOffset / data.schedule.total, 0, 1) * 100;
        const el = document.createElement('div');
        el.className = 'station';
        const isDone = state.mode === 'clock' ? state.clockDoneIndexes.includes(index) : state.doneUntilIndex >= index;
        const isReached = station.markerOffset <= data.elapsedMin + 1/120;
        if (isDone) el.classList.add('done');
        else if (isReached) el.classList.add('reached');
        if (index === data.activeIndex && !isAllTasksDone(data.schedule)) el.classList.add('current');
        if (data.late && index === data.activeIndex) el.classList.add('late');
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', `${station.name}駅、${isDone ? 'できた' : (index === data.activeIndex ? 'いますること' : 'まだ')}`);
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
        if (isLastStation) row.classList.add('goal-station');
        const nextStation = state.stations[index + 1];
        const timeFields = state.mode === 'timer'
          ? (isLastStation
            ? `<div class="last-station-no-interval"><strong>🏁 ゴール</strong><span>さいごにすることです。次の駅までの時間はありません。</span></div>`
            : `<label>「${escapeHtml(nextStation?.name || 'つぎ')}駅」まで何分？<input type="number" min="1" max="240" data-field="nextIntervalMin" data-index="${index}" value="${escapeAttr(nextStation?.intervalMin ?? 5)}"></label>`)
          : `<label>到着<input type="time" data-field="arrive" data-index="${index}" value="${escapeAttr(station.arrive)}"></label><label>出発<input type="time" data-field="depart" data-index="${index}" value="${escapeAttr(station.depart)}"></label>`;
        row.innerHTML = `
          <span class="drag-handle" title="ドラッグして並び替え">☰</span>
          <div class="station-edit-body">
            <div class="station-editor-heading"><span>駅 ${index + 1}</span>${isLastStation ? '<span class="goal-badge">🏁 ゴール</span>' : ''}</div>
            <div class="station-edit-grid">
              <label>駅名<input type="text" data-field="name" data-index="${index}" value="${escapeAttr(station.name)}" maxlength="16"></label>
              <label>読み上げ用<input type="text" data-field="speakText" data-index="${index}" value="${escapeAttr(station.speakText || station.name)}" placeholder="例：こくご" maxlength="30"></label>
            </div>
            <div class="icon-select-wrap">
              <span class="icon-preview" data-preview="${index}">${escapeHtml(station.icon)}</span>
              <label>絵カードアイコン<select data-field="icon" data-index="${index}">${iconOptionsHtml(station.icon)}</select></label>
            </div>
            <div class="station-edit-grid ${state.mode === 'clock' ? '' : 'three'}">${timeFields}</div>
            <div class="edit-subtitle">${state.mode === 'timer' ? 'タイマーでは「この駅から次の駅まで」の時間を使います。' : '今日の時刻では到着・出発を使います。'}</div>
          </div>
          <div class="station-actions">
            <button class="station-action-btn" type="button" data-move-up="${index}" aria-label="${escapeAttr(station.name)}駅を上へ移動" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button class="station-action-btn" type="button" data-move-down="${index}" aria-label="${escapeAttr(station.name)}駅を下へ移動" ${index === state.stations.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="station-action-btn delete" type="button" data-delete="${index}" aria-label="${escapeAttr(station.name)}駅を削除">×</button>
          </div>`;
        editor.appendChild(row);
      });
      renderPresetControls();
      renderModeControls();
      if (state.currentPage === 'todo') renderTodoPage();
    }

    function renderModeControls() {
      const isClock = state.mode === 'clock';
      $('#timerModeBtn').classList.toggle('active', !isClock);
      $('#clockModeBtn').classList.toggle('active', isClock);
      $('#timerModeBtn').setAttribute('aria-pressed', String(!isClock));
      $('#clockModeBtn').setAttribute('aria-pressed', String(isClock));
      $('#timerControls').classList.toggle('hidden', isClock);
      $('#sortBtn').textContent = '時刻で並べる';
      $('#sortBtn').disabled = !isClock;
      $('#sortBtn').title = isClock ? '到着時刻の早い順に並べます' : '今日の時刻モードで使えます';
      const timerComplete = !isClock && isAllTasksDone(normalizedTimerSchedule());
      $('#startBtn').textContent = timerComplete ? '完了' : (state.running ? '走行中' : (state.pausedElapsedMs > 0 ? '再出発' : '出発'));
      $('#startBtn').disabled = state.running || timerComplete;
      $('#pauseBtn').disabled = !state.running;
      const startPlan = $('#startPlanBtn');
      if (startPlan) startPlan.textContent = isClock ? 'この予定を見る' : (state.running ? '見るモードへ' : 'この予定で始める');
    }

    function renderPresetControls() {
      const root = $('#presetList');
      const presets = [...state.presets].sort((a,b) => Number(b.favorite) - Number(a.favorite) || a.label.localeCompare(b.label, 'ja'));
      if (!presets.length) { root.innerHTML = '<p class="help">プリセットがありません。今の設定を追加するか、初期プリセットを復元してください。</p>'; return; }
      root.innerHTML = presets.map((preset) => `
        <div class="preset-row">
          <div><strong>${preset.favorite ? '★ ' : ''}${escapeHtml(preset.label)}</strong><small>${escapeHtml(preset.title)} / ${escapeHtml(preset.vehicle)} / ${preset.stations.length}駅</small></div>
          <button class="btn" type="button" data-apply-preset="${escapeAttr(preset.id)}">適用</button>
          <button class="btn star" type="button" data-favorite-preset="${escapeAttr(preset.id)}" aria-label="${escapeAttr(preset.label)}を${preset.favorite ? 'お気に入りから外す' : 'お気に入りに追加'}">${preset.favorite ? '★' : '☆'}</button>
          <button class="btn danger" type="button" data-delete-preset="${escapeAttr(preset.id)}" aria-label="${escapeAttr(preset.label)}を削除">削除</button>
        </div>`).join('');
    }

    function checkStationEvents(data, allDone = isAllTasksDone(data.schedule)) {
      if (data.reachedIndex > state.lastReachedIndex) {
        if (data.reachedIndex > 0) {
          const station = data.schedule.stations[data.reachedIndex];
          announceStation(station, false);
          announceAccessibleStatus(`${station.name}駅に到着しました。`);
        }
        state.lastReachedIndex = data.reachedIndex;
      }
      if (allDone && !state.celebrated) {
        state.celebrated = true;
        makeConfetti();
        announceAccessibleStatus('ぜんぶできました。ゴールです。よくできました。', true);
      }
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
    async function unlockAudio() {
      if (!(window.AudioContext || window.webkitAudioContext)) return null;
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      return audioCtx;
    }

    async function playChime(isGoal) {
      try {
        const context = await unlockAudio();
        if (!context) return;
        const now = context.currentTime; const notes = isGoal ? [523.25,659.25,783.99] : [659.25,783.99];
        notes.forEach((freq, i) => {
          const osc = context.createOscillator(); const gain = context.createGain();
          osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + i*.13);
          gain.gain.setValueAtTime(.0001, now + i*.13); gain.gain.exponentialRampToValueAtTime(.18, now + i*.13 + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + i*.13 + .22);
          osc.connect(gain).connect(context.destination); osc.start(now + i*.13); osc.stop(now + i*.13 + .24);
        });
      } catch (error) {
        console.warn('音を再生できませんでした。', error);
      }
    }
    function makeConfetti() {
      const root = $('#confetti'); root.innerHTML = '';
      for (let i=0; i<46; i++) { const piece = document.createElement('i'); piece.style.left = `${Math.random()*100}%`; piece.style.setProperty('--h', `${Math.random()*360}`); piece.style.animationDelay = `${Math.random()*.45}s`; piece.style.transform = `rotate(${Math.random()*360}deg)`; root.appendChild(piece); }
      setTimeout(() => { root.innerHTML = ''; }, 2300);
    }

    function resetProgressMarkers() {
      state.doneUntilIndex = -1;
      state.clockDoneIndexes = [];
      state.lastReachedIndex = -1;
      state.celebrated = false;
    }

    function resetRunState() {
      state.running = false;
      state.timerStartedAt = null;
      state.pausedElapsedMs = 0;
      state.pausedByLate = false;
      resetProgressMarkers();
    }

    function resetForScheduleChange() {
      resetRunState();
      if (state.mode === 'clock') {
        const schedule = normalizedClockSchedule();
        ensureClockDay(schedule);
        const elapsedMin = getElapsedMs() / 60000;
        state.lastReachedIndex = Math.max(0, schedule.stations.findLastIndex((station) => station.markerOffset <= elapsedMin + 1 / 120));
      } else {
        state.lastReachedIndex = 0;
      }
    }

    function detachCurrentPreset() {
      state.currentPresetId = '';
    }

    function applyPreset(id, { confirmReplace = true, offerUndo = true } = {}) {
      const preset = state.presets.find((p) => p.id === id); if (!preset) return false;
      if (confirmReplace && !state.currentPresetId) {
        const ok = window.confirm('現在編集中の内容を、このプリセットに置き換えますか？');
        if (!ok) return false;
      }
      const previousState = deepCopy(state);
      state.title = preset.title; state.vehicle = preset.vehicle; state.stations = deepCopy(preset.stations); state.currentPresetId = id;
      resetRunState(); renderEditor(); render();
      if (offerUndo) showUndo(`「${preset.label}」を読み込みました。`, previousState);
      return true;
    }
    function addCurrentPreset() {
      const input = $('#presetNameInput');
      const label = String(input.value || state.title || 'プリセット').trim().slice(0, 18) || 'プリセット';
      const id = uid('preset');
      state.presets.push({ id, label, favorite:false, title:state.title, vehicle:state.vehicle, stations:deepCopy(state.stations) });
      state.currentPresetId = id;
      input.value = ''; saveState(); renderPresetControls();
    }
    function deletePreset(id) {
      const preset = state.presets.find((item) => item.id === id);
      if (!preset) return;
      const ok = window.confirm(`「${preset.label}」を削除しますか？\nこの予定に含まれる${preset.stations.length}駅も一覧から削除されます。`);
      if (!ok) return;
      const previousState = deepCopy(state);
      state.presets = state.presets.filter((p) => p.id !== id);
      if (state.currentPresetId === id) state.currentPresetId = '';
      state.todos.forEach((todo) => {
        if (todo.targetPresetId === id) todo.targetPresetId = '';
        if (todo.linkedPresetId === id) {
          todo.linkedPresetId = '';
          if (todo.status === 'added') todo.status = 'inbox';
        }
      });
      saveState(); renderPresetControls();
      renderTodoPage();
      showUndo(`「${preset.label}」を削除しました。`, previousState);
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
      detachCurrentPreset(); resetForScheduleChange(); renderEditor(); render();
    }

    function hasProgress() {
      return state.running || state.pausedElapsedMs > 0 || state.doneUntilIndex >= 0 || state.clockDoneIndexes.length > 0;
    }

    async function startCurrentPlan() {
      showPage('schedule');
      if (state.mode === 'timer') {
        if (isAllTasksDone(normalizedTimerSchedule())) resetRunState();
        if (!state.running) {
          if (state.sound) await unlockAudio();
          state.running = true;
          state.timerStartedAt = Date.now();
          state.pausedByLate = false;
          state.celebrated = false;
        }
      }
      state.uiMode = 'view';
      saveState();
      render();
      announceAccessibleStatus(`${state.title}を始めます。`, true);
    }

    function previewCurrentPlan() {
      showPage('schedule');
      state.uiMode = 'view';
      saveState();
      render();
    }

    function handleDone() {
      const data = progressData();
      const activeIndex = clamp(data.activeIndex, 0, data.schedule.stations.length - 1);
      if (state.mode === 'timer') {
        state.doneUntilIndex = Math.max(state.doneUntilIndex, activeIndex);
        const allDone = state.doneUntilIndex >= data.schedule.stations.length - 1;
        if (allDone) {
          state.running = false;
          state.timerStartedAt = null;
          state.pausedByLate = false;
          state.pausedElapsedMs = Math.max(state.pausedElapsedMs, data.schedule.total * 60000);
        } else {
          const nextIndex = activeIndex + 1;
          const scheduledTarget = data.schedule.stations[nextIndex]?.markerOffset ?? data.schedule.total;
          const target = Math.max(scheduledTarget, data.elapsedMin);
          const keepRunning = state.running || state.pausedByLate;
          state.pausedByLate = false;
          setTimerElapsed(target * 60000, keepRunning);
        }
      } else {
        for (let index = 0; index <= activeIndex; index += 1) {
          if (!state.clockDoneIndexes.includes(index)) state.clockDoneIndexes.push(index);
        }
        state.clockDoneIndexes.sort((a, b) => a - b);
      }
      const allDone = isAllTasksDone(data.schedule);
      if (state.sound && (state.mode === 'clock' || allDone)) playChime(allDone);
      if (allDone) {
        state.celebrated = true;
        makeConfetti();
        announceAccessibleStatus('ぜんぶできました。ゴールです。よくできました。', true);
      } else {
        announceAccessibleStatus(`${data.schedule.stations[activeIndex].name}ができました。`);
      }
      saveState(); render();
    }


    function escapeHtml(text) { return String(text).replace(/[&<>\"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
    function escapeAttr(text) { return escapeHtml(text).replace(/'/g, '&#39;'); }

    $('#viewEditToggle').addEventListener('click', () => { state.uiMode = state.uiMode === 'view' ? 'edit' : 'view'; render(); });
    $('#startPlanBtn')?.addEventListener('click', startCurrentPlan);
    $('#previewBtn')?.addEventListener('click', previewCurrentPlan);
    $('#titleInput').addEventListener('input', (e) => { state.title = e.target.value.slice(0, 28); detachCurrentPreset(); render(); });
    $('#vehicleSelect').addEventListener('change', (e) => { state.vehicle = allowedVehicles.includes(e.target.value) ? e.target.value : '🚃'; detachCurrentPreset(); render(); });
    $('#showTopCards').addEventListener('change', (e) => { state.showTopCards = e.target.checked; render(); });
    $('#showBottomCards').addEventListener('change', (e) => { state.showBottomCards = e.target.checked; render(); });
    $('#showNumbers').addEventListener('change', (e) => { state.showNumbers = e.target.checked; render(); });
    $('#soundToggle').addEventListener('change', async (e) => { state.sound = e.target.checked; if (state.sound) await unlockAudio(); saveState(); });
    $('#voiceToggle').addEventListener('change', (e) => { state.voice = e.target.checked; saveState(); });
    $('#lateGraceInput').addEventListener('change', (e) => { state.lateGraceMin = toNonNegativeNumber(e.target.value); render(); });
    $('#lateBehaviorSelect').addEventListener('change', (e) => { state.lateBehavior = e.target.value; render(); });
    $('#timelineModeSelect').addEventListener('change', (e) => { state.timelineMode = e.target.value; render(); });
    $('#timerModeBtn').addEventListener('click', () => { state.mode = 'timer'; resetRunState(); renderEditor(); render(); });
    $('#clockModeBtn').addEventListener('click', () => { state.mode = 'clock'; resetRunState(); renderEditor(); render(); });
    $('#startBtn').addEventListener('click', async () => {
      if (state.running) return;
      if (state.sound) await unlockAudio();
      state.running = true;
      state.timerStartedAt = Date.now();
      state.pausedByLate = false;
      state.celebrated = false;
      render();
    });
    $('#pauseBtn').addEventListener('click', () => {
      if (!state.running) return;
      state.pausedElapsedMs = getElapsedMs();
      state.running = false;
      state.timerStartedAt = null;
      state.pausedByLate = false;
      render();
    });
    $('#resetBtn').addEventListener('click', () => {
      if (hasProgress() && !window.confirm('最初の駅に戻りますか？\n「できた」の記録も最初に戻ります。')) return;
      const previousState = deepCopy(state);
      resetRunState();
      render();
      showUndo('最初の駅に戻しました。', previousState);
    });
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
      detachCurrentPreset(); resetForScheduleChange(); render();
    });

    $('#stationEditor').addEventListener('change', async (e) => {
      const index = Number(e.target.dataset.index); const field = e.target.dataset.field;
      if (!Number.isInteger(index) || !state.stations[index]) return;
      if (field === 'arrive' || field === 'depart') e.target.value = normalizeHHMM(e.target.value);
      if (field === 'intervalMin') state.stations[index].intervalMin = index === 0 ? 0 : toNonNegativeNumber(e.target.value);
      if (field === 'nextIntervalMin' && state.stations[index + 1]) state.stations[index + 1].intervalMin = Math.max(1, toNonNegativeNumber(e.target.value));
      detachCurrentPreset(); resetForScheduleChange(); renderEditor(); render();
    });

    $('#stationEditor').addEventListener('click', (e) => {
      const upButton = e.target.closest('[data-move-up]');
      if (upButton) { const index = Number(upButton.dataset.moveUp); if (index > 0) moveStation(index, index - 1); return; }
      const downButton = e.target.closest('[data-move-down]');
      if (downButton) { const index = Number(downButton.dataset.moveDown); if (index < state.stations.length - 1) moveStation(index, index + 1); return; }
      const deleteIndex = Number(e.target.dataset.delete);
      if (Number.isInteger(deleteIndex)) {
        if (state.stations.length <= 2) return;
        const previousState = deepCopy(state);
        const stationName = state.stations[deleteIndex]?.name || '駅';
        state.stations.splice(deleteIndex, 1); detachCurrentPreset(); resetForScheduleChange(); renderEditor(); render();
        showUndo(`「${stationName}」を削除しました。`, previousState);
        return;
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
      detachCurrentPreset(); resetForScheduleChange(); renderEditor(); render();
    });
    $('#sortBtn').addEventListener('click', () => {
      if (state.mode !== 'clock') return;
      state.stations = sortStationsForEditor();
      detachCurrentPreset();
      resetForScheduleChange();
      renderEditor();
      render();
    });

    $('#presetList').addEventListener('click', (e) => {
      const apply = e.target.closest('[data-apply-preset]'); const favorite = e.target.closest('[data-favorite-preset]'); const del = e.target.closest('[data-delete-preset]');
      if (apply) applyPreset(apply.dataset.applyPreset);
      if (favorite) toggleFavoritePreset(favorite.dataset.favoritePreset);
      if (del) deletePreset(del.dataset.deletePreset);
    });
    $('#savePresetBtn').addEventListener('click', addCurrentPreset);
    $('#restoreDefaultPresetsBtn').addEventListener('click', restoreDefaultPresets);
    $('#menuButton')?.addEventListener('click', openMenu);
    $('#menuCloseButton')?.addEventListener('click', () => closeMenu());
    $('#menuBackdrop')?.addEventListener('click', () => closeMenu());
    $('#helpButton')?.addEventListener('click', () => { closeMenu({ restoreFocus:false }); showGuide(); });
    $('#todoBackButton')?.addEventListener('click', () => showPage('schedule'));
    $('#undoButton')?.addEventListener('click', restoreUndoState);
    $('#undoCloseButton')?.addEventListener('click', hideUndo);
    document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.page)));
    window.addEventListener('popstate', () => showPage(window.location.hash === '#todo' ? 'todo' : 'schedule', { pushHistory:false }));
    document.addEventListener('keydown', (event) => {
      const guide = $('#guideModal');
      const menu = $('#appMenu');
      if (guide?.classList.contains('show')) {
        if (event.key === 'Escape') closeGuide();
        else trapFocus(event, guide);
        return;
      }
      if (menu?.classList.contains('open')) {
        if (event.key === 'Escape') closeMenu();
        else trapFocus(event, menu);
      }
    });

    $('#todoIcon').innerHTML = iconOptionsHtml('📝');
    $('#todoForm')?.addEventListener('submit', saveTodoFromForm);
    $('#todoCancelEdit')?.addEventListener('click', resetTodoForm);
    $('#todoTargetPreset')?.addEventListener('change', (event) => $('#todoNewPresetWrap').classList.toggle('hidden', event.target.value !== 'new'));
    $('#todoList')?.addEventListener('change', (event) => {
      const targetId = event.target.dataset.todoTarget;
      if (!targetId) return;
      const todo = state.todos.find((item) => item.id === targetId);
      if (!todo) return;
      todo.targetPresetId = event.target.value;
      if (todo.linkedPresetId !== todo.targetPresetId) todo.linkedPresetId = '';
      saveState(); renderTodoPage();
    });
    $('#todoList')?.addEventListener('input', (event) => {
      const id = event.target.dataset.todoNewName;
      if (!id) return;
      const todo = state.todos.find((item) => item.id === id);
      if (todo) { todo.newPresetName = event.target.value; saveState(); }
    });
    $('#todoList')?.addEventListener('click', (event) => {
      const add = event.target.closest('[data-todo-add-preset]');
      const edit = event.target.closest('[data-todo-edit]');
      const view = event.target.closest('[data-todo-view-preset]');
      const unlink = event.target.closest('[data-todo-unlink]');
      const complete = event.target.closest('[data-todo-complete]');
      const reopen = event.target.closest('[data-todo-reopen]');
      const del = event.target.closest('[data-todo-delete]');
      if (add) { addTodoToPreset(add.dataset.todoAddPreset); return; }
      if (edit) { editTodo(edit.dataset.todoEdit); return; }
      if (view) { viewTodoPreset(state.todos.find((item) => item.id === view.dataset.todoViewPreset)); return; }
      if (unlink) {
        const todo = state.todos.find((item) => item.id === unlink.dataset.todoUnlink);
        if (!todo) return;
        const previousState = deepCopy(state);
        removeTodoFromPreset(todo);
        saveState(); renderPresetControls(); renderTodoPage(); renderEditor(); render();
        showUndo(`「${todo.text}」の追加を取り消しました。`, previousState);
        return;
      }
      if (complete) {
        const todo = state.todos.find((item) => item.id === complete.dataset.todoComplete);
        if (!todo) return;
        const previousState = deepCopy(state);
        todo.status = 'done';
        saveState(); renderTodoPage();
        showUndo(`「${todo.text}」を完了にしました。`, previousState);
        return;
      }
      if (reopen) {
        const todo = state.todos.find((item) => item.id === reopen.dataset.todoReopen);
        if (!todo) return;
        const previousState = deepCopy(state);
        todo.status = todo.linkedPresetId ? 'added' : 'inbox';
        saveState(); renderTodoPage();
        showUndo(`「${todo.text}」を戻しました。`, previousState);
        return;
      }
      if (del) {
        const todo = state.todos.find((item) => item.id === del.dataset.todoDelete);
        if (!todo) return;
        if (todo.linkedPresetId && !window.confirm('To Doだけを削除します。予定に追加した駅は残ります。よろしいですか？')) return;
        const previousState = deepCopy(state);
        state.todos = state.todos.filter((item) => item.id !== todo.id);
        saveState(); renderTodoPage();
        showUndo(`「${todo.text}」を削除しました。`, previousState);
      }
    });

    if ('speechSynthesis' in window && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', selectJapaneseVoice);
    $('#guideTryBtn')?.addEventListener('click', async () => {
      state.seenGuide = true;
      applyPreset('morning', { confirmReplace:false, offerUndo:false });
      closeGuide();
      saveState();
      await startCurrentPlan();
    });
    $('#guideCloseBtn').addEventListener('click', () => {
      state.seenGuide = true;
      state.uiMode = 'edit';
      closeGuide();
      saveState();
      render();
      window.requestAnimationFrame(() => $('#presetSection')?.scrollIntoView({ behavior:'smooth', block:'start' }));
    });
    window.addEventListener('resize', () => { if (state.timelineMode === 'auto') render(); });

    const initialPage = window.location.hash === '#todo' ? 'todo' : 'schedule';
    state.currentPage = initialPage;
    history.replaceState({ page:initialPage }, '', initialPage === 'todo' ? '#todo' : '#schedule');

    setInterval(render, 1000);
    renderEditor();
    renderTodoPage();
    render();
    if (!state.seenGuide) showGuide();
