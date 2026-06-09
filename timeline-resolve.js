    function resolveTimelineLayout(stations = state.stations, { useHysteresis = true } = {}) {
      const metrics = timelineLayoutMetrics(stations);
      const requested = state.timelineMode;
      const renderedUnsafe = unsafeHorizontalLayout.contentKey === metrics.contentKey &&
        metrics.availableWidth <= unsafeHorizontalLayout.maxWidth;
      let mode = 'horizontal';
      let safetyFallback = false;

      if (requested === 'vertical') {
        mode = 'vertical';
      } else if (requested === 'horizontal') {
        safetyFallback = metrics.explicitContentUnsafe || metrics.explicitWidthUnsafe || renderedUnsafe;
        mode = safetyFallback ? 'vertical' : 'horizontal';
      } else {
        let unsafe = metrics.contentUnsafe || metrics.widthUnsafe || renderedUnsafe;
        if (useHysteresis && !metrics.contentUnsafe && !renderedUnsafe && lastResolvedTimelineMode) {
          const margin = 14;
          if (lastResolvedTimelineMode === 'horizontal') {
            unsafe = metrics.availableWidth < metrics.requiredWidth - margin;
          } else if (lastResolvedTimelineMode === 'vertical') {
            unsafe = metrics.availableWidth < metrics.requiredWidth + margin;
          }
        }
        mode = unsafe ? 'vertical' : 'horizontal';
      }

      const notice = requested === 'horizontal' && safetyFallback
        ? 'この画面幅と駅数では横表示が読みにくいため、縦表示に切り替えました。'
        : '';
      const renderKey = [
        mode, requested, safetyFallback ? 'fallback' : 'normal', metrics.profile,
        metrics.density, metrics.staggerLabels ? 'staggered' : 'single', metrics.contentKey
      ].join('::');
      return { mode, requested, safetyFallback, notice, renderKey, metrics };
    }

    function ensureTimelineLayoutNotice() {
      let notice = document.querySelector('#timelineLayoutNotice');
      if (notice) return notice;
      const wrap = document.querySelector('.track-wrap');
      if (!wrap) return null;
      notice = document.createElement('p');
      notice.id = 'timelineLayoutNotice';
      notice.className = 'timeline-layout-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.setAttribute('aria-atomic', 'true');
      notice.hidden = true;
      wrap.insertAdjacentElement('afterend', notice);
      return notice;
    }

    function updateTimelineLayoutNotice(layout) {
      const notice = ensureTimelineLayoutNotice();
      if (!notice) return;
      const text = layout.notice || '';
      if (text !== lastTimelineNoticeText) {
        lastTimelineNoticeText = text;
        notice.textContent = text;
      }
      notice.hidden = !text;
    }

    function applyTimelineLayout(layout) {
      document.body.classList.toggle('timeline-horizontal', layout.mode === 'horizontal');
      document.body.classList.toggle('timeline-vertical', layout.mode === 'vertical');
      document.body.classList.toggle('timeline-mode-auto', layout.requested === 'auto');
      document.body.classList.toggle('timeline-mode-requested-horizontal', layout.requested === 'horizontal');
      document.body.classList.toggle('timeline-mode-requested-vertical', layout.requested === 'vertical');
      document.body.classList.toggle('timeline-safety-fallback', layout.safetyFallback);
      document.body.dataset.timelineResolved = layout.mode;
      document.body.dataset.timelineRequested = layout.requested;
      document.body.dataset.timelineProfile = layout.metrics.profile;
      updateTimelineLayoutNotice(layout);
      lastResolvedTimelineMode = layout.mode;
      lastTimelineRenderKey = layout.renderKey;
    }

