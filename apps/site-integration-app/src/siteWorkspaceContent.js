import emsSiteDetailWorkspaces from "./mock-data/ems/site-detail-workspaces.json";
import visualizationPresets from "./mock-data/ems/visualization-presets.json";

const localized = (en, zhTW) => ({ en, "zh-TW": zhTW });

function translateField(value, locale) {
  if (Array.isArray(value)) {
    return value.map((item) => translateField(item, locale));
  }

  if (value && typeof value === "object") {
    if ("en" in value || "zh-TW" in value) {
      return value[locale] ?? value.en ?? value["zh-TW"] ?? "";
    }

    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, translateField(nested, locale)]));
  }

  return value;
}

const workflowCatalog = {
  "generation-forecasting-optimization": {
    workflow: "發電預測與優化",
    name: localized("Generation Forecasting & Optimization", "發電預測與優化"),
    category: localized("Generation", "發電"),
  },
  "consumption-forecasting-optimization": {
    workflow: "用電預測與優化",
    name: localized("Consumption Forecasting & Optimization", "用電預測與優化"),
    category: localized("Demand", "用電"),
  },
  "sell-power-forecasting-management": {
    workflow: "售電預測與管理",
    name: localized("Sell-Power Forecasting & Management", "售電預測與管理"),
    category: localized("Commercial dispatch", "售電"),
  },
  "bidirectional-charger-operations": {
    workflow: "雙向充電樁",
    name: localized("Bidirectional Charger Operations", "雙向充電樁"),
    category: localized("Charger reserve", "雙向充電"),
  },
  "charger-business-mode-forecasting": {
    workflow: "業模式管理預測",
    name: localized("Charger Business Mode Forecasting", "雙向充電樁商業模式管理預測"),
    category: localized("Business mode", "商業模式"),
  },
  "mobile-bidirectional-chargers": {
    workflow: "移動式雙向充電樁",
    name: localized("Mobile Bidirectional Chargers", "移動式雙向充電樁"),
    category: localized("Mobile support", "移動支援"),
  },
  "energy-resource-commercial-inventory": {
    workflow: "能源資源商品化庫存管理",
    name: localized("Energy Resource Commercial Inventory", "能源資源商品化庫存管理"),
    category: localized("Inventory", "能源庫存"),
  },
};

const reportTypeCatalog = {
  daily: {
    cadence: localized("Daily", "每日"),
    category: localized("Operations", "營運"),
  },
  monthly: {
    cadence: localized("Monthly", "每月"),
    category: localized("EMS performance", "EMS 績效"),
  },
  weekly: {
    cadence: localized("Weekly", "每週"),
    category: localized("EMS review", "EMS 檢討"),
  },
  settlement: {
    cadence: localized("Settlement", "結算"),
    category: localized("Commercial", "商務"),
  },
  review: {
    cadence: localized("Review", "審閱"),
    category: localized("Manager review", "管理審閱"),
  },
};

const chartFieldLabels = {
  actualKw: localized("Actual", "實際"),
  forecastKw: localized("Forecast", "預測"),
  socPct: localized("SOC", "SOC"),
  reserveFloorPct: localized("Reserve floor", "備轉底線"),
  plannedKw: localized("Planned", "計畫"),
  availableKw: localized("Available", "可用"),
  zoneTempC: localized("Zone temperature", "區域溫度"),
  setpointC: localized("Setpoint", "設定值"),
  runtimePct: localized("Runtime", "運轉率"),
};

const chartFieldUnits = {
  actualKw: "kW",
  forecastKw: "kW",
  plannedKw: "kW",
  availableKw: "kW",
  socPct: "%",
  reserveFloorPct: "%",
  zoneTempC: "°C",
  setpointC: "°C",
  runtimePct: "%",
};

