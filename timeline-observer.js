    function rectOverlap(first, second, allowance = 1) {
      return Math.min(first.right, second.right) - Math.max(first.left, second.left) > allowance &&
        Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > allowance;
    }

    function horizontalLayoutHasCollision() {
      if (!document.body.classList.contains('timeline-horizontal')) return false;
      const wrap = document.querySelector('.track-wrap');
      const vehicle = document.querySelector('.vehicle');
      if (!wrap) return false;
      const wrapRect = wrap.getBoundingClientRect();
      if (wrap.scrollWidth > wrap.clientWidth + 1) return true;

      const stations = [...wrap.querySelectorAll('.station')].map((element) => ({
        rect:element.getBoundingClientRect(),
        label:element.querySelector('.station-label')?.getBoundingClientRect(),
        row:element.dataset.labelRow || 'base'
      }));
      for (const station of stations) {
        if (!station.label) continue;
        if (station.label.left < wrapRect.left - 1 || station.label.right > wrapRect.right + 1) return true;
      }
      for (let first = 0; first < stations.length; first += 1) {
        for (let second = first + 1; second < stations.length; second += 1) {
          if (rectOverlap(stations[first].rect, stations[second].rect, 1)) return true;
          if (stations[first].row === stations[second].row && stations[first].label && stations[second].label &&
            rectOverlap(stations[first].label, stations[second].label, 1)) return true;
        }
      }
      if (vehicle) {
        const vehicleRect = vehicle.getBoundingClientRect();
        if (stations.some((station) => rectOverlap(vehicleRect, station.rect, 4) ||
          (station.label && rectOverlap(vehicleRect, station.label, 4)))) return true;
      }
      return false;
    }

    function rememberUnsafeHorizontalLayout(layout) {
      if (unsafeHorizontalLayout.contentKey === layout.metrics.contentKey &&
        unsafeHorizontalLayout.maxWidth >= layout.metrics.availableWidth) return false;
      unsafeHorizontalLayout = {
        contentKey:layout.metrics.contentKey,
        maxWidth:layout.metrics.availableWidth + 8
      };
      return true;
    }

    function verifyRenderedTimelineLayout(layout) {
      if (layout.mode !== 'horizontal') return;
      window.requestAnimationFrame(() => {
        if (!horizontalLayoutHasCollision()) return;
        if (rememberUnsafeHorizontalLayout(layout)) scheduleTimelineLayoutRefresh();
      });
    }

    function scheduleTimelineLayoutRefresh() {
      if (timelineResizeFrame) return;
      timelineResizeFrame = window.requestAnimationFrame(() => {
        timelineResizeFrame = 0;
        const next = resolveTimelineLayout(state.stations);
        if (next.renderKey !== lastTimelineRenderKey) {
          render();
          return;
        }
        if (next.mode === 'horizontal' && horizontalLayoutHasCollision() && rememberUnsafeHorizontalLayout(next)) {
          window.requestAnimationFrame(render);
        }
      });
    }

    function setupTimelineResizeObserver() {
      const wrap = document.querySelector('.track-wrap');
      if (!wrap || typeof ResizeObserver === 'undefined') return;
      timelineResizeObserver?.disconnect();
      lastObservedTimelineWidth = wrap.getBoundingClientRect().width || 0;
      timelineResizeObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect?.width || 0;
        if (Math.abs(width - lastObservedTimelineWidth) < 1) return;
        lastObservedTimelineWidth = width;
        scheduleTimelineLayoutRefresh();
      });
      timelineResizeObserver.observe(wrap);
    }

    function equalTimelineVehiclePosition(schedule, rawPosition) {
      const stations = schedule.stations;
      const lastIndex = stations.length - 1;
      if (lastIndex <= 0) return 50;
      const rawOffset = clamp(rawPosition, 0, 1) * schedule.total;
      if (rawOffset <= stations[0].markerOffset) return 0;
      for (let index = 0; index < lastIndex; index += 1) {
        const from = stations[index].markerOffset;
        const to = stations[index + 1].markerOffset;
        if (rawOffset <= to || index === lastIndex - 1) {
          const ratio = to > from ? clamp((rawOffset - from) / (to - from), 0, 1) : 1;
          return ((index + ratio) / lastIndex) * 100;
        }
      }
      return 100;
    }

