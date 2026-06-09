    let lastResolvedTimelineMode = '';
    let lastTimelineRenderKey = '';
    let lastTimelineNoticeText = '';
    let unsafeHorizontalLayout = { contentKey:'', maxWidth:0 };
    let timelineResizeObserver = null;
    let timelineResizeFrame = 0;
    let lastObservedTimelineWidth = 0;

    function timelinePresentation(stations) {
      const names = stations.map((station) => String(station?.name || ''));
      const count = names.length;
      const longestName = names.reduce((max, name) => Math.max(max, [...name].length), 0);
      const totalNameLength = names.reduce((sum, name) => sum + [...name].length, 0);
      const density = count <= 4 ? 'comfortable' : (count <= 6 ? 'compact' : (count <= 8 ? 'dense' : 'crowded'));
      const staggerLabels = count >= 6 || (count >= 5 && (longestName >= 7 || totalNameLength >= 30));
      const verticalRecommended = count >= 9 || longestName >= 12 || (count >= 8 && totalNameLength >= 56);
      return { count, longestName, totalNameLength, density, staggerLabels, verticalRecommended };
    }

    function timelineNameUnits(value) {
      return [...String(value || '')].reduce((total, character) => {
        if (/\s/.test(character)) return total + .35;
        if ((character.codePointAt(0) || 0) <= 0x7f) return total + .58;
        return total + 1;
      }, 0);
    }

    function timelineDeviceProfile() {
      const viewportWidth = window.innerWidth;
      if (viewportWidth <= 640 || window.matchMedia('(orientation: landscape) and (max-height: 480px) and (max-width: 900px)').matches) {
        return {
          name:'smartphone', edge:20, fontSize:10, minLabel:44, maxLabel:82,
          minInterval:52, explicitMinInterval:46, maxAutoStations:8, maxExplicitStations:9,
          maxNameUnits:12, explicitMaxNameUnits:15
        };
      }
      if (viewportWidth <= 1100) {
        return {
          name:'tablet', edge:56, fontSize:11.5, minLabel:76, maxLabel:124,
          minInterval:64, explicitMinInterval:56, maxAutoStations:9, maxExplicitStations:10,
          maxNameUnits:14, explicitMaxNameUnits:17
        };
      }
      return {
        name:'pc', edge:68, fontSize:state.uiMode === 'view' ? 13 : 12,
        minLabel:86, maxLabel:154, minInterval:74, explicitMinInterval:66,
        maxAutoStations:11, maxExplicitStations:12,
        maxNameUnits:16, explicitMaxNameUnits:18
      };
    }

    function timelineAvailableWidth() {
      const wrap = document.querySelector('.track-wrap');
      const measured = wrap?.getBoundingClientRect().width || 0;
      if (measured >= 120) return measured;

      const viewportWidth = window.innerWidth;
      const lowLandscapePhone = window.matchMedia('(orientation: landscape) and (max-height: 480px) and (max-width: 900px)').matches;
      if (viewportWidth <= 640 || lowLandscapePhone) return Math.max(0, viewportWidth - 32);

      if (viewportWidth <= 1100) {
        const appWidth = Math.max(0, Math.min(viewportWidth - 24, 1080));
        const twoColumn = state.uiMode !== 'view' && window.matchMedia(
          '(min-width: 900px) and (max-width: 1100px) and (orientation: landscape) and (min-height: 650px)'
        ).matches;
        if (!twoColumn) return Math.max(0, appWidth - 44);
        const columnsWidth = Math.max(0, appWidth - 16);
        const previewWidth = Math.max(0, Math.min(columnsWidth - 340, columnsWidth / 1.72));
        return Math.max(0, previewWidth - 40);
      }

      const appWidth = Math.max(0, Math.min(viewportWidth - 32, state.uiMode === 'view' ? 1160 : 1240));
      if (state.uiMode === 'view') return Math.max(0, Math.min(appWidth, 1080) - 56);
      const previewWidth = Math.max(0, appWidth - 430 - 18);
      return Math.max(0, previewWidth - 64);
    }

    function timelineLayoutMetrics(stations = state.stations) {
      const presentation = timelinePresentation(stations);
      const profile = timelineDeviceProfile();
      const availableWidth = timelineAvailableWidth();
      const nameUnits = stations.map((station) => timelineNameUnits(station?.name));
      const longestNameUnits = nameUnits.reduce((maximum, units) => Math.max(maximum, units), 0);
      const totalNameUnits = nameUnits.reduce((total, units) => total + units, 0);
      const averageNameUnits = presentation.count ? totalNameUnits / presentation.count : 0;
      const staggerLabels = presentation.staggerLabels || presentation.count >= 7 || averageNameUnits >= 7;
      const estimatedLabelWidth = Math.min(
        profile.maxLabel,
        Math.max(profile.minLabel, Math.ceil(longestNameUnits / 2) * profile.fontSize + 18)
      );
      const labelGap = profile.name === 'smartphone' ? 8 : 12;
      const labelInterval = staggerLabels
        ? (estimatedLabelWidth + labelGap + 2) / 2
        : estimatedLabelWidth + labelGap;
      const minimumInterval = Math.max(profile.minInterval, labelInterval);
      const explicitMinimumInterval = Math.max(profile.explicitMinInterval, labelInterval * .9);
      const intervalCount = Math.max(0, presentation.count - 1);
      const heightPenalty = window.innerHeight < 650 && presentation.count >= 7 ? 1.08 : 1;
      const viewPenalty = state.uiMode === 'view' && profile.name !== 'smartphone' ? 1.03 : 1;
      const requiredWidth = (profile.edge * 2 + intervalCount * minimumInterval) * heightPenalty * viewPenalty;
      const explicitRequiredWidth = profile.edge * 2 + intervalCount * explicitMinimumInterval;
      const contentUnsafe = presentation.count > profile.maxAutoStations ||
        longestNameUnits > profile.maxNameUnits || presentation.verticalRecommended;
      const explicitContentUnsafe = presentation.count > profile.maxExplicitStations ||
        longestNameUnits > profile.explicitMaxNameUnits;
      const widthUnsafe = availableWidth < requiredWidth + (profile.name === 'smartphone' ? 0 : 8);
      const explicitWidthUnsafe = availableWidth < explicitRequiredWidth + 4;
      const widthBucket = Math.round(availableWidth / 4) * 4;
      const namesKey = stations.map((station) => String(station?.name || '')).join('|');
      const timeKey = state.showNumbers
        ? stations.map((station) => state.mode === 'timer'
          ? String(station?.intervalMin ?? '')
          : `${station?.arrive || ''}-${station?.depart || ''}`).join('|')
        : 'numbers-hidden';
      const orientation = window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
      const heightClass = window.innerHeight < 650 ? 'low' : 'normal';
      const contentKey = [
        state.timelineMode, state.uiMode, state.mode, state.showNumbers ? 'numbers' : 'no-numbers',
        profile.name, orientation, heightClass, namesKey, timeKey
      ].join('::');
      const key = [contentKey, widthBucket].join('::');

      return {
        ...presentation,
        profile:profile.name,
        availableWidth,
        longestNameUnits,
        totalNameUnits,
        averageNameUnits,
        staggerLabels,
        estimatedLabelWidth,
        minimumInterval,
        requiredWidth,
        explicitRequiredWidth,
        contentUnsafe,
        explicitContentUnsafe,
        widthUnsafe,
        explicitWidthUnsafe,
        key,
        contentKey
      };
    }