const moduleMetricCatalog = {
  actualDemandKw: localized("Actual demand", "實際需量"),
  forecastDemandKw: localized("Forecast demand", "預測需量"),
  peakDemandKw: localized("Peak demand", "尖峰需量"),
  expectedSavingsUsd: localized("Expected savings", "預期節省"),
  demandResponseReady: localized("DR ready", "需量反應就緒"),
  activeChargers: localized("Active chargers", "啟用充電樁"),
  connectedFleetCount: localized("Fleet connected", "連接車隊"),
  v2gAvailableKw: localized("V2G available", "V2G 可用"),
  reserveMarginPct: localized("Reserve margin", "備轉餘裕"),
  utilizationPct: localized("Utilization", "使用率"),
  tradableInventoryMwh: localized("Tradable inventory", "可商品化庫存"),
  reservedInventoryMwh: localized("Reserved inventory", "保留庫存"),
  releaseThresholdMwh: localized("Release threshold", "釋放門檻"),
  settlementStatus: localized("Settlement", "結算狀態"),
  exportCommittedKw: localized("Committed export", "已承諾外售"),
  exportAvailableKw: localized("Available export", "可用外售"),
  expectedRevenueUsd: localized("Expected revenue", "預期收益"),
  nominationStatus: localized("Nomination", "提名狀態"),
};

const moduleMetricUnits = {
  actualDemandKw: "kW",
  forecastDemandKw: "kW",
  peakDemandKw: "kW",
  expectedSavingsUsd: "USD",
  activeChargers: localized("chargers", "樁"),
  connectedFleetCount: localized("assets", "資產"),
  v2gAvailableKw: "kW",
  reserveMarginPct: "%",
  utilizationPct: "%",
  tradableInventoryMwh: "MWh",
  reservedInventoryMwh: "MWh",
  releaseThresholdMwh: "MWh",
  exportCommittedKw: "kW",
  exportAvailableKw: "kW",
  expectedRevenueUsd: "USD",
};

const moduleMetricPriority = {
  "consumption-forecasting-optimization": ["actualDemandKw", "forecastDemandKw", "peakDemandKw", "expectedSavingsUsd", "demandResponseReady"],
  "bidirectional-charger-operations": ["v2gAvailableKw", "reserveMarginPct", "activeChargers", "connectedFleetCount", "utilizationPct"],
  "charger-business-mode-forecasting": ["activeChargers", "connectedFleetCount", "utilizationPct", "expectedRevenueUsd"],
  "sell-power-forecasting-management": ["exportAvailableKw", "exportCommittedKw", "expectedRevenueUsd", "nominationStatus"],
  "energy-resource-commercial-inventory": ["tradableInventoryMwh", "reservedInventoryMwh", "releaseThresholdMwh", "settlementStatus"],
};

const fallbackNarratives = {
  "taoyuan-logistics": {
    actionTitle: localized("Reserve capacity recovery", "備轉容量恢復"),
    actionBody: localized(
      "Bidirectional charger bank is held below reserve threshold until inverter checks complete.",
      "雙向充電樁備轉容量低於門檻，需待逆變器檢查完成後再恢復。",
    ),
    attentionTitle: localized("Immediate system review required", "有一項營運訊號需要檢查"),
    attentionBody: localized(
      "Demand optimization, charger reserve, and commercial inventory are currently linked by the same exception.",
      "需量優化、充電樁備轉與商品化庫存目前受到同一項例外共同影響。",
    ),
  },
  "taoyuan-hub": {
    actionTitle: localized("HVAC fault isolation", "HVAC 異常隔離"),
    actionBody: localized(
      "One meter stream is delayed; dispatch recommendations remain available while the HVAC exception is being isolated.",
      "有一路電表資料延遲，但在隔離 HVAC 例外期間，調度建議仍可使用。",
    ),
    attentionTitle: localized("One operating signal needs review", "有一項營運訊號需檢查"),
    attentionBody: localized(
      "Demand optimization can continue, but the next operator should review the drifting rooftop units before the evening peak.",
      "用電優化可持續進行，但下一位操作員需在晚間尖峰前檢查漂移中的屋頂機組。",
    ),
  },
  default: {
    actionTitle: localized("Site operating posture", "站點營運姿態"),
    actionBody: localized(
      "The site is operating inside its expected EMS band with a clear next operator checkpoint.",
      "此站點目前位於預期 EMS 區間內，並已有清楚的下一個操作檢查點。",
    ),
    attentionTitle: localized("Operator review prepared", "操作檢查已準備"),
    attentionBody: localized(
      "The site can move into the next planning or dispatch cycle without portfolio-level detours.",
      "此站點可直接進入下一輪規劃或調度，不需要回到投資組合層級重新整理。",
    ),
  },
};

