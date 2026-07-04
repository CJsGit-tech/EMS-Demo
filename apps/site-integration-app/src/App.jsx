import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Bell,
  Building2,
  CheckCircle2,
  Gauge,
  Globe,
  MapPin,
  Minus,
  Moon,
  Package,
  Plus,
  Sun,
  ThermometerSun,
  Truck,
  UserCircle,
  X,
  Zap,
} from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import worldAtlas from "world-atlas/countries-110m.json";
import { createTranslator, i18nConfig } from "./i18nConfig";

const workflowGroups = [
  { label: "發電預測與優化", icon: Zap },
  { label: "用電預測與優化", icon: Gauge },
  { label: "售電預測與管理", icon: Activity },
  { label: "雙向充電樁", icon: BatteryCharging },
  { label: "業模式管理預測", icon: Building2 },
  { label: "移動式雙向充電樁", icon: Truck },
  { label: "能源資源商品化庫存管理", icon: Package },
];

const issues = [
  {
    site: "Arizona Array",
    issue: "Battery cooling variance",
    status: "critical",
    updated: "1m",
  },
  {
    site: "Taipei Hub",
    issue: "Two rooftop units drifting",
    status: "watch",
    updated: "9m",
  },
  {
    site: "Tokyo Campus",
    issue: "Peak shaving review pending",
    status: "healthy",
    updated: "14m",
  },
  {
    site: "Rotterdam Port",
    issue: "Evening dispatch check",
    status: "healthy",
    updated: "22m",
  },
];

const siteData = [
  {
    id: "tokyo-campus",
    code: "TYO-01",
    name: "Tokyo Campus",
    country: "Japan",
    city: "Tokyo",
    region: "Asia Pacific",
    coordinates: [139.6917, 35.6895],
    status: "healthy",
    priority: "Normal",
    hvac: "Normal",
    ems: "Normal",
    deviceCount: 46,
    alerts: 1,
    focus: "Cooling optimization",
    contact: "Aiko Tanaka",
    updatedAt: "4m ago",
    workflows: ["發電預測與優化", "用電預測與優化", "雙向充電樁"],
    note: "Peak shaving window opens at 15:30 local time.",
  },
  {
    id: "tokyo-orbit",
    code: "TYO-05",
    name: "Tokyo Orbit",
    country: "Japan",
    city: "Tokyo",
    region: "Asia Pacific",
    coordinates: [139.6932, 35.6912],
    status: "watch",
    priority: "Warning",
    hvac: "Normal",
    ems: "Warning",
    deviceCount: 32,
    alerts: 2,
    focus: "Battery dispatch balancing",
    contact: "Rina Sato",
    updatedAt: "6m ago",
    workflows: ["發電預測與優化", "售電預測與管理", "雙向充電樁"],
    note: "Forecast confidence dipped after a midday weather-model revision.",
  },
  {
    id: "taoyuan-hub",
    code: "TPE-02",
    name: "Taipei Hub",
    country: "Taiwan",
    city: "Taipei",
    region: "Asia Pacific",
    coordinates: [121.5654, 25.033],
    status: "watch",
    priority: "Warning",
    hvac: "Warning",
    ems: "Normal",
    deviceCount: 58,
    alerts: 3,
    focus: "HVAC fault isolation",
    contact: "Chia-Hao Lin",
    updatedAt: "9m ago",
    workflows: ["用電預測與優化", "售電預測與管理", "能源資源商品化庫存管理"],
    note: "One meter stream is delayed; dispatch recommendations remain available.",
  },
  {
    id: "taoyuan-logistics",
    code: "TXG-06",
    name: "Taichung Logistics",
    country: "Taiwan",
    city: "Taichung",
    region: "Asia Pacific",
    coordinates: [120.6736, 24.1477],
    status: "critical",
    priority: "Critical",
    hvac: "Warning",
    ems: "Critical",
    deviceCount: 41,
    alerts: 4,
    focus: "Reserve capacity recovery",
    contact: "Yi-Ting Hsu",
    updatedAt: "3m ago",
    workflows: ["用電預測與優化", "雙向充電樁", "能源資源商品化庫存管理"],
    note: "Bidirectional charger bank is held below reserve threshold until inverter checks complete.",
  },
  {
    id: "taoyuan-west",
    code: "KHH-07",
    name: "Kaohsiung West",
    country: "Taiwan",
    city: "Kaohsiung",
    region: "Asia Pacific",
    coordinates: [120.3014, 22.6273],
    status: "healthy",
    priority: "Normal",
    hvac: "Normal",
    ems: "Normal",
    deviceCount: 27,
    alerts: 0,
    focus: "Load-shift readiness",
    contact: "Wei-Lun Chen",
    updatedAt: "12m ago",
    workflows: ["用電預測與優化", "售電預測與管理"],
    note: "Evening curtailment window is prepared if neighboring sites need balancing support.",
  },
  {
    id: "rotterdam-port",
    code: "AMS-01",
    name: "Rotterdam Port",
    country: "Netherlands",
    city: "Rotterdam",
    region: "Europe",
    coordinates: [4.4777, 51.9244],
    status: "healthy",
    priority: "Normal",
    hvac: "Normal",
    ems: "Normal",
    deviceCount: 37,
    alerts: 0,
    focus: "Commercial dispatch readiness",
    contact: "Mila de Vries",
    updatedAt: "2m ago",
    workflows: ["售電預測與管理", "移動式雙向充電樁", "能源資源商品化庫存管理"],
    note: "No action required before evening dispatch review.",
  },
  {
    id: "rotterdam-inland",
    code: "AMS-08",
    name: "Rotterdam Inland",
    country: "Netherlands",
    city: "Rotterdam",
    region: "Europe",
    coordinates: [4.4868, 51.9185],
    status: "watch",
    priority: "Warning",
    hvac: "Normal",
    ems: "Warning",
    deviceCount: 29,
    alerts: 1,
    focus: "Market nomination validation",
    contact: "Sven Bakker",
    updatedAt: "8m ago",
    workflows: ["售電預測與管理", "能源資源商品化庫存管理"],
    note: "One export nomination is pending a final meter reconciliation before release.",
  },
  {
    id: "arizona-array",
    code: "PHX-04",
    name: "Arizona Array",
    country: "United States",
    city: "Phoenix",
    region: "North America",
    coordinates: [-112.074, 33.4484],
    status: "critical",
    priority: "Critical",
    hvac: "Critical",
    ems: "Warning",
    deviceCount: 63,
    alerts: 5,
    focus: "Thermal response plan",
    contact: "Daniel Reed",
    updatedAt: "1m ago",
    workflows: ["發電預測與優化", "售電預測與管理", "移動式雙向充電樁"],
    note: "Temporary dispatch cap applied until cooling trend stabilizes.",
  },
  {
    id: "phoenix-yard",
    code: "PHX-09",
    name: "Phoenix Yard",
    country: "United States",
    city: "Phoenix",
    region: "North America",
    coordinates: [-112.0565, 33.4521],
    status: "watch",
    priority: "Warning",
    hvac: "Warning",
    ems: "Normal",
    deviceCount: 36,
    alerts: 2,
    focus: "Cooling rotation plan",
    contact: "Maya Brooks",
    updatedAt: "5m ago",
    workflows: ["發電預測與優化", "雙向充電樁"],
    note: "Cooling rotation was adjusted to preserve dispatch availability during the heat spike.",
  },
  {
    id: "phoenix-gateway",
    code: "PHX-10",
    name: "Phoenix Gateway",
    country: "United States",
    city: "Phoenix",
    region: "North America",
    coordinates: [-112.0883, 33.4371],
    status: "healthy",
    priority: "Normal",
    hvac: "Normal",
    ems: "Normal",
    deviceCount: 28,
    alerts: 0,
    focus: "Flexible charger staging",
    contact: "Omar Fields",
    updatedAt: "15m ago",
    workflows: ["雙向充電樁", "移動式雙向充電樁", "業模式管理預測"],
    note: "Mobile charger staging is ready if Arizona Array requires balancing support tonight.",
  },
  {
    id: "sydney-yard",
    code: "SYD-03",
    name: "Sydney Yard",
    country: "Australia",
    city: "Sydney",
    region: "Asia Pacific",
    coordinates: [151.2093, -33.8688],
    status: "healthy",
    priority: "Normal",
    hvac: "Normal",
    ems: "Normal",
    deviceCount: 24,
    alerts: 0,
    focus: "Fleet charging coordination",
    contact: "Eva Morgan",
    updatedAt: "11m ago",
    workflows: ["雙向充電樁", "移動式雙向充電樁", "業模式管理預測"],
    note: "Evening route assignments ready for approval.",
  },
];

