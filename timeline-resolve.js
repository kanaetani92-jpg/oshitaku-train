    function timelineCanUseVertical() {
      return window.matchMedia('(max-width: 640px) and (orientation: portrait)').matches;
    }

    function autoTimelineNeedsVertical(metrics) {
      if (!timelineCanUseVertical()) return false;
      if (state.uiMode !== 'view') return false;
      const tooWide = metrics.requiredWidth > metrics.availableWidth * 1.08;
      const manyLongStations = metrics.count >= 7 && (metrics.longestNameUnits >= 7 || metrics.averageNameUnits >= 5.8);
      return tooWide || manyLongStations;
    }

    function resolveTimelineLayout(stations = state.stations) {
      const metrics = timelineLayoutMetrics(stations);
      const requested = ['horizontal', 'vertical', 'auto'].includes(state.timelineMode) ? state.timelineMode : 'horizontal';
      let mode = 'horizontal';
      if (requested === 'vertical' && timelineCanUseVertical()) mode = 'vertical';
      if (requested === 'auto' && autoTimelineNeedsVertical(metrics)) mode = 'vertical';

      const renderKey = [
        requested, mode, metrics.profile,
        metrics.density, metrics.staggerLabels ? 'staggered' : 'single', metrics.contentKey
      ].join('::');
      return { requested, mode, renderKey, metrics };
    }

    function applyTimelineLayout(layout) {
      document.body.classList.toggle('timeline-horizontal', layout.mode === 'horizontal');
      document.body.classList.toggle('timeline-vertical', layout.mode === 'vertical');
      document.body.dataset.timelineRequested = layout.requested;
      document.body.dataset.timelineResolved = layout.mode;
      document.body.dataset.timelineProfile = layout.metrics.profile;
      lastTimelineRenderKey = layout.renderKey;
    }