function getLocalizedScalar(record, locale, englishKey, chineseKey) {
  return record?.[locale === "zh-TW" ? chineseKey : englishKey]
    ?? record?.[englishKey]
    ?? record?.[chineseKey]
    ?? "";
}

function getStatusLabel(status, locale) {
  const labels = {
    healthy: localized("Normal", "正常"),
    watch: localized("Warning", "警示"),
    critical: localized("Critical", "嚴重"),
  };

  return translateField(labels[status] ?? labels.healthy, locale);
}

function getMockWorkspace(siteId) {
  return emsSiteDetailWorkspaces.find((workspace) => workspace.site.id === siteId) ?? null;
}

function formatModuleMetricValue(key, value, locale) {
  if (typeof value === "boolean") {
    return translateField(value ? localized("Ready", "就緒") : localized("Blocked", "受阻"), locale);
  }

  if (typeof value === "number") {
    const unit = moduleMetricUnits[key];
    const localizedUnit = unit && typeof unit === "object" ? translateField(unit, locale) : unit;
    const numericValue = Number.isInteger(value) ? String(value) : value.toFixed(1);

    if (key.endsWith("Usd")) {
      return `$${numericValue}`;
    }

    return localizedUnit ? `${numericValue} ${localizedUnit}` : numericValue;
  }

  return String(value ?? "");
}

function buildModuleCommandMetrics(module, locale) {
  const metrics = module.metrics ?? {};
  const priority = moduleMetricPriority[module.moduleKey] ?? Object.keys(metrics);

  return priority
    .filter((key) => key in metrics)
    .slice(0, 5)
    .map((key) => ({
      key,
      label: translateField(moduleMetricCatalog[key] ?? localized(key, key), locale),
      value: formatModuleMetricValue(key, metrics[key], locale),
    }));
}

function buildMockModuleRecord(module, locale) {
  const catalogEntry = workflowCatalog[module.moduleKey];

  return {
    id: `${module.moduleKey}-${module.owner}`,
    workflow: catalogEntry?.workflow ?? module.nameZhTw ?? module.name,
    name: getLocalizedScalar(module, locale, "name", "nameZhTw"),
    category: catalogEntry ? translateField(catalogEntry.category, locale) : "",
    owner: module.owner,
    cadence: module.cadence,
    current: module.currentPosture,
    forecast: module.forecast,
    risk: module.risk,
    action: module.recommendedAction,
    metrics: module.metrics ?? {},
    commandMetrics: buildModuleCommandMetrics(module, locale),
  };
}

function buildMockReportRecord(report, locale) {
  const reportType = reportTypeCatalog[report.type] ?? reportTypeCatalog.review;
  const localizedTitle = getLocalizedScalar(report, locale, "title", "titleZhTw");
  const normalizedStatus = report.status === "attention"
    ? "critical"
    : report.status === "review" || report.status === "draft"
      ? "watch"
      : "healthy";

  return {
    id: report.id,
    type: report.type,
    cadence: translateField(reportType.cadence, locale),
    category: translateField(reportType.category, locale),
    title: localizedTitle,
    purpose: report.purpose,
    includes: report.includes,
    decisionCue: report.decisionCue,
    updated: report.updated,
    status: getStatusLabel(normalizedStatus, locale),
    statusKey: report.status,
    severity: normalizedStatus,
    summary: report.purpose,
    preview: report.purpose,
    fileName: `${report.id}.pdf`,
  };
}

