    function verticalTimelineGeometry(layout) {
      const count = Math.max(1, Number(layout?.metrics?.count) || 1);
      const density = layout?.metrics?.density || 'comfortable';
      const preferredGap = {
        comfortable: 82,
        compact: 74,
        dense: 68,
        crowded: 62
      }[density] || 74;
      const edge = 28;
      const minimumHeight = count <= 2 ? 220 : 240;
      const rawHeight = edge * 2 + Math.max(0, count - 1) * preferredGap;
      const height = Math.min(680, Math.max(minimumHeight, rawHeight));
      const gap = count > 1 ? (height - edge * 2) / (count - 1) : 0;
      return { count, edge, gap, height };
    }

    function applyVerticalTimelineGeometry(layout, track) {
      const wrap = track?.closest('.track-wrap');
      if (!wrap) return null;
      if (layout.mode !== 'vertical') {
        wrap.style.removeProperty('--vertical-track-height');
        wrap.style.removeProperty('--vertical-station-gap');
        wrap.style.removeProperty('--vertical-track-edge');
        return null;
      }
      const geometry = verticalTimelineGeometry(layout);
      wrap.style.setProperty('--vertical-track-height', `${geometry.height}px`);
      wrap.style.setProperty('--vertical-station-gap', `${geometry.gap}px`);
      wrap.style.setProperty('--vertical-track-edge', `${geometry.edge}px`);
      return geometry;
    }

    renderTrack = function renderTrackResolved(data) {
      const layout = resolveTimelineLayout(data.schedule.stations);
      applyTimelineLayout(layout);
      const track = $('#track');
      const lastIndex = data.schedule.stations.length - 1;
      const presentation = layout.metrics;
      const verticalGeometry = applyVerticalTimelineGeometry(layout, track);
      ['comfortable', 'compact', 'dense', 'crowded'].forEach((density) => {
        document.body.classList.toggle(`timeline-density-${density}`, presentation.density === density);
      });
      document.body.classList.toggle('timeline-labels-staggered', presentation.staggerLabels);
      track.dataset.stationCount = String(presentation.count);
      track.dataset.timelineDensity = presentation.density;
      track.dataset.labelLayout = presentation.staggerLabels ? 'staggered' : 'single';

      [...track.querySelectorAll('.station')].forEach((element) => element.remove());
      data.schedule.stations.forEach((station, index) => {
        const pos = lastIndex > 0 ? (index / lastIndex) * 100 : 50;
        const verticalTop = verticalGeometry
          ? (verticalGeometry.count === 1
            ? verticalGeometry.height / 2
            : verticalGeometry.edge + index * verticalGeometry.gap)
          : null;
        const element = document.createElement('div');
        element.className = 'station';
        element.classList.toggle('station-edge-start', index === 0);
        element.classList.toggle('station-edge-end', index === lastIndex);
        element.classList.toggle('long-name', [...String(station.name || '')].length >= 7);
        element.dataset.labelRow = presentation.staggerLabels && index % 2 === 1 ? 'lower' : 'base';
        const isDone = state.mode === 'clock' ? state.clockDoneIndexes.includes(index) : state.doneUntilIndex >= index;
        const isReached = station.markerOffset <= data.elapsedMin + 1 / 120;
        if (isDone) element.classList.add('done');
        else if (isReached) element.classList.add('reached');
        const isCurrent = index === data.activeIndex && !isAllTasksDone(data.schedule);
        if (isCurrent) element.classList.add('current');
        if (data.late && index === data.activeIndex) element.classList.add('late');
        const stateLabel = isDone ? 'できた' : (isCurrent ? '現在' : (index === data.activeIndex + 1 ? '次の予定' : 'これから'));
        element.dataset.stationState = stateLabel;
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', `${station.name}駅、${stateLabel}`);
        if (isCurrent) element.setAttribute('aria-current', 'step');
        element.style.left = `${pos}%`;
        element.style.top = `${pos}%`;
        element.style.setProperty('--station-left', `${pos}%`);
        element.style.setProperty('--mobile-top', verticalTop === null ? `${pos}%` : `${verticalTop}px`);
        const label = stationTimeLabel(station, index, data.schedule.stations.length - 1);
        element.innerHTML = `${visualHtml(station, 'station-mini-icon')}<span class="station-label">${escapeHtml(station.name)}駅<span class="station-time">${escapeHtml(label)}</span></span>`;
        track.appendChild(element);
      });

      const vehiclePos = equalTimelineVehiclePosition(data.schedule, data.vehicle.pos);
      const verticalVehicleTop = verticalGeometry
        ? verticalGeometry.edge + (verticalGeometry.height - verticalGeometry.edge * 2) * (vehiclePos / 100)
        : null;
      $('#vehicle').style.left = `${vehiclePos}%`;
      $('#vehicle').style.setProperty('--vehicle-left', `${vehiclePos}%`);
      $('#vehicle').style.setProperty('--mobile-vehicle-top', verticalVehicleTop === null ? `${vehiclePos}%` : `${verticalVehicleTop}px`);
      $('#trackDone').style.setProperty('--progress', verticalVehicleTop === null ? `${vehiclePos}%` : `${verticalVehicleTop}px`);
      verifyRenderedTimelineLayout(layout);
    };

    window.addEventListener('orientationchange', scheduleTimelineLayoutRefresh, { passive:true });
    render();
    setupTimelineResizeObserver();