const portfolioAreas = [
  { id: "all", labelKey: "allSites", count: siteData.length },
  { id: "north-america", labelKey: "northAmerica", count: siteData.filter((site) => site.region === "North America").length },
  { id: "asia-pacific", labelKey: "asiaPacific", count: siteData.filter((site) => site.region === "Asia Pacific").length },
  { id: "europe", labelKey: "europe", count: siteData.filter((site) => site.region === "Europe").length },
];

const statusMeta = {
  healthy: { labelKey: "statusNormal", icon: CheckCircle2 },
  watch: { labelKey: "statusWarning", icon: AlertTriangle },
  critical: { labelKey: "statusCritical", icon: AlertTriangle },
};

const statusWeight = {
  healthy: 1,
  watch: 2,
  critical: 3,
};

const mapViews = {
  all: { center: [18, 2], zoom: 1 },
  "north-america": { center: [-112, 33], zoom: 3 },
  "asia-pacific": { center: [134, 2], zoom: 2 },
  europe: { center: [5, 52], zoom: 3.4 },
};

const countryMapConfig = {
  Taiwan: { center: [121.05, 23.78], scale: 7600 },
  Japan: { center: [138.2, 36.4], scale: 2100 },
  Netherlands: { center: [5.35, 52.2], scale: 23000 },
  "United States": { center: [-112.1, 33.45], scale: 4400 },
};

const systemModules = workflowGroups.map((workflow, index) => ({
  ...workflow,
  owner: ["Energy desk", "Facilities", "Market ops", "Fleet ops"][index % 4],
  cadence: ["15 min", "30 min", "Hourly", "Daily"][index % 4],
}));

const siteActivity = [
  { site: "Taipei Hub", event: "HVAC drift rule assigned to Chia-Hao Lin", time: "9m ago" },
  { site: "Arizona Array", event: "Temporary dispatch cap applied", time: "17m ago" },
  { site: "Rotterdam Port", event: "Sell-power forecast cleared for evening review", time: "22m ago" },
  { site: "Tokyo Campus", event: "Peak shaving window prepared", time: "31m ago" },
];

const siteTabs = [
  { id: "overview", labelKey: "overview" },
  { id: "ems", labelKey: "ems" },
  { id: "reports", labelKey: "reports" },
  { id: "dev", labelKey: "dev" },
];

const reportBlueprints = [
  {
    id: "daily-operations",
    cadence: "Daily",
    title: "Daily operations brief",
    category: "Operations",
    status: "Ready",
    summary:
      "Shift handoff summary covering active alarms, HVAC exceptions, EMS posture, and the next operator decision before the next dispatch window.",
    metrics: [
      { label: "HVAC uptime", value: "98.4%", trend: "+0.6%", tone: "healthy" },
      { label: "Dispatch confidence", value: "92%", trend: "Stable", tone: "healthy" },
      { label: "Open alarms", value: "0", trend: "No escalation", tone: "healthy" },
    ],
    trends: [
      { label: "Load forecast", value: "Within plan", detail: "Demand stayed inside the expected band through the last 6 hours." },
      { label: "Storage reserve", value: "Ready", detail: "Reserve margin remains above the release threshold for evening support." },
    ],
    modules: ["用電預測與優化", "售電預測與管理"],
  },
  {
    id: "weekly-ems",
    cadence: "Weekly",
    title: "EMS optimization review",
    category: "EMS",
    status: "Review",
    summary:
      "Weekly readout of forecasting quality, charging posture, inventory exposure, and any workflow that needs manager approval before the next planning cycle.",
    metrics: [
      { label: "Forecast accuracy", value: "94.1%", trend: "+1.3%", tone: "healthy" },
      { label: "Curtailment capture", value: "87%", trend: "On target", tone: "watch" },
      { label: "Inventory risk", value: "Low", trend: "Contained", tone: "healthy" },
    ],
    trends: [
      { label: "Generation optimization", value: "Improving", detail: "Solar and battery scheduling improved after last model retune." },
      { label: "Sell-power readiness", value: "1 open check", detail: "One market nomination still needs reconciliation before release." },
    ],
    modules: ["發電預測與優化", "售電預測與管理", "能源資源商品化庫存管理"],
  },
  {
    id: "settlement-pack",
    cadence: "Settlement",
    title: "Commercial settlement pack",
    category: "Reports",
    status: "Draft",
    summary:
      "Site-specific commercial package for revenue posture, charger utilization, export commitments, and document artifacts used in settlement or partner review.",
    metrics: [
      { label: "Revenue capture", value: "NT$ 1.28M", trend: "+4.2%", tone: "healthy" },
      { label: "Bidirectional utilization", value: "68%", trend: "Rising", tone: "watch" },
      { label: "Document readiness", value: "3 of 4", trend: "One pending", tone: "critical" },
    ],
    trends: [
      { label: "Commercial inventory", value: "Balanced", detail: "Available energy-product inventory remains within the weekly plan." },
      { label: "Partner paperwork", value: "Pending sign-off", detail: "One approval item remains before the settlement packet can be issued." },
    ],
    modules: ["雙向充電樁", "移動式雙向充電樁", "能源資源商品化庫存管理"],
  },
];