function buildSyntheticReportSources(mock) {
  const hasDailyExceptionLog = mock.reports.some((report) => report.id === "daily-exception-log");
  const hasMonthlySummary = mock.reports.some((report) => report.type === "monthly");
  const syntheticReports = [];

  if (!hasDailyExceptionLog) {
    syntheticReports.push({
      id: "daily-exception-log",
      type: "daily",
      title: "Daily exception log",
      titleZhTw: "每日例外紀錄",
      status: mock.site.status === "healthy" ? "ready" : "attention",
      updated: mock.summary.lastUpdated,
      purpose: "List open alarms, owner handoffs, HVAC exceptions, and blockers that should remain visible for the next shift.",
      includes: [
        "Open alarm ownership",
        "HVAC exception notes",
        "Shift handoff blockers",
      ],
      decisionCue: "Which exception must stay on the next operator handoff?",
    });
  }

  if (!hasMonthlySummary) {
    syntheticReports.push({
      id: "monthly-ems-summary",
      type: "monthly",
      title: "Monthly EMS optimization summary",
      titleZhTw: "每月 EMS 優化摘要",
      status: mock.site.status === "healthy" ? "ready" : "review",
      updated: "2d ago",
      purpose: "Compare demand savings, charger reserve posture, inventory release readiness, and EMS workflow performance for the month.",
      includes: [
        "Demand optimization trend",
        "Bidirectional charger reserve summary",
        "Commercial inventory release history",
      ],
      decisionCue: "Should the next month keep the current reserve and release thresholds?",
    });
  }

  return syntheticReports;
}

function buildOverviewMetrics({ locale, reportCount, alarmCount, onlineDevices, moduleCount, failureCount, owner, ownerHint }) {
  return [
    {
      label: translateField(localized("Reports", "報告"), locale),
      value: String(reportCount),
      hint: translateField(localized("Available records", "可用記錄"), locale),
      tab: "reports",
    },
    {
      label: translateField(localized("Open alarms", "未結警報"), locale),
      value: String(alarmCount),
      hint: translateField(localized("Needs review", "需要檢查"), locale),
      tab: "alerts",
    },
    {
      label: translateField(localized("Online devices", "在線設備"), locale),
      value: onlineDevices,
      hint: translateField(localized("Operational availability", "營運可用性"), locale),
      tab: "devices",
    },
    {
      label: translateField(localized("EMS modules", "EMS 模組"), locale),
      value: String(moduleCount),
      hint: translateField(localized("Active workflows", "已啟用工作流程"), locale),
      tab: "ems",
    },
    {
      label: translateField(localized("Failure count", "異常數量"), locale),
      value: String(failureCount),
      hint: translateField(localized("Critical and warning items", "嚴重與警示項目"), locale),
      tab: "devices",
    },
    {
      label: translateField(localized("Primary owner", "主要負責人"), locale),
      value: owner,
      hint: ownerHint,
      tab: "site",
    },
  ];
}

function buildDeviceGroupsFromMock(mock, locale) {
  const { assets } = mock;

  return [
    {
      id: "hvac",
      name: translateField(localized("HVAC systems", "HVAC 系統"), locale),
      status: assets.hvac.status,
      summary: `${assets.hvac.onlineUnits}/${assets.hvac.totalUnits} ${translateField(localized("online", "在線"), locale)}`,
      detail: translateField(
        localized(`Setpoint drift ${assets.hvac.setpointDriftC}°C`, `溫控偏移 ${assets.hvac.setpointDriftC}°C`),
        locale,
      ),
      nextCheck: translateField(localized("Inspect the next equipment review cycle.", "下一輪設備檢查需優先確認。"), locale),
    },
    {
      id: "storage",
      name: translateField(localized("Storage reserve", "儲能備轉"), locale),
      status: assets.storage.reserveMarginPct <= 10 ? getStatusLabel("critical", locale) : getStatusLabel("healthy", locale),
      summary: `${assets.storage.stateOfChargePct}% SOC`,
      detail: translateField(
        localized(`${assets.storage.availablePowerKw} kW available power`, `${assets.storage.availablePowerKw} kW 可用功率`),
        locale,
      ),
      nextCheck: translateField(
        localized(`Reserve margin ${assets.storage.reserveMarginPct}%`, `備轉餘裕 ${assets.storage.reserveMarginPct}%`),
        locale,
      ),
    },
    {
      id: "chargers",
      name: translateField(localized("Bidirectional chargers", "雙向充電樁"), locale),
      status: assets.chargers.utilizationPct > 75 ? getStatusLabel("watch", locale) : getStatusLabel("healthy", locale),
      summary: `${assets.chargers.activeChargers} ${translateField(localized("active chargers", "啟用充電樁"), locale)}`,
      detail: translateField(
        localized(`${assets.chargers.connectedFleetCount} connected fleet assets`, `${assets.chargers.connectedFleetCount} 個已連接車隊資產`),
        locale,
      ),
      nextCheck: assets.chargers.businessModeRecommendation,
    },
    {
      id: "metering",
      name: translateField(localized("Commercial inventory", "商品化庫存"), locale),
      status: assets.inventory.settlementStatus,
      summary: `${assets.inventory.tradableInventoryMwh} MWh ${translateField(localized("tradable", "可商品化"), locale)}`,
      detail: translateField(
        localized(`${assets.inventory.reservedInventoryMwh} MWh reserved`, `${assets.inventory.reservedInventoryMwh} MWh 已保留`),
        locale,
      ),
      nextCheck: assets.inventory.holdReason || translateField(localized("Ready for release review.", "可進入釋放審查。"), locale),
    },
  ];
}

