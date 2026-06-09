    effectiveTimelineMode = function effectiveTimelineModeResolved() {
      document.body.classList.toggle('view-mode', state.uiMode === 'view');
      const layout = resolveTimelineLayout(state.stations);
      applyTimelineLayout(layout);
      window.__oshitakuTimelineLayout = layout;
      return layout.mode;
    };

    renderTrack = function renderTrackResolved(data) {
      const layout = window.__oshitakuTimelineLayout || resolveTimelineLayout(data.schedule.stations);
      const track = $('#track');
      const horizontal = layout.mode === 'horizontal';
      const lastIndex = data.schedule.stations.length - 1;
      const presentation = layout.metrics;
      ['comfortable', 'compact', 'dense', 'crowded'].forEach((density) => {
        document.body.classList.toggle(`timeline-density-${density}`, presentation.density === density);
      });
      document.body.classList.toggle('timeline-labels-staggered', presentation.staggerLabels);
      document.body.classList.toggle('timeline-vertical-recommended', presentation.verticalRecommended);
      track.dataset.stationCount = String(presentation.count);
      track.dataset.timelineDensity = presentation.density;
      track.dataset.labelLayout = presentation.staggerLabels ? 'staggered' : 'single';
      track.dataset.verticalRecommended = String(presentation.verticalRecommended);

      [...track.querySelectorAll('.station')].forEach((element) => element.remove());
      data.schedule.stations.forEach((station, index) => {
        const pos = horizontal
          ? (lastIndex > 0 ? (index / lastIndex) * 100 : 50)
          : clamp(station.markerOffset / data.schedule.total, 0, 1) * 100;
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
        if (index === data.activeIndex && !isAllTasksDone(data.schedule)) element.classList.add('current');
        if (data.late && index === data.activeIndex) element.classList.add('late');
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', `${station.name}駅、${isDone ? 'できた' : (index === data.activeIndex ? 'いますること' : 'まだ')}`);
        element.style.left = `${pos}%`;
        element.style.setProperty('--station-left', `${pos}%`);
        element.style.setProperty('--mobile-top', `${pos}%`);
        const label = stationTimeLabel(station, index, data.schedule.stations.length - 1);
        element.innerHTML = `${visualHtml(station, 'station-mini-icon')}<span class="station-label">${escapeHtml(station.name)}駅<span class="station-time">${escapeHtml(label)}</span></span>`;
        track.appendChild(element);
      });

      const vehiclePos = horizontal
        ? equalTimelineVehiclePosition(data.schedule, data.vehicle.pos)
        : data.vehicle.pos * 100;
      $('#vehicle').style.left = `${vehiclePos}%`;
      $('#vehicle').style.setProperty('--vehicle-left', `${vehiclePos}%`);
      $('#vehicle').style.setProperty('--mobile-vehicle-top', `${vehiclePos}%`);
      $('#trackDone').style.setProperty('--progress', `${vehiclePos}%`);
      verifyRenderedTimelineLayout(layout);
    };

    window.addEventListener('orientationchange', scheduleTimelineLayoutRefresh, { passive:true });
    render();
    setupTimelineResizeObserver();