function buildSiteReports(site) {
  return reportBlueprints.map((report, index) => ({
    ...report,
    id: `${site.id}-${report.id}`,
    updated: index === 0 ? site.updatedAt : index === 1 ? "Today 09:10" : "Yesterday 18:40",
    status: site.status === "critical" && index === 0 ? "Attention" : report.status,
    metrics: report.metrics.map((metric) => {
      if (metric.label === "Open alarms") {
        return {
          ...metric,
          value: String(site.alerts),
          trend: site.alerts === 0 ? "No escalation" : `${site.alerts} need review`,
          tone: site.alerts === 0 ? "healthy" : site.status === "critical" ? "critical" : "watch",
        };
      }

      if (metric.label === "Dispatch confidence") {
        return {
          ...metric,
          value: site.status === "critical" ? "76%" : site.status === "watch" ? "84%" : "92%",
          trend: site.status === "critical" ? "Reduced" : site.status === "watch" ? "Watching drift" : "Stable",
          tone: site.status === "critical" ? "critical" : site.status === "watch" ? "watch" : "healthy",
        };
      }

      if (metric.label === "Document readiness") {
        return {
          ...metric,
          value: site.status === "critical" ? "2 of 4" : site.status === "watch" ? "3 of 4" : "4 of 4",
          trend: site.status === "critical" ? "Needs follow-up" : site.status === "watch" ? "One pending" : "Complete",
          tone: site.status === "critical" ? "critical" : site.status === "watch" ? "watch" : "healthy",
        };
      }

      return metric;
    }),
  }));
}

let switchTimer = 0;
let noticeTimer = 0;

function getRegionKey(region) {
  return region.toLowerCase().replaceAll(" ", "-");
}

function shouldGroupByCountry(site) {
  return site.country === "Taiwan";
}

function getLocationGroupId(site) {
  if (shouldGroupByCountry(site)) {
    return `${getRegionKey(site.region)}:${site.country}`.toLowerCase().replaceAll(" ", "-");
  }

  return `${getRegionKey(site.region)}:${site.country}:${site.city}`.toLowerCase().replaceAll(" ", "-");
}

function getGroupDisplayName(group) {
  return group.city === group.country ? group.country : `${group.city}, ${group.country}`;
}

function getWorstStatus(sites) {
  return sites.reduce((worstStatus, site) => {
    if (!worstStatus || statusWeight[site.status] > statusWeight[worstStatus]) {
      return site.status;
    }
    return worstStatus;
  }, null);
}

function getAverageCoordinates(sites) {
  if (sites.length === 0) {
    return [18, 2];
  }

  const totals = sites.reduce(
    (summary, site) => {
      summary.longitude += site.coordinates[0];
      summary.latitude += site.coordinates[1];
      return summary;
    },
    { longitude: 0, latitude: 0 },
  );

  return [totals.longitude / sites.length, totals.latitude / sites.length];
}

function getCountryZoom(sites) {
  if (sites.length <= 1) {
    return 6.2;
  }

  const longitudes = sites.map((site) => site.coordinates[0]);
  const latitudes = sites.map((site) => site.coordinates[1]);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const spread = Math.max(longitudeSpan, latitudeSpan);

  if (spread < 0.08) {
    return 8;
  }

  if (spread < 0.2) {
    return 7.2;
  }

  if (spread < 0.6) {
    return 6.4;
  }

  if (spread < 1.4) {
    return 5.8;
  }

  return 5.2;
}

function pushRoute(fragment) {
  if (window.location.hash !== `#${fragment}`) {
    window.history.pushState(null, "", `#${fragment}`);
  }
}

function readStoredPreference(key, queryKey, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const queryValue = new URLSearchParams(window.location.search).get(queryKey);
  if (queryValue) {
    return queryValue;
  }

  return window.localStorage.getItem(key) ?? fallback;
}