function buildAlertRecords(mock, locale) {
  return (mock.alerts ?? []).map((alert) => {
    const catalogEntry = workflowCatalog[alert.moduleKey];
    return {
      id: alert.id,
      severity: alert.severity,
      title: getLocalizedScalar(alert, locale, "title", "titleZhTw"),
      owner: alert.owner,
      openedAgo: alert.openedAgo,
      dueWindow: alert.dueWindow,
      module: catalogEntry ? translateField(catalogEntry.name, locale) : "",
      status: getStatusLabel(alert.severity, locale),
    };
  });
}

function buildSiteProfileFromMock(mock, locale, modules, onlineUnits) {
  return {
    owner: mock.site.owner.name,
    ownerTeam: mock.site.owner.team,
    code: mock.site.code,
    location: `${mock.site.city}, ${mock.site.country}`,
    siteType: mock.site.siteType,
    timezone: mock.site.timezone,
    onlineDevices: onlineUnits,
    workflowCount: String(modules.length),
    workflowLabels: modules.map((module) => module.name),
    note: mock.summary.nextAction,
  };
}

function resolveDataKey(source, dataKey) {
  if (!dataKey) {
    return null;
  }

  return dataKey.split(".").reduce((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return value[key];
    }

    return null;
  }, source);
}

function getChartUnit(yFields = []) {
  const units = new Set(yFields.map((field) => chartFieldUnits[field]).filter(Boolean));
  return units.size === 1 ? [...units][0] : "";
}

