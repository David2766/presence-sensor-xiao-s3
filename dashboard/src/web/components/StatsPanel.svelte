<script>
  const props = $props();
  const text = $derived(props.messages.stats);

  const heatmapPeriodOptions = $derived([
    { id: "today", label: text.periodToday, days: 1 },
    { id: "3", label: text.periodDays(3), days: 3 },
    { id: "7", label: text.periodDays(7), days: 7 },
    { id: "15", label: text.periodDays(15), days: 15 },
    { id: "30", label: text.periodDays(30), days: 30 }
  ]);
  let selectedStatsPeriod = $state("");

  const todaySummary = $derived(summaryFromEntry(text.periodToday, props.stats?.today));
  const threeDaySummary = $derived(summaryFromServerOrEntries(text.recentDays(3), props.stats?.summary?.last3Days, rangeEntriesByDate(3)));
  const sevenDaySummary = $derived(summaryFromServerOrEntries(text.recentDays(7), props.stats?.summary?.last7Days, rangeEntriesByDate(7)));
  const fifteenDaySummary = $derived(summaryFromServerOrEntries(text.recentDays(15), props.stats?.summary?.last15Days, rangeEntriesByDate(15)));
  const thirtyDaySummary = $derived(summaryFromServerOrEntries(text.recentDays(30), props.stats?.summary?.last30Days, rangeEntriesByDate(30)));
  const summaryRows = $derived([todaySummary, threeDaySummary, sevenDaySummary, fifteenDaySummary, thirtyDaySummary]);
  const hasAnyStats = $derived(summaryRows.some((summary) => summary.filterHits + summary.reducedHits + summary.softwareHits > 0));

  const storageState = $derived(createStorageState());
  const heatmapInfo = $derived(createHeatmapInfo());
  const selectedPeriodOption = $derived(selectedStatsPeriodOption());
  const selectedEntries = $derived(rangeEntriesByDate(selectedPeriodOption.days));
  const selectedSummary = $derived(summaryForPeriod(selectedPeriodOption));
  const selectedTopSoftwareZones = $derived(rankZones(sumArray(selectedEntries, "sz"), text.zoneLabel));
  const selectedTopFilterZones = $derived(rankZones(sumArray(selectedEntries, "fz"), text.filterLabel));
  const selectedTopReducedZones = $derived(rankZones(sumArray(selectedEntries, "rz"), text.reducedLabel));
  const selectedPerformanceSummary = $derived(
    createPerformanceSummary(selectedSummary, selectedTopFilterZones, selectedTopReducedZones, selectedSummary.label)
  );
  const showStatsDetail = $derived(Boolean(selectedStatsPeriod));

  function summaryFromEntry(label, entry) {
    return summaryFromEntries(label, entry ? [entry] : []);
  }

  function summaryFromServerOrEntries(label, serverSummary, entries) {
    if (serverSummary) {
      return summaryFromEntries(label, [serverSummary]);
    }
    return summaryFromEntries(label, entries);
  }

  function summaryFromEntries(label, entries) {
    const validEntries = entries.filter(Boolean);
    return {
      label,
      filterHits: validEntries.reduce((sum, entry) => sum + safeNumber(entry.f), 0),
      reducedHits: validEntries.reduce((sum, entry) => sum + safeNumber(entry.r), 0),
      softwareHits: sumArray(validEntries, "sz").reduce((sum, value) => sum + value, 0),
      filterZoneHits: sumArray(validEntries, "fz").reduce((sum, value) => sum + value, 0),
      reducedZoneHits: sumArray(validEntries, "rz").reduce((sum, value) => sum + value, 0)
    };
  }

  function sumArray(entries, key) {
    const length = key === "sz" ? 6 : 4;
    const totals = Array.from({ length }, () => 0);
    for (const entry of entries) {
      if (!entry) continue;
      const values = Array.isArray(entry[key]) ? entry[key] : [];
      for (let index = 0; index < length; index += 1) {
        totals[index] += safeNumber(values[index]);
      }
    }
    return totals;
  }

  function rankZones(values, labelForIndex) {
    return values
      .map((value, index) => ({ label: labelForIndex(index + 1), value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }

  function summaryForPeriod(option) {
    if (option.id === "today") return todaySummary;
    if (option.id === "3") return threeDaySummary;
    if (option.id === "7") return sevenDaySummary;
    if (option.id === "15") return fifteenDaySummary;
    if (option.id === "30") return thirtyDaySummary;
    return todaySummary;
  }

  function createPerformanceSummary(summary, filterZones, reducedZones, periodLabel = text.recentDays(7)) {
    const protectedHits = summary.filterHits + summary.reducedHits;
    const topFilter = filterZones[0]?.label ?? "-";
    const topReduced = reducedZones[0]?.label ?? "-";
    return {
      protectedHits,
      topFilter,
      topReduced,
      message: protectedHits > 0
        ? text.performanceMessage(periodLabel, protectedHits)
        : text.noPerformanceData
    };
  }

  function rangeEntriesByDate(dayCount) {
    const todayKey = props.stats?.today?.d;
    const todaySerial = dayKeyToSerial(todayKey);
    if (!todaySerial) return [];

    const minSerial = todaySerial - dayCount + 1;
    const entries = [];
    const usedDays = new Set();
    const addEntry = (entry) => {
      const serial = dayKeyToSerial(entry?.d);
      if (!entry?.d || !serial || serial < minSerial || serial > todaySerial || usedDays.has(entry.d)) return;
      entries.push(entry);
      usedDays.add(entry.d);
    };

    addEntry(props.stats?.today);
    for (const entry of props.stats?.daily ?? []) {
      addEntry(entry);
    }
    return entries;
  }

  function safeNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  function createStorageState() {
    const daily = (props.stats?.daily ?? []).filter((entry) => entry?.d && dayKeyToSerial(entry.d));
    const days = Array.from(new Set(daily.map((entry) => entry.d))).sort((a, b) => a - b);
    if (!days.length) {
      return {
        count: 0,
        rangeText: text.noStoredDates,
        missingText: text.noStoredConfirmedDates
      };
    }

    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const firstSerial = dayKeyToSerial(firstDay);
    const lastSerial = dayKeyToSerial(lastDay);
    const missingDays = [];
    const storedSet = new Set(days);
    if (firstSerial && lastSerial) {
      for (let serial = firstSerial; serial <= lastSerial; serial += 1) {
        const key = serialToDayKey(serial);
        if (!storedSet.has(key)) missingDays.push(key);
      }
    }

    return {
      count: days.length,
      rangeText: `${formatDateKey(firstDay)} ~ ${formatDateKey(lastDay)}`,
      missingText: missingDays.length
        ? text.missingDates(missingDays.length, missingDays.slice(0, 5).map(formatDateKey), missingDays.length > 5)
        : text.noMissingDates
    };
  }

  function dayKeyToSerial(dayKey) {
    if (!dayKey) return 0;
    const value = Number(dayKey);
    if (!Number.isFinite(value)) return 0;
    let year = Math.floor(value / 10000);
    let month = Math.floor(value / 100) % 100;
    const day = value % 100;
    if (month < 1 || month > 12 || day < 1 || day > 31) return 0;
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    return 365 * year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) + Math.floor((153 * (month - 3) + 2) / 5) + day - 1;
  }

  function serialToDayKey(serial) {
    const date = new Date(Date.UTC(1970, 0, 1));
    const epochSerial = dayKeyToSerial(19700101);
    date.setUTCDate(date.getUTCDate() + (serial - epochSerial));
    return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  }

  function formatDateKey(value) {
    if (!value) return "-";
    const textValue = String(value);
    if (textValue.length !== 8) return textValue;
    return `${textValue.slice(0, 4)}-${textValue.slice(4, 6)}-${textValue.slice(6, 8)}`;
  }

  function createHeatmapInfo() {
    const heatmap = props.stats?.heatmap;
    const cols = safeNumber(heatmap?.cols) || 33;
    const rows = safeNumber(heatmap?.rows) || 26;
    const period = selectedStatsPeriodOption();
    const cells = Array.from({ length: cols * rows }, () => 0);
    addHeatmapCells(cells, decodeHeatmapRle(heatmap?.today || "", cols * rows));

    if (period.days > 1) {
      for (const entry of heatmapDailyEntriesByDate(period.days)) {
        addHeatmapCells(cells, decodeHeatmapRle(entry.data || "", cols * rows));
      }
    }

    const max = Math.max(...cells, 0);
    const activeCells = cells.filter((value) => value > 0).length;
    const totalHits = cells.reduce((sum, value) => sum + value, 0);
    return {
      cols,
      rows,
      label: period.label,
      cells,
      max,
      activeCells,
      totalHits
    };
  }

  function selectedStatsPeriodOption() {
    return heatmapPeriodOptions.find((option) => option.id === selectedStatsPeriod) ?? heatmapPeriodOptions[0];
  }

  function heatmapDailyEntriesByDate(dayCount) {
    const todayKey = props.stats?.today?.d;
    const todaySerial = dayKeyToSerial(todayKey);
    if (!todaySerial) return [];

    const minSerial = todaySerial - dayCount + 1;
    const usedDays = new Set();
    const entries = [];
    for (const item of props.stats?.heatmap?.daily ?? []) {
      if (!item || typeof item === "string") continue;
      const day = item.d;
      const serial = dayKeyToSerial(day);
      if (!day || !serial || serial < minSerial || serial >= todaySerial || usedDays.has(day)) continue;
      entries.push({ d: day, data: typeof item.data === "string" ? item.data : "" });
      usedDays.add(day);
    }
    return entries;
  }

  function addHeatmapCells(target, source) {
    for (let index = 0; index < target.length; index += 1) {
      target[index] += safeNumber(source[index]);
    }
  }

  function decodeHeatmapRle(value, expectedLength) {
    const cells = [];
    if (typeof value === "string" && value.trim()) {
      for (const token of value.split(",")) {
        const match = /^(\d+)x(\d+)$/.exec(token.trim());
        if (!match) continue;
        const cellValue = Number(match[1]);
        const count = Number(match[2]);
        if (!Number.isFinite(cellValue) || !Number.isFinite(count) || count <= 0) continue;
        for (let index = 0; index < count && cells.length < expectedLength; index += 1) {
          cells.push(cellValue);
        }
      }
    }
    while (cells.length < expectedLength) cells.push(0);
    return cells.slice(0, expectedLength);
  }

  function heatmapCellStyle(value) {
    if (!value || !heatmapInfo.max) return "opacity:0";
    const ratio = Math.min(1, value / heatmapInfo.max);
    const alpha = 0.18 + ratio * 0.72;
    return `opacity:${alpha}`;
  }

  function heatmapDisplayCells() {
    const cells = [];
    for (let row = heatmapInfo.rows - 1; row >= 0; row -= 1) {
      for (let col = 0; col < heatmapInfo.cols; col += 1) {
        cells.push(heatmapInfo.cells[row * heatmapInfo.cols + col] ?? 0);
      }
    }
    return cells;
  }
</script>

<section class="stats-panel">
  <div class="stats-main-layout" data-detail={showStatsDetail ? "true" : "false"}>
    <aside class="stats-control-column">
      <section class="floorplan-workflow-card zone-summary-card stats-overview-card">
        <div class="stats-overview-title">
          <strong>{text.title}</strong>
          <span>{text.description}</span>
        </div>
        <dl class="zone-summary-list stats-overview-summary">
          <div>
            <dt>{text.status}</dt>
            <dd>{props.error ? text.error : props.loading ? text.refreshing : text.dataReady}</dd>
          </div>
          <div>
            <dt>{text.period}</dt>
            <dd>{selectedStatsPeriod ? selectedSummary.label : text.unselected}</dd>
          </div>
          <div>
            <dt>{text.storage}</dt>
            <dd>{text.count(storageState.count)}</dd>
          </div>
          <div>
            <dt>{text.detection}</dt>
            <dd>{text.hits(heatmapInfo.totalHits)}</dd>
          </div>
          <div>
            <dt>{text.falsePositiveCorrection}</dt>
            <dd>{text.hits(selectedPerformanceSummary.protectedHits)}</dd>
          </div>
        </dl>
        <button type="button" onclick={props.onRefresh} disabled={props.loading}>{props.loading ? text.refreshing : text.refresh}</button>
      </section>

      {#if props.error}
        <section class="stats-state-card error">
          <strong>{text.readFailedTitle}</strong>
          <span>{props.error}</span>
        </section>
      {:else if !props.loading && !hasAnyStats}
        <section class="stats-state-card empty">
          <strong>{text.emptyTitle}</strong>
          <span>{text.emptyDescription}</span>
        </section>
      {/if}

      <div class="stats-period-selector">
        <strong>{text.periodSelect}</strong>
        <div class="heatmap-period-tabs" aria-label={text.periodAria}>
          {#each heatmapPeriodOptions as option}
            <button
              type="button"
              data-active={selectedStatsPeriod === option.id ? "true" : "false"}
              onclick={() => (selectedStatsPeriod = selectedStatsPeriod === option.id ? "" : option.id)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    </aside>

    {#if showStatsDetail}
      <section class="stats-middle-column">
        <section class="stats-card stats-selected-detail">
          <div class="stats-chart-header">
            <strong>{text.summaryTitle(selectedSummary.label)}</strong>
            <span>{text.selectedSummaryHint}</span>
          </div>
          {@render summaryCard(selectedSummary)}
          <div class="stats-chart">
            {@render chartRow(selectedSummary)}
          </div>
        </section>

        <section class="stats-card stats-performance-compact">
          <strong>{text.performanceTitle}</strong>
          <span>{selectedPerformanceSummary.message}</span>
          <dl class="stats-meta">
            <div>
              <dt>{text.blockedAndReduced}</dt>
              <dd>{selectedPerformanceSummary.protectedHits}</dd>
            </div>
            <div>
              <dt>{text.topFilterZone}</dt>
              <dd>{selectedPerformanceSummary.topFilter}</dd>
            </div>
            <div>
              <dt>{text.topReducedZone}</dt>
              <dd>{selectedPerformanceSummary.topReduced}</dd>
            </div>
          </dl>
        </section>

        <section class="stats-card stats-chart-card">
          <div class="stats-chart-header">
            <strong>{text.periodTrend}</strong>
            <span>{text.periodTrendHint}</span>
          </div>
          <div class="stats-chart">
            {#each summaryRows as summary}
              {@render chartRow(summary)}
            {/each}
          </div>
        </section>
      </section>
    {/if}

    <aside class="stats-heatmap-column">
      <div class="heatmap-preview">
        <div
          class="heatmap-grid"
          style={`grid-template-columns:repeat(${heatmapInfo.cols}, 1fr);grid-template-rows:repeat(${heatmapInfo.rows}, 1fr);`}
        >
          {#each heatmapDisplayCells() as value}
            <i style={heatmapCellStyle(value)} title={value ? text.heatmapCellHits(value) : text.noRecord}></i>
          {/each}
        </div>
        <span class="heatmap-distance-label heatmap-distance-label-2m">2m</span>
        <span class="heatmap-distance-label heatmap-distance-label-4m">4m</span>
        <span class="heatmap-distance-label heatmap-distance-label-6m">6m</span>
        <span class="heatmap-distance-label heatmap-distance-label-8m">8m</span>
        <div class="heatmap-sensor"></div>
        <p class="map-status-line stats-heatmap-status">
          {heatmapInfo.totalHits
            ? text.heatmapStatus(heatmapInfo.label, heatmapInfo.totalHits, heatmapInfo.activeCells)
            : text.heatmapEmpty(heatmapInfo.label)}
        </p>
      </div>
      {#if showStatsDetail}
        <div class="stats-heatmap-detail-row">
          <section class="stats-card">
            <strong>{text.topDetectionZones}</strong>
            {@render rankList(selectedTopSoftwareZones, text.noDetectionZoneHits)}
          </section>

          <section class="stats-card">
            <strong>{text.topFilterZones}</strong>
            {@render rankList(selectedTopFilterZones, text.noFilterZoneHits)}
          </section>

          <section class="stats-card">
            <strong>{text.topReducedZones}</strong>
            {@render rankList(selectedTopReducedZones, text.noReducedZoneHits)}
          </section>

          <details class="stats-card stats-debug-card">
            <summary>
              <strong>{text.storageState}</strong>
              <span>{text.recentConfirmedDates}</span>
            </summary>
            <dl class="stats-meta">
              <div>
                <dt>{text.storedDates}</dt>
                <dd>{text.count(storageState.count)}</dd>
              </div>
              <div>
                <dt>{text.storageRange}</dt>
                <dd>{storageState.rangeText}</dd>
              </div>
              <div>
                <dt>{text.middleMissing}</dt>
                <dd>{storageState.missingText}</dd>
              </div>
            </dl>
          </details>
        </div>
      {/if}
    </aside>
  </div>
</section>

{#snippet summaryCard(summary)}
  <section class="stats-card summary">
    <div>
      <strong>{summary.label}</strong>
    </div>
    <dl class="stats-numbers">
      <div>
        <dt>{text.blocked}</dt>
        <dd>{summary.filterHits}</dd>
      </div>
      <div>
        <dt>{text.reduced}</dt>
        <dd>{summary.reducedHits}</dd>
      </div>
      <div>
        <dt>{text.zoneDetection}</dt>
        <dd>{summary.softwareHits}</dd>
      </div>
    </dl>
  </section>
{/snippet}

{#snippet chartRow(summary)}
  {@const maxValue = Math.max(summary.filterHits, summary.reducedHits, summary.softwareHits, 1)}
  <div class="stats-chart-row">
    <strong>{summary.label}</strong>
    <div class="stats-bars">
      {@render bar(text.blocked, summary.filterHits, maxValue, "filter")}
      {@render bar(text.reduced, summary.reducedHits, maxValue, "reduced")}
      {@render bar(text.zone, summary.softwareHits, maxValue, "zone")}
    </div>
  </div>
{/snippet}

{#snippet bar(label, value, maxValue, tone)}
  <div class="stats-bar-line" data-tone={tone}>
    <span>{label}</span>
    <div class="stats-bar-track">
      <i style={`width:${Math.max(4, Math.round((value / maxValue) * 100))}%`}></i>
    </div>
    <strong>{value}</strong>
  </div>
{/snippet}

{#snippet rankList(items, emptyText)}
  {#if items.length}
    <ol class="stats-rank-list">
      {#each items as item}
        <li>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="stats-empty">{emptyText}</p>
  {/if}
{/snippet}