function App() {
  const [activeScreen, setActiveScreen] = useState("overview");
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [activeMarkerId, setActiveMarkerId] = useState(null);
  const [regionFilter, setRegionFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);
  const [isMapPreviewOpen, setIsMapPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState("site");
  const [drillCountry, setDrillCountry] = useState(null);
  const [countryAtlasData, setCountryAtlasData] = useState(null);
  const [previewAnchor, setPreviewAnchor] = useState(null);
  const [mapZoomOffset, setMapZoomOffset] = useState(0);
  const [siteTab, setSiteTab] = useState("overview");
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [notice, setNotice] = useState("");
  const [locale, setLocale] = useState(() => readStoredPreference("verde-locale", "locale", i18nConfig.defaultLocale));
  const [theme, setTheme] = useState(() => readStoredPreference("verde-theme", "theme", "light"));
  const searchInputRef = useRef(null);
  const mapStageRef = useRef(null);
  const deferredSearch = useDeferredValue(searchValue);
  const t = useMemo(() => createTranslator(locale), [locale]);

  const selectedSite = siteData.find((site) => site.id === selectedSiteId) ?? siteData[0];
  const hasExplicitSiteSelection = Boolean(selectedSiteId);
  const siteReports = useMemo(() => buildSiteReports(selectedSite), [selectedSite]);
  const activeReport = siteReports.find((report) => report.id === selectedReportId) ?? siteReports[0];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("verde-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("verde-locale", locale);
  }, [locale]);

  useEffect(() => {
    function syncRoute() {
      const route = window.location.hash.replace("#", "");
      if (route.startsWith("site/")) {
        const siteId = route.split("/")[1];
        if (siteData.some((site) => site.id === siteId)) {
          setSelectedSiteId(siteId);
          setActiveScreen("site-detail");
        }
        return;
      }

      if (route === "overview") {
        setActiveScreen(route);
      }
    }

    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    setSelectedReportId((current) => {
      if (current && siteReports.some((report) => report.id === current)) {
        return current;
      }
      return siteReports[0]?.id ?? null;
    });
  }, [siteReports]);

  const filteredSites = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return siteData.filter((site) => {
      const regionKey = getRegionKey(site.region);
      const matchesRegion = regionFilter === "all" || regionFilter === regionKey;
      const matchesQuery =
        query.length === 0 ||
        [site.name, site.country, site.city, site.focus, site.region]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesRegion && matchesQuery;
    });
  }, [deferredSearch, regionFilter]);

  const baseMapView = useMemo(() => {
    const view = mapViews[regionFilter] ?? mapViews.all;
    return {
      ...view,
      zoom: Math.min(4.1, Math.max(1, view.zoom + mapZoomOffset)),
    };
  }, [mapZoomOffset, regionFilter]);

  const markerGroups = useMemo(() => {
    const groupedSites = new Map();

    filteredSites.forEach((site) => {
      const groupId = getLocationGroupId(site);
      const currentGroup = groupedSites.get(groupId) ?? {
        id: groupId,
        city: shouldGroupByCountry(site) ? site.country : site.city,
        country: site.country,
        region: site.region,
        coordinates: [0, 0],
        totalAlerts: 0,
        sites: [],
      };

      currentGroup.sites.push(site);
      currentGroup.totalAlerts += site.alerts;
      currentGroup.coordinates[0] += site.coordinates[0];
      currentGroup.coordinates[1] += site.coordinates[1];
      groupedSites.set(groupId, currentGroup);
    });

    return Array.from(groupedSites.values()).map((group) => {
      const worstStatus = getWorstStatus(group.sites);
      const orderedSites = [...group.sites].sort((leftSite, rightSite) => {
        const statusDelta = statusWeight[rightSite.status] - statusWeight[leftSite.status];
        if (statusDelta !== 0) {
          return statusDelta;
        }
        return rightSite.alerts - leftSite.alerts;
      });
      const statusCounts = orderedSites.reduce(
        (summary, site) => {
          summary[site.status] += 1;
          return summary;
        },
        { healthy: 0, watch: 0, critical: 0 },
      );

      return {
        ...group,
        sites: orderedSites,
        count: orderedSites.length,
        status: worstStatus,
        leadSite: orderedSites[0],
        statusCounts,
        coordinates: [
          group.coordinates[0] / group.sites.length,
          group.coordinates[1] / group.sites.length,
        ],
      };
    });
  }, [filteredSites]);

  const markerGroupBySiteId = useMemo(() => {
    return markerGroups.reduce((siteGroups, group) => {
      group.sites.forEach((site) => {
        siteGroups[site.id] = group;
      });
      return siteGroups;
    }, {});
  }, [markerGroups]);

  const countrySites = useMemo(() => {
    if (!drillCountry) {
      return [];
    }

    return filteredSites
      .filter((site) => site.country === drillCountry)
      .sort((leftSite, rightSite) => {
        const statusDelta = statusWeight[rightSite.status] - statusWeight[leftSite.status];
        if (statusDelta !== 0) {
          return statusDelta;
        }
        return rightSite.alerts - leftSite.alerts;
      });
  }, [drillCountry, filteredSites]);

  const isCountryDrill = activeScreen === "overview" && Boolean(drillCountry) && countrySites.length > 1;
  const isCountrySummaryPreview = isCountryDrill && isMapPreviewOpen && previewMode === "country";
  const activeMarkerGroup = markerGroups.find((group) => group.id === activeMarkerId) ?? null;
  const previewSite = activeMarkerGroup?.sites.find((site) => site.id === selectedSiteId) ?? selectedSite;
  const countrySummary = useMemo(() => {
    if (countrySites.length === 0) {
      return null;
    }

    return countrySites.reduce(
      (summary, site) => {
        summary.totalAlerts += site.alerts;
        summary[site.status] += 1;
        return summary;
      },
      { totalAlerts: 0, healthy: 0, watch: 0, critical: 0 },
    );
  }, [countrySites]);

  const shouldZoomToCountry = activeScreen === "overview" && countrySites.length > 1 && Boolean(drillCountry);
  const activeRegionLabel =
    regionFilter === "all"
      ? t("allSites")
      : t(portfolioAreas.find((area) => area.id === regionFilter)?.labelKey ?? "allSites");
  const mapContextTitle = isCountryDrill ? drillCountry : activeRegionLabel;
  const mapContextSummary = isCountryDrill
    ? `${countrySites.length} ${t("sites")} · ${countrySummary.totalAlerts} ${t("openAlarms")}`
    : `${filteredSites.length} ${filteredSites.length === 1 ? t("portfolioSite") : t("portfolioSites")}`;
  const mapContextHint = isCountryDrill ? t("countryContextHint") : t("clickMarker");

  const mapView = useMemo(() => {
    if (!shouldZoomToCountry) {
      return baseMapView;
    }

    return {
      center: getAverageCoordinates(countrySites),
      zoom: Math.min(8.4, Math.max(baseMapView.zoom, getCountryZoom(countrySites) + mapZoomOffset)),
    };
  }, [baseMapView, countrySites, mapZoomOffset, shouldZoomToCountry]);

  const activeCountryMapConfig = useMemo(() => {
    if (!isCountryDrill) {
      return null;
    }

    const fallbackCenter = getAverageCoordinates(countrySites);
    const baseConfig = countryMapConfig[drillCountry] ?? {
      center: fallbackCenter,
      scale: 5200,
    };

    return {
      center: baseConfig.center,
      scale: baseConfig.scale * (1 + mapZoomOffset * 0.22),
    };
  }, [countrySites, drillCountry, isCountryDrill, mapZoomOffset]);

  useEffect(() => {
    if (!drillCountry) {
      return;
    }

    if (countrySites.length === 0) {
      setDrillCountry(null);
      setPreviewMode("site");
      setIsMapPreviewOpen(false);
      setActiveMarkerId(null);
    }
  }, [countrySites.length, drillCountry]);

  useEffect(() => {
    if (!isCountryDrill || countryAtlasData) {
      return undefined;
    }

    let ignore = false;

    import("world-atlas/countries-50m.json").then((module) => {
      if (!ignore) {
        setCountryAtlasData(module.default);
      }
    });

    return () => {
      ignore = true;
    };
  }, [countryAtlasData, isCountryDrill]);

  useLayoutEffect(() => {
    if (!isMapPreviewOpen || !activeMarkerId || previewMode === "country" || isCountryDrill) {
      setPreviewAnchor(null);
      return undefined;
    }

    let frame = 0;

    function syncPreviewAnchor() {
      const stage = mapStageRef.current;
      const marker = stage?.querySelector(`[data-marker-id="${activeMarkerId}"]`);
      const drawer = stage?.querySelector(".site-drawer");

      if (!stage || !marker || !drawer) {
        setPreviewAnchor(null);
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();
      const drawerWidth = drawer.getBoundingClientRect().width || 328;
      const drawerHeight = drawer.getBoundingClientRect().height || 330;
      const desiredLeft = markerRect.right - stageRect.left + 18;
      const desiredTop = markerRect.bottom - stageRect.top + 14;
      const minimumTop = 92;
      const nextAnchor = {
        x: Math.round(Math.max(20, Math.min(desiredLeft, stageRect.width - drawerWidth - 20))),
        y: Math.round(Math.max(minimumTop, Math.min(desiredTop, stageRect.height - drawerHeight - 20))),
      };

      setPreviewAnchor((currentAnchor) => {
        if (currentAnchor?.x === nextAnchor.x && currentAnchor?.y === nextAnchor.y) {
          return currentAnchor;
        }
        return nextAnchor;
      });
    }

    frame = window.requestAnimationFrame(syncPreviewAnchor);
    window.addEventListener("resize", syncPreviewAnchor);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncPreviewAnchor);
    };
  }, [activeMarkerId, isCountryDrill, isMapPreviewOpen, mapView.zoom, markerGroups.length, previewMode, regionFilter]);

  const hasActiveFilters = regionFilter !== "all" || searchValue.trim().length > 0;

  const screenMeta = {
    overview: {
      title: t("overviewTitle"),
      description: t("overviewDescription"),
    },
    "site-detail": {
      title: selectedSite.name,
      description: t("siteWorkspaceDescription", { city: selectedSite.city, country: selectedSite.country }),
    },
  }[activeScreen];

  const portfolioSummary = useMemo(() => {
    return siteData.reduce(
      (summary, site) => {
        summary.total += 1;
        summary[site.status] += 1;
        summary.alerts += site.alerts;
        return summary;
      },
      { total: 0, healthy: 0, watch: 0, critical: 0, alerts: 0 },
    );
  }, []);

  const visibleSummary = useMemo(() => {
    return filteredSites.reduce(
      (summary, site) => {
        summary.total += 1;
        summary[site.status] += 1;
        summary.alerts += site.alerts;
        return summary;
      },
      { total: 0, healthy: 0, watch: 0, critical: 0, alerts: 0 },
    );
  }, [filteredSites]);

  function handleSelectSite(siteId) {
    setIsSwitching(true);
    startTransition(() => {
      setSelectedSiteId(siteId);
    });
    window.clearTimeout(switchTimer);
    switchTimer = window.setTimeout(() => {
      setIsSwitching(false);
    }, 180);
  }

  function handleOpenSite(siteId = selectedSite.id) {
    handleSelectSite(siteId);
    setIsMapPreviewOpen(false);
    setPreviewMode("site");
    setDrillCountry(null);
    setSiteTab("overview");
    setActiveScreen("site-detail");
    pushRoute(`site/${siteId}`);
  }

  function handleNavigate(screenId) {
    setIsMapPreviewOpen(false);
    setActiveMarkerId(null);
    setPreviewMode("site");
    setDrillCountry(null);
    setActiveScreen(screenId);
    pushRoute(screenId);
  }

  function handlePreviewSite(siteId, markerId = markerGroupBySiteId[siteId]?.id ?? null) {
    if (markerId) {
      setActiveMarkerId(markerId);
    }
    handleSelectSite(siteId);
    setPreviewMode("site");
    setIsMapPreviewOpen(true);
  }

  function handlePreviewMarker(group) {
    if (group.count > 1) {
      setActiveMarkerId(group.id);
      handleSelectSite(group.leadSite.id);
      setDrillCountry(group.country);
      setPreviewMode("country");
      setIsMapPreviewOpen(true);
      return;
    }

    setDrillCountry(null);
    setActiveMarkerId(group.id);
    handleSelectSite(group.leadSite.id);
    setPreviewMode("site");
    setIsMapPreviewOpen(true);
  }

  function handleRegionFilter(filterId) {
    setRegionFilter(filterId);
    setIsMapPreviewOpen(false);
    setActiveMarkerId(null);
    setPreviewMode("site");
    setDrillCountry(null);
    setSelectedSiteId(null);
    setMapZoomOffset(0);
    setActiveScreen("overview");
    pushRoute("overview");
  }

  function handleMapMarkerKeyDown(event, group) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePreviewMarker(group);
    }
  }

  function handleOpenIssue(issueSiteName) {
    const site = siteData.find((candidate) => candidate.name === issueSiteName);
    if (site) {
      setRegionFilter(getRegionKey(site.region));
      setMapZoomOffset(0);
      handlePreviewSite(site.id, getLocationGroupId(site));
    }
  }

  function handleTableRowKeyDown(event, siteId) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenSite(siteId);
    }
  }

  function clearFilters() {
    setRegionFilter("all");
    setSearchValue("");
    setMapZoomOffset(0);
    setActiveMarkerId(null);
    setPreviewMode("site");
    setDrillCountry(null);
    setIsMapPreviewOpen(false);
    setNotice(t("clearFilters"));
  }

  function closePreview() {
    setIsMapPreviewOpen(false);
    setActiveMarkerId(null);
    setPreviewMode("site");
    setDrillCountry(null);
  }

  function resetToFullMap() {
    setDrillCountry(null);
    setIsMapPreviewOpen(false);
    setActiveMarkerId(null);
    setPreviewMode("site");
    setRegionFilter("all");
    setMapZoomOffset(0);
    setActiveScreen("overview");
    pushRoute("overview");
  }

  function returnToCountryMap() {
    setPreviewMode("country");
    setIsMapPreviewOpen(true);
  }

  function focusSearch() {
    searchInputRef.current?.focus();
  }

  function announce(message) {
    setNotice(message);
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => setNotice(""), 2200);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="Verde EMS">
          <span className="brand-shield">V</span>
          <strong>{t("appName")}</strong>
        </div>
        <div className="top-actions">
          <label className="locale-dropdown">
            <Globe size={15} aria-hidden="true" />
            <select value={locale} onChange={(event) => setLocale(event.target.value)} aria-label={t("languageLabel")}>
              {i18nConfig.locales.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            type="button"
            aria-label={theme === "dark" ? t("switchToLight") : t("switchToDark")}
            onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={t("notifications")}
            onClick={() => announce(t("noNotifications"))}
          >
            <Bell size={16} />
          </button>
          <button
            className="profile-button"
            type="button"
            aria-label={t("accountMenu")}
            onClick={() => announce(t("accountUnavailable"))}
          >
            <UserCircle size={18} />
            <span>OC</span>
          </button>
        </div>
      </header>

      <main className="workspace" id="main-content">
        <div className="workspace-toolbar">
          <div>
            {activeScreen === "site-detail" ? (
              <button type="button" className="back-button" onClick={() => handleNavigate("overview")}>
                <ArrowRight size={14} />
                {t("backToPortfolio")}
              </button>
            ) : null}
            {activeScreen === "overview" ? (
              <div className="overview-kicker">
                <h1 className="sr-only">{screenMeta.title}</h1>
                <span>{screenMeta.title}</span>
                <strong>{filteredSites.length} {filteredSites.length === 1 ? t("portfolioSite") : t("portfolioSites")}</strong>
              </div>
            ) : (
              <>
                <h1>{screenMeta.title}</h1>
                <p>{screenMeta.description}</p>
              </>
            )}
          </div>
          <div className="toolbar-actions">
            {activeScreen === "site-detail" ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => announce(t("exportQueued"))}
              >
                <Plus size={15} />
                <span className="wide-label">{t("exportSiteReport")}</span>
                <span className="narrow-label">{t("exportShort")}</span>
              </button>
            ) : null}
          </div>
        </div>
        <div className="app-notice" aria-live="polite" aria-atomic="true">
          {notice}
        </div>

        {activeScreen === "overview" ? (
          <>
        <section className="overview-layout is-map-fullscreen" aria-label={t("landingAria")}>
        <section
          ref={mapStageRef}
          className={`map-stage is-fullscreen ${isMapPreviewOpen ? "has-preview" : ""}`}
          aria-label={t("mapStageAria")}
        >
          <div className="map-scope-card" aria-label={t("areaSelectorHint")}>
            <header>
              <span>{t("areaLabel")}</span>
              <strong>{filteredSites.length} {t("sites")}</strong>
            </header>
            <div className="area-list map-area-list">
              {portfolioAreas.map((area) => {
                const isActive = regionFilter === area.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    className={isActive ? "is-active" : ""}
                    aria-pressed={isActive}
                    onClick={() => handleRegionFilter(area.id)}
                  >
                    <span>{t(area.labelKey)}</span>
                    <strong>{area.count}</strong>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="map-controls" aria-label="Map controls">
            <button
              type="button"
              aria-label={t("zoomIn")}
              onClick={() => setMapZoomOffset((zoom) => Math.min(1.4, zoom + 0.35))}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              aria-label={t("zoomOut")}
              onClick={() => setMapZoomOffset((zoom) => Math.max(0, zoom - 0.35))}
            >
              <Minus size={15} />
            </button>
          </div>
          <div className="map-legend-card" aria-label={t("selectedAreaSummary")}>
            <span><i className="status-dot healthy" />{visibleSummary.healthy} {t("normal")}</span>
            <span><i className="status-dot watch" />{visibleSummary.watch} {t("warning")}</span>
            <span><i className="status-dot critical" />{visibleSummary.critical} {t("critical")}</span>
          </div>
          <div className="map-context" aria-live="polite">
            <strong>{mapContextTitle}</strong>
            <span>{mapContextSummary}</span>
            <small>{mapContextHint}</small>
          </div>
          {filteredSites.length === 0 ? (
            <div className="map-empty-state">
              <strong>{t("noSites")}</strong>
              <span>{t("clearFiltersHint")}</span>
              <button type="button" onClick={clearFilters}>{t("clearFilters")}</button>
            </div>
          ) : null}

          {isCountryDrill ? (
            <ComposableMap
              className="world-map country-drill-map"
              projection="geoMercator"
              projectionConfig={{
                center: activeCountryMapConfig.center,
                scale: activeCountryMapConfig.scale,
              }}
              aria-label={t("mapAria")}
            >
              {countryAtlasData ? (
              <Geographies
                geography={countryAtlasData}
                parseGeographies={(geographies) => geographies.filter((geography) => geography.properties.name === drillCountry)}
              >
                {({ geographies }) =>
                  geographies.map((geography) => (
                    <Geography
                      key={geography.rsmKey}
                      geography={geography}
                      className="map-geography country-geography"
                    />
                  ))
                }
              </Geographies>
              ) : null}

              {countryAtlasData ? countrySites.map((site) => (
                <Marker key={site.id} coordinates={site.coordinates}>
                  <g
                    data-marker-id={site.id}
                    className={`map-marker-svg is-country-site ${site.status} ${site.status !== "healthy" ? "is-priority" : ""} ${isMapPreviewOpen && activeMarkerId === site.id ? "is-active" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={t("inspectSiteAria", {
                      site: site.name,
                      status: t(statusMeta[site.status].labelKey),
                      alerts: site.alerts,
                    })}
                    onClick={() => handlePreviewSite(site.id, site.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handlePreviewSite(site.id, site.id);
                      }
                    }}
                  >
                    <title>{`${site.name}: ${t(statusMeta[site.status].labelKey)}`}</title>
                    <circle className="marker-hit-area" r="16" />
                    <circle className="marker-halo" r="9.5" />
                    <circle className="marker-core" r="5.2" />
                  </g>
                </Marker>
              )) : null}
            </ComposableMap>
          ) : (
            <ComposableMap
              className="world-map"
              projection="geoNaturalEarth1"
              projectionConfig={{ scale: 172 }}
              aria-label={t("mapAria")}
            >
              <ZoomableGroup key={`${regionFilter}-${mapView.center.join(",")}`} center={mapView.center} zoom={mapView.zoom}>
                <Geographies geography={worldAtlas}>
                  {({ geographies }) =>
                    geographies.map((geography) => (
                      <Geography
                        key={geography.rsmKey}
                        geography={geography}
                        className="map-geography"
                      />
                    ))
                  }
                </Geographies>

                {markerGroups.map((group) => (
                  <Marker key={group.id} coordinates={group.coordinates}>
                    <g
                      data-marker-id={group.id}
                      className={`map-marker-svg ${group.status} ${group.status !== "healthy" ? "is-priority" : ""} ${group.count > 1 ? "is-group" : ""} ${isMapPreviewOpen && activeMarkerId === group.id ? "is-active" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={t("inspectSiteAria", {
                          site: group.count > 1 ? getGroupDisplayName(group) : group.leadSite.name,
                        status: t(statusMeta[group.status].labelKey),
                        alerts: group.totalAlerts,
                      })}
                      onClick={() => handlePreviewMarker(group)}
                      onKeyDown={(event) => handleMapMarkerKeyDown(event, group)}
                    >
                      <title>{`${group.count > 1 ? getGroupDisplayName(group) : group.leadSite.name}: ${t(statusMeta[group.status].labelKey)}`}</title>
                      <circle className="marker-hit-area" r={group.count > 1 ? "18" : "16"} />
                      {group.count > 1 ? <circle className="marker-group-halo" r="14.5" /> : null}
                      <circle className="marker-halo" r={group.count > 1 ? "11.8" : "11"} />
                      <circle className="marker-core" r="5.8" />
                      {group.count > 1 ? (
                        <g className="marker-count" transform="translate(9 -15)" aria-hidden="true">
                          <rect width="20" height="18" rx="9" />
                          <text x="10" y="12">{group.count}</text>
                        </g>
                      ) : null}
                      {group.count === 1 ? (
                        <g className="marker-label" transform="translate(13 -24)" aria-hidden="true">
                          <rect width="148" height="34" rx="7" />
                          <text x="9" y="14">{group.leadSite.name}</text>
                          <text x="9" y="27">{`${t(statusMeta[group.status].labelKey)} · ${group.totalAlerts} ${t("openAlarms")}`}</text>
                        </g>
                      ) : null}
                    </g>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>
          )}

          {isMapPreviewOpen ? (
          <article
            className={`site-drawer ${previewAnchor ? "is-anchored" : ""} ${isSwitching ? "is-syncing" : ""} ${isCountryDrill ? "is-country-drill" : ""}`}
            style={previewAnchor ? { "--preview-x": `${previewAnchor.x}px`, "--preview-y": `${previewAnchor.y}px` } : undefined}
            aria-live="polite"
          >
            {isCountrySummaryPreview ? (
              <>
                <header>
                  <div>
                    <span className="site-code">{countrySites.length} {t("sites")}</span>
                    <span className={`status-label ${getWorstStatus(countrySites)}`}>
                      {t(statusMeta[getWorstStatus(countrySites)].labelKey)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="drawer-return-button"
                    aria-label={t("returnToFullMap")}
                    onClick={resetToFullMap}
                  >
                    <ArrowRight size={14} />
                    <span>{t("returnLabel")}</span>
                  </button>
                </header>
                <h2>{drillCountry}</h2>
                <p>{t("countryDrillBody", { count: countrySites.length })}</p>
                <dl className="drawer-status">
                  <div>
                    <dt>{t("sites")}</dt>
                    <dd>{countrySites.length}</dd>
                  </div>
                  <div>
                    <dt>{t("openAlarms")}</dt>
                    <dd>{countrySummary.totalAlerts}</dd>
                  </div>
                  <div>
                    <dt>{t("critical")}</dt>
                    <dd>{countrySummary.critical}</dd>
                  </div>
                  <div>
                    <dt>{t("warning")}</dt>
                    <dd>{countrySummary.watch}</dd>
                  </div>
                  <div>
                    <dt>{t("normal")}</dt>
                    <dd>{countrySummary.healthy}</dd>
                  </div>
                </dl>
                <div className="drawer-note">
                  <MapPin size={14} />
                  <span>{t("countryPreviewHint")}</span>
                </div>
              </>
            ) : (
              <>
            <header>
              <div>
                <span className="site-code">{previewSite.code}</span>
                <span className={`status-label ${previewSite.status}`}>
                  {t(statusMeta[previewSite.status].labelKey)}
                </span>
              </div>
              {isCountryDrill ? (
                <button
                  type="button"
                  className="drawer-return-button"
                  aria-label={t("returnToCountryMap", { country: drillCountry })}
                  onClick={returnToCountryMap}
                >
                  <ArrowRight size={14} />
                  <span>{t("returnLabel")}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("closePreview")}
                  onClick={closePreview}
                >
                  <X size={15} />
                </button>
              )}
            </header>
            <h2>{previewSite.name}</h2>
            <p>{previewSite.city}, {previewSite.country}</p>
            <dl className="drawer-status">
              <div>
                <dt>{t("hvacSystems")}</dt>
                <dd>{previewSite.hvac}</dd>
              </div>
              <div>
                <dt>{t("emsStatus")}</dt>
                <dd>{previewSite.ems}</dd>
              </div>
              <div>
                <dt>{t("openAlarms")}</dt>
                <dd>{previewSite.alerts}</dd>
              </div>
              <div>
                <dt>{t("lastUpdate")}</dt>
                <dd>{previewSite.updatedAt}</dd>
              </div>
            </dl>
            <div className="drawer-note">
              <MapPin size={14} />
              <span>{previewSite.note}</span>
            </div>
            <button type="button" className="open-site-button" onClick={() => handleOpenSite(previewSite.id)}>
              {t("enterWorkspace")}
              <ArrowRight size={15} />
            </button>
              </>
            )}
          </article>
          ) : null}
        </section>

        </section>
          </>
        ) : null}

        {activeScreen === "sites" ? (
          <section className="screen-panel">
            <header className="section-intro">
              <div>
                <h2>Portfolio sites</h2>
                <p>Select a site to move from portfolio awareness into site-level action.</p>
              </div>
              <span className="screen-count">{filteredSites.length} shown</span>
            </header>
            <div className="site-list">
              {filteredSites.length > 0 ? filteredSites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  className="site-list-row"
                  onClick={() => handleOpenSite(site.id)}
                >
                  <span className={`status-dot ${site.status}`} />
                  <span>
                    <strong>{site.name}</strong>
                    <small>{site.city}, {site.country}</small>
                  </span>
                  <span>{site.focus}</span>
                  <span className={`status-label ${site.status}`}>{site.priority}</span>
                  <ArrowRight size={15} />
                </button>
              )) : (
                <div className="empty-state">
                  <strong>No sites match your filters</strong>
                  <p>Try a different region or search term.</p>
                  <button type="button" className="open-site-button" onClick={clearFilters}>
                    Clear filters
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {activeScreen === "issues" ? (
          <section className="screen-panel">
            <header className="section-intro">
              <div>
                <h2>Operational exceptions</h2>
                <p>Prioritized issues stay sparse so managers can decide where to act first.</p>
              </div>
              <span className="screen-count">{portfolioSummary.alerts} open alarms</span>
            </header>
            <div className="issue-worklist">
              {issues.map((issue) => {
                const StatusIcon = statusMeta[issue.status].icon;
                return (
                  <button
                    key={`${issue.site}-${issue.issue}-detail`}
                    type="button"
                    className="issue-card"
                    onClick={() => handleOpenIssue(issue.site)}
                  >
                    <StatusIcon className={issue.status} size={18} />
                    <span>
                      <strong>{issue.site}</strong>
                      <small>{issue.issue}</small>
                    </span>
                    <time>{issue.updated}</time>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeScreen === "systems" ? (
          <section className="screen-panel">
            <header className="section-intro">
              <div>
                <h2>EMS workflow modules</h2>
                <p>Each module can be opened from a site workspace when the site is connected.</p>
              </div>
              <span className="screen-count">{workflowGroups.length} modules</span>
            </header>
            <div className="module-table">
              {systemModules.map((module) => {
                const Icon = module.icon;
                const isConnected = selectedSite.workflows.includes(module.label);
                return (
                  <button
                    key={module.label}
                    type="button"
                    className={`module-row ${isConnected ? "is-connected" : ""}`}
                    onClick={() => {
                      setSiteTab("ems");
                      setActiveScreen("site-detail");
                      pushRoute(`site/${selectedSite.id}`);
                    }}
                  >
                    <Icon size={18} />
                    <span>
                      <strong>{module.label}</strong>
                      <small>{module.owner} · {module.cadence} review cadence</small>
                    </span>
                    <span>{isConnected ? `${selectedSite.name} connected` : "Portfolio available"}</span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeScreen === "reports" ? (
          <section className="screen-panel report-screen">
            <header className="section-intro">
              <div>
                <h2>Shift review package</h2>
                <p>A focused summary for managers, intentionally lighter than a telemetry dashboard.</p>
              </div>
              <span className="screen-count">Draft ready</span>
            </header>
            <div className="report-layout">
              <article>
                <h3>Portfolio readout</h3>
                <p>{portfolioSummary.healthy} normal sites, {portfolioSummary.watch} warning site, {portfolioSummary.critical} critical site. Arizona Array remains the only critical escalation.</p>
              </article>
              <article>
                <h3>Recommended focus</h3>
                <p>Review Taipei HVAC drift after the meter stream catches up, then clear Rotterdam dispatch readiness before evening sell-power commitments.</p>
              </article>
              <article>
                <h3>Next report action</h3>
                <button type="button" className="open-site-button">
                  Prepare manager summary
                  <ArrowRight size={15} />
                </button>
              </article>
            </div>
          </section>
        ) : null}

        {activeScreen === "site-detail" ? (
          <section className="site-workspace">
            <aside className="site-summary-card">
              <div className="site-summary-header">
                <span className={`status-label ${selectedSite.status}`}>
                  {t(statusMeta[selectedSite.status].labelKey)}
                </span>
                <span className="screen-count">{selectedSite.code}</span>
              </div>
              <h2>{selectedSite.name}</h2>
              <p>{selectedSite.city}, {selectedSite.country}</p>
              <dl className="drawer-status">
                <div>
                  <dt>{t("hvacSystems")}</dt>
                  <dd>{selectedSite.hvac}</dd>
                </div>
                <div>
                  <dt>{t("emsStatus")}</dt>
                  <dd>{selectedSite.ems}</dd>
                </div>
                <div>
                  <dt>{t("openAlarms")}</dt>
                  <dd>{selectedSite.alerts}</dd>
                </div>
                <div>
                  <dt>{t("lastUpdate")}</dt>
                  <dd>{selectedSite.updatedAt}</dd>
                </div>
              </dl>
              <div className="site-summary-note">
                <span>{t("decisionSummary")}</span>
                <strong>{selectedSite.focus}</strong>
                <p>{selectedSite.note}</p>
              </div>
              <div className="site-summary-stack">
                <div>
                  <span>{t("assignedOwner")}</span>
                  <strong>{selectedSite.contact}</strong>
                </div>
                <div>
                  <span>{t("onlineDevices")}</span>
                  <strong>{selectedSite.deviceCount}/64</strong>
                </div>
              </div>
            </aside>

            <article className="site-detail-panel">
              <div className="site-tabs" role="tablist" aria-label={`${selectedSite.name} sections`}>
                {siteTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    className={siteTab === tab.id ? "is-active" : ""}
                    aria-selected={siteTab === tab.id}
                    onClick={() => setSiteTab(tab.id)}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>

              {siteTab === "overview" ? (
                <div className="site-tab-panel">
                  <section className="detail-hero">
                    <div>
                      <span className="section-kicker">{t("primaryFocus")}</span>
                      <h2>{selectedSite.focus}</h2>
                      <p>{selectedSite.note}</p>
                    </div>
                    <button type="button" className="open-site-button">
                      {t("exportSiteReport")}
                      <ArrowRight size={15} />
                    </button>
                  </section>

                  <div className="summary-grid summary-grid-tight">
                    <div>
                      <span>{t("hvacSystems")}</span>
                      <strong>{selectedSite.hvac}</strong>
                      <small>Current operating posture</small>
                    </div>
                    <div>
                      <span>{t("emsStatus")}</span>
                      <strong>{selectedSite.ems}</strong>
                      <small>Workflow readiness</small>
                    </div>
                    <div>
                      <span>{t("openAlarms")}</span>
                      <strong>{selectedSite.alerts}</strong>
                      <small>Requires operator review</small>
                    </div>
                    <div>
                      <span>{t("onlineDevices")}</span>
                      <strong>{selectedSite.deviceCount}/64</strong>
                      <small>Connected HVAC endpoints</small>
                    </div>
                  </div>

                  <div className="detail-dual-grid">
                    <section className="detail-section">
                      <header className="detail-section-header">
                        <div>
                          <span className="section-kicker">{t("decisionSummary")}</span>
                          <h3>Operator brief</h3>
                        </div>
                      </header>
                      <div className="insight-list">
                        <article>
                          <span>Immediate action</span>
                          <strong>{selectedSite.focus}</strong>
                          <p>Use this site as the next operator checkpoint before the next EMS planning cycle.</p>
                        </article>
                        <article>
                          <span>Commercial posture</span>
                          <strong>{selectedSite.ems === "Normal" ? "Ready for review" : "Needs manager check"}</strong>
                          <p>Settlement and dispatch work should stay tied to the site report trail instead of portfolio-level navigation.</p>
                        </article>
                      </div>
                    </section>

                    <section className="detail-section">
                      <header className="detail-section-header">
                        <div>
                          <span className="section-kicker">Trend snapshot</span>
                          <h3>Today</h3>
                        </div>
                      </header>
                      <div className="trend-stack">
                        {activeReport.trends.map((item) => (
                          <article key={`${selectedSite.id}-${item.label}`}>
                            <div>
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </div>
                            <p>{item.detail}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}

              {siteTab === "ems" ? (
                <div className="site-tab-panel">
                  <section className="detail-section">
                    <header className="detail-section-header">
                      <div>
                        <span className="section-kicker">{t("ems")}</span>
                        <h2>{t("emsWorkflows")}</h2>
                      </div>
                      <p>Site-connected modules stay visible here so operations managers can confirm readiness before they open a report.</p>
                    </header>
                  </section>
                  <div className="workflow-grid compact detail-workflow-grid">
                    {workflowGroups.map((workflow) => {
                      const Icon = workflow.icon;
                      const isConnected = selectedSite.workflows.includes(workflow.label);
                      return (
                        <button key={`${selectedSite.id}-${workflow.label}`} type="button" className={isConnected ? "is-connected" : ""}>
                          <Icon size={18} />
                          <span>{workflow.label}</span>
                          <small>{isConnected ? t("enabledForSite") : t("availablePortfolio")}</small>
                          <strong>{isConnected ? selectedSite.updatedAt : "Portfolio shared"}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {siteTab === "reports" ? (
                <div className="site-tab-panel">
                  <section className="detail-section">
                    <header className="detail-section-header">
                      <div>
                        <span className="section-kicker">{t("reports")}</span>
                        <h2>{t("siteReports")}</h2>
                      </div>
                      <p>{t("siteReportsBody")}</p>
                    </header>
                  </section>

                  <div className="reports-workspace">
                    <div className="document-list detail-report-list" role="list">
                      {siteReports.map((report) => (
                        <button
                          key={report.id}
                          type="button"
                          className={activeReport?.id === report.id ? "is-active" : ""}
                          onClick={() => setSelectedReportId(report.id)}
                        >
                          <span>
                            <small>{report.cadence} · {report.category}</small>
                            <strong>{report.title}</strong>
                            <small>{t("updated")} {report.updated}</small>
                          </span>
                          <span className={`report-state ${report.status.toLowerCase().replaceAll(" ", "-")}`}>{report.status}</span>
                        </button>
                      ))}
                    </div>

                    <article className="report-detail-card">
                      <header className="report-detail-header">
                        <div>
                          <small>{activeReport.cadence} · {activeReport.category}</small>
                          <h3>{activeReport.title}</h3>
                        </div>
                        <span className={`report-state ${activeReport.status.toLowerCase().replaceAll(" ", "-")}`}>{activeReport.status}</span>
                      </header>
                      <p>{activeReport.summary}</p>

                      <div className="summary-grid summary-grid-tight">
                        {activeReport.metrics.map((metric) => (
                          <div key={`${activeReport.id}-${metric.label}`}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                            <small className={`metric-trend ${metric.tone}`}>{metric.trend}</small>
                          </div>
                        ))}
                      </div>

                      <section className="detail-section report-detail-section">
                        <header className="detail-section-header">
                          <div>
                            <span className="section-kicker">Trend notes</span>
                            <h3>What changed</h3>
                          </div>
                        </header>
                        <div className="trend-stack">
                          {activeReport.trends.map((item) => (
                            <article key={`${activeReport.id}-${item.label}`}>
                              <div>
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                              </div>
                              <p>{item.detail}</p>
                            </article>
                          ))}
                        </div>
                      </section>

                      <section className="detail-section report-detail-section">
                        <header className="detail-section-header">
                          <div>
                            <span className="section-kicker">Linked modules</span>
                            <h3>EMS context</h3>
                          </div>
                        </header>
                        <div className="module-tag-list">
                          {activeReport.modules.map((module) => (
                            <span key={`${activeReport.id}-${module}`}>{module}</span>
                          ))}
                        </div>
                      </section>
                    </article>
                  </div>
                </div>
              ) : null}

              {siteTab === "dev" ? (
                <div className="site-tab-panel">
                  <h2>{t("devDiagnostics")}</h2>
                  <p>{t("devBody")}</p>
                  <div className="activity-feed">
                    {siteActivity.map((item) => (
                      <div key={`${item.site}-${item.time}`}>
                        <span>{item.time}</span>
                        <strong>{item.site}</strong>
                        <p>{item.event}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