function buildChartRecord(config, locale, mock) {
  const yFields = config.yFields ?? [];
  const data = resolveDataKey(mock, config.dataKey);

  if (!config.dataKey || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return {
    id: config.id,
    tab: config.tab ?? "overview",
    type: config.type,
    title: getLocalizedScalar(config, locale, "title", "titleZhTw"),
    purpose: config.purpose ?? "",
    xField: config.xField ?? "hour",
    yFields,
    yLabels: Object.fromEntries(
      yFields.map((field) => [field, translateField(chartFieldLabels[field] ?? localized(field, field), locale)]),
    ),
    kindLabel: config.type?.includes("bar")
      ? translateField(localized("Plan", "計畫"), locale)
      : translateField(localized("Trend", "趨勢"), locale),
    unit: getChartUnit(yFields),
    data,
  };
}

function buildWorkspaceCharts(mock, locale) {
  const siteChartOverrides = new Map((mock.visualizations ?? []).map((chart) => [chart.id, chart]));
  const mergedConfigs = visualizationPresets
    .map((preset) => ({ ...preset, ...(siteChartOverrides.get(preset.id) ?? {}) }))
    .filter((config) => config.dataKey);

  return mergedConfigs.reduce((groups, config) => {
    const chart = buildChartRecord(config, locale, mock);
    if (!chart) {
      return groups;
    }

    if (!groups[chart.tab]) {
      groups[chart.tab] = [];
    }

    groups[chart.tab].push(chart);
    return groups;
  }, {});
}

function buildWorkspaceFromMock(site, locale, mock) {
  const modules = mock.modules.map((module) => buildMockModuleRecord(module, locale));
  const reportSortOrder = { daily: 0, monthly: 1, weekly: 2, settlement: 3, review: 4 };
  const reports = [...mock.reports, ...buildSyntheticReportSources(mock)]
    .map((report) => buildMockReportRecord(report, locale))
    .sort((a, b) => (reportSortOrder[a.type] ?? 99) - (reportSortOrder[b.type] ?? 99));
  const alerts = buildAlertRecords(mock, locale);
  const onlineUnits = mock.assets.hvac.totalUnits > 0 ? `${mock.assets.hvac.onlineUnits}/${mock.assets.hvac.totalUnits}` : `${site.deviceCount}/64`;
  const deviceGroups = buildDeviceGroupsFromMock(mock, locale);
  const failureCount = alerts.filter((alert) => alert.severity !== "healthy").length;
  const charts = buildWorkspaceCharts(mock, locale);

  return {
    overview: {
      headline: getLocalizedScalar(mock.summary, locale, "headline", "headlineZhTw"),
      summary: mock.summary.nextAction,
      meta: {
        owner: mock.site.owner.name,
        updatedAt: mock.summary.lastUpdated,
        posture: mock.summary.currentPosture,
      },
      metrics: buildOverviewMetrics({
        locale,
        reportCount: reports.length,
        alarmCount: mock.summary.openAlarmCount,
        onlineDevices: onlineUnits,
        moduleCount: modules.length,
        failureCount,
        owner: mock.site.owner.name,
        ownerHint: mock.site.owner.team,
      }),
      nextStops: [
        {
          label: translateField(localized("Open alerts", "查看警報"), locale),
          detail: translateField(localized(`${mock.summary.openAlarmCount} items need review`, `${mock.summary.openAlarmCount} 個項目需要檢查`), locale),
          tab: "alerts",
        },
        {
          label: translateField(localized("Review EMS modules", "檢視 EMS 模組"), locale),
          detail: translateField(localized(`${modules.length} workflows are active here`, `此站點已啟用 ${modules.length} 個工作流程`), locale),
          tab: "ems",
        },
        {
          label: translateField(localized("Check latest reports", "查看最新報告"), locale),
          detail: reports[0]?.title ?? translateField(localized("No reports yet", "尚無報告"), locale),
          tab: "reports",
        },
      ],
    },
    devices: {
      summary: [
        {
          label: translateField(localized("HVAC systems", "HVAC 系統"), locale),
          value: mock.assets.hvac.status,
          hint: translateField(localized("Current operating posture", "目前營運姿態"), locale),
        },
        {
          label: translateField(localized("Online devices", "在線設備"), locale),
          value: onlineUnits,
          hint: translateField(localized("Operational availability", "營運可用性"), locale),
        },
        {
          label: translateField(localized("Open alarms", "未結警報"), locale),
          value: String(mock.summary.openAlarmCount),
          hint: translateField(localized("Requires operator review", "需要操作員檢查"), locale),
        },
        {
          label: translateField(localized("Failure count", "異常數量"), locale),
          value: String(failureCount),
          hint: translateField(localized("Critical and warning items", "嚴重與警示項目"), locale),
        },
      ],
      groups: deviceGroups,
    },
    readiness: [
      {
        label: translateField(localized("HVAC systems", "HVAC 系統"), locale),
        value: mock.assets.hvac.status,
        hint: translateField(localized("Current operating posture", "目前營運姿態"), locale),
      },
      {
        label: translateField(localized("EMS status", "EMS 狀態"), locale),
        value: mock.summary.currentPosture,
        hint: translateField(localized("Workflow readiness", "工作流程就緒度"), locale),
      },
      {
        label: translateField(localized("Open alarms", "未結警報"), locale),
        value: String(mock.summary.openAlarmCount),
        hint: translateField(localized("Requires operator review", "需要操作員檢查"), locale),
      },
      {
        label: translateField(localized("Online devices", "在線設備"), locale),
        value: onlineUnits,
        hint: translateField(localized("Connected HVAC endpoints", "已連接 HVAC 端點"), locale),
      },
    ],
    modules,
    reports,
    alerts,
    site: buildSiteProfileFromMock(mock, locale, modules, onlineUnits),
    charts,
    visualizations: mock.visualizations ?? [],
  };
}

function getFallbackNarrative(siteId) {
  return fallbackNarratives[siteId] ?? fallbackNarratives.default;
}

function buildFallbackWorkspace(site, locale) {
  const narrative = getFallbackNarrative(site.id);
  const workflows = site.workflows
    .map((workflow) => {
      const entry = Object.values(workflowCatalog).find((item) => item.workflow === workflow);
      if (!entry) {
        return null;
      }

      const status = site.status;

      return {
        id: `${site.id}-${workflow}`,
        workflow,
        name: translateField(entry.name, locale),
        category: translateField(entry.category, locale),
        owner: translateField(localized("Site operations", "站點營運"), locale),
        cadence: translateField(localized("Daily review", "每日檢查"), locale),
        current: status === "critical"
          ? translateField(localized("Needs operator intervention", "需要操作員介入"), locale)
          : status === "watch"
            ? translateField(localized("Needs review", "需要檢查"), locale)
            : translateField(localized("Operating within plan", "位於計畫區間內"), locale),
        forecast: translateField(localized("Forecast remains within the current operating band.", "預測仍位於目前營運區間內。"), locale),
        risk: status === "critical"
          ? translateField(localized("Elevated", "偏高"), locale)
          : status === "watch"
            ? translateField(localized("Watched", "追蹤中"), locale)
            : translateField(localized("Low", "低"), locale),
        action: narrative.actionTitle ? translateField(narrative.actionTitle, locale) : "",
        metrics: {},
      };
    })
    .filter(Boolean);

  const reports = [
    {
      id: `${site.id}-daily`,
      cadence: translateField(localized("Daily", "Daily"), locale),
      category: translateField(localized("Operations", "營運"), locale),
      title: translateField(localized("Daily operations brief", "每日營運簡報"), locale),
      purpose: translateField(localized("A concise handoff for site-level posture and the next operator check.", "站點姿態與下一個操作檢查的簡明交接。"), locale),
      includes: [
        translateField(localized("Operating posture", "營運姿態"), locale),
        translateField(localized("Open alarms", "未結警報"), locale),
        translateField(localized("Next operator checkpoint", "下一個操作檢查點"), locale),
      ],
      decisionCue: translateField(localized("Confirm the next operator checkpoint.", "確認下一個操作檢查點。"), locale),
      updated: site.updatedAt,
      status: getStatusLabel(site.status, locale),
      statusKey: site.status === "critical" ? "attention" : site.status === "watch" ? "review" : "ready",
      severity: site.status,
      summary: translateField(localized("Site report summary is available for this workspace.", "此工作區已有站點報告摘要。"), locale),
      preview: translateField(localized("Site report summary is available for this workspace.", "此工作區已有站點報告摘要。"), locale),
      fileName: `${site.code}-daily-ops-brief.pdf`,
    },
  ];

  const alerts = site.alerts > 0
    ? [
      {
        id: `${site.id}-alert-1`,
        severity: site.status,
        title: translateField(narrative.attentionTitle, locale),
        owner: site.contact,
        openedAgo: site.updatedAt,
        dueWindow: translateField(localized("Before the next operator checkpoint", "下一個操作檢查前"), locale),
        module: workflows[0]?.name ?? "",
        status: getStatusLabel(site.status, locale),
      },
    ]
    : [];

  const onlineUnits = `${site.deviceCount}/64`;
  const failureCount = site.status === "healthy" ? 0 : site.alerts;
  const deviceGroups = [
    {
      id: "hvac",
      name: translateField(localized("HVAC systems", "HVAC 系統"), locale),
      status: site.hvac,
      summary: `${site.deviceCount}/64 ${translateField(localized("online", "在線"), locale)}`,
      detail: translateField(localized("Site equipment remains aligned to the current plan.", "站點設備仍與目前計畫一致。"), locale),
      nextCheck: translateField(narrative.actionBody, locale),
    },
    {
      id: "ems",
      name: translateField(localized("EMS readiness", "EMS 就緒度"), locale),
      status: site.ems,
      summary: translateField(localized(`${workflows.length} connected workflows`, `${workflows.length} 個已連接工作流程`), locale),
      detail: translateField(localized("Workflow posture stays tied to site-level operation only.", "工作流程姿態僅綁定站點層級營運。"), locale),
      nextCheck: translateField(narrative.attentionBody, locale),
    },
  ];

  return {
    overview: {
      headline: translateField(narrative.actionTitle, locale),
      summary: translateField(narrative.actionBody, locale),
      meta: {
        owner: site.contact,
        updatedAt: site.updatedAt,
        posture: site.status === "critical"
          ? translateField(localized("Immediate system review required", "需要立即檢查系統"), locale)
          : site.status === "watch"
            ? translateField(localized("One operating signal needs review", "有一項營運訊號需檢查"), locale)
            : translateField(localized("All operating signals aligned", "所有營運訊號一致"), locale),
      },
      metrics: buildOverviewMetrics({
        locale,
        reportCount: reports.length,
        alarmCount: site.alerts,
        onlineDevices: onlineUnits,
        moduleCount: workflows.length,
        failureCount,
        owner: site.contact,
        ownerHint: translateField(localized("Site operations", "站點營運"), locale),
      }),
      nextStops: [
        {
          label: translateField(localized("Review devices", "檢視設備"), locale),
          detail: translateField(localized(`${site.deviceCount}/64 devices are connected`, `${site.deviceCount}/64 台設備已連接`), locale),
          tab: "devices",
        },
        {
          label: translateField(localized("Review EMS modules", "檢視 EMS 模組"), locale),
          detail: translateField(localized(`${workflows.length} workflows are active here`, `此站點已啟用 ${workflows.length} 個工作流程`), locale),
          tab: "ems",
        },
        {
          label: translateField(localized("Check latest reports", "查看最新報告"), locale),
          detail: reports[0]?.title ?? translateField(localized("No reports yet", "尚無報告"), locale),
          tab: "reports",
        },
      ],
    },
    devices: {
      summary: [
        {
          label: translateField(localized("HVAC systems", "HVAC 系統"), locale),
          value: site.hvac,
          hint: translateField(localized("Current operating posture", "目前營運姿態"), locale),
        },
        {
          label: translateField(localized("Online devices", "在線設備"), locale),
          value: onlineUnits,
          hint: translateField(localized("Operational availability", "營運可用性"), locale),
        },
        {
          label: translateField(localized("Open alarms", "未結警報"), locale),
          value: String(site.alerts),
          hint: translateField(localized("Requires operator review", "需要操作員檢查"), locale),
        },
        {
          label: translateField(localized("Failure count", "異常數量"), locale),
          value: String(failureCount),
          hint: translateField(localized("Critical and warning items", "嚴重與警示項目"), locale),
        },
      ],
      groups: deviceGroups,
    },
    readiness: [
      {
        label: translateField(localized("HVAC systems", "HVAC 系統"), locale),
        value: site.hvac,
        hint: translateField(localized("Current operating posture", "目前營運姿態"), locale),
      },
      {
        label: translateField(localized("EMS status", "EMS 狀態"), locale),
        value: site.ems,
        hint: translateField(localized("Workflow readiness", "工作流程就緒度"), locale),
      },
      {
        label: translateField(localized("Open alarms", "未結警報"), locale),
        value: String(site.alerts),
        hint: translateField(localized("Requires operator review", "需要操作員檢查"), locale),
      },
      {
        label: translateField(localized("Online devices", "在線設備"), locale),
        value: `${site.deviceCount}/64`,
        hint: translateField(localized("Connected HVAC endpoints", "已連接 HVAC 端點"), locale),
      },
    ],
    modules: workflows,
    reports,
    alerts,
    site: {
      owner: site.contact,
      ownerTeam: translateField(localized("Site operations", "站點營運"), locale),
      code: site.code,
      location: `${site.city}, ${site.country}`,
      siteType: translateField(localized("Operational site", "營運站點"), locale),
      timezone: "",
      onlineDevices: onlineUnits,
      workflowCount: String(workflows.length),
      workflowLabels: workflows.map((workflow) => workflow.name),
      note: translateField(narrative.actionBody, locale),
    },
    visualizations: [],
    charts: {},
  };
}

export function buildSiteWorkspace(site, locale) {
  const mockWorkspace = getMockWorkspace(site.id);
  if (mockWorkspace) {
    return buildWorkspaceFromMock(site, locale, mockWorkspace);
  }

  return buildFallbackWorkspace(site, locale);
}
