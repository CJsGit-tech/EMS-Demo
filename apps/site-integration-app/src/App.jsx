import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Bell,
  Building2,
  CheckCircle2,
  Gauge,
  MapPin,
  Minus,
  Moon,
  Menu,
  Package,
  Plus,
  Search,
  Sparkles,
  Sun,
  ThermometerSun,
  Truck,
  UserCircle,
  X,
  Zap,
} from "lucide-react";
import {
  createContext,
  startTransition,
  useContext,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import worldAtlas from "./data/world-atlas.json";
import { createTranslator, i18nConfig } from "./i18nConfig";
import { buildSiteWorkspace } from "./siteWorkspaceContent";
import AgentCrewDrawer from "./agentcrew/AgentCrewDrawer";
import { loadEmsDashboardData } from "./ems/emsApi";
import { buildEmsViewModel } from "./ems/emsViewModel";

const MAP_VIEW_WIDTH = 800;
const MAP_VIEW_HEIGHT = 420;
const EMS_DATA_END = new Date("2026-07-23T00:00:00Z");
const EMS_RANGE_OPTIONS = [
  { id: "30d", days: 30, labelKey: "emsRange30d" },
  { id: "90d", days: 90, labelKey: "emsRange90d" },
  { id: "1y", days: 365, labelKey: "emsRange1y" },
];
const MERCATOR_MAX_LATITUDE = 85.0511287798066;
const PROJECTION_SCALE_GUARD = 172;
const GEOGRAPHY_CONTEXT = createContext({
  project: ([longitude, latitude]) => [
    (((Number(longitude) || 0) + 180) / 360) * MAP_VIEW_WIDTH,
    ((90 - (Number(latitude) || 0)) / 180) * MAP_VIEW_HEIGHT,
  ],
  width: MAP_VIEW_WIDTH,
  height: MAP_VIEW_HEIGHT,
});

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeBounds(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCountryMatch(atlasCountry, targetCountry) {
  if (!atlasCountry || !targetCountry) {
    return false;
  }

  const atlasName = normalizeBounds(atlasCountry);
  const targetName = normalizeBounds(targetCountry);

  if (atlasName === targetName) {
    return true;
  }

  if (atlasName.includes(targetName) || targetName.includes(atlasName)) {
    return true;
  }

  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseTopologyGeometries(topology) {
  if (!topology || topology.type !== "Topology") {
    return [];
  }

  const countryCollection = topology.objects?.countries ?? Object.values(topology.objects ?? {})[0];
  return countryCollection?.geometries ?? [];
}

function decodeTopologyArc(topology, arcIndex, cache) {
  const normalizedIndex = arcIndex < 0 ? -arcIndex - 1 : arcIndex;
  if (cache.has(normalizedIndex)) {
    const cachedArc = cache.get(normalizedIndex);
    return arcIndex < 0 ? [...cachedArc].reverse() : cachedArc;
  }

  const arc = topology.arcs?.[normalizedIndex] ?? [];
  const decoded = [];
  let cursorX = 0;
  let cursorY = 0;
  const [scaleX, scaleY] = topology.transform?.scale ?? [1, 1];
  const [translateX, translateY] = topology.transform?.translate ?? [0, 0];

  for (const [deltaX, deltaY] of arc) {
    cursorX += toNumber(deltaX);
    cursorY += toNumber(deltaY);
    decoded.push([cursorX * scaleX + translateX, cursorY * scaleY + translateY]);
  }

  cache.set(normalizedIndex, decoded);
  return arcIndex < 0 ? [...decoded].reverse() : decoded;
}

function buildArcPointPath(topology, arcRefs, project, arcCache) {
  if (!Array.isArray(arcRefs) || arcRefs.length === 0) {
    return "";
  }

  const points = [];
  for (const arcRef of arcRefs) {
    const currentArc = decodeTopologyArc(topology, arcRef, arcCache);
    if (currentArc.length === 0) {
      continue;
    }

    if (points.length === 0) {
      points.push(...currentArc);
      continue;
    }

    points.push(...currentArc.slice(1));
  }

  let path = "";
  let hasStart = false;
  for (let index = 0; index < points.length; index += 1) {
    const [rawLongitude, rawLatitude] = points[index];
    const projected = project([rawLongitude, rawLatitude]);
    if (!Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) {
      continue;
    }

    const command = hasStart ? "L" : "M";
    hasStart = true;
    path += `${command}${projected[0]} ${projected[1]}`;
  }

  if (path) {
    path += "Z";
  }

  return path;
}

function buildGeographyPath(topology, geometry, project) {
  if (!geometry || !Array.isArray(geometry.arcs) || !topology?.arcs) {
    return "";
  }

  const arcCache = new Map();
  const geometryArcs = geometry.arcs;
  const rings = geometry.type === "MultiPolygon" ? geometryArcs : [geometryArcs];
  let path = "";

  for (const arcRefs of rings) {
    if (!Array.isArray(arcRefs) || arcRefs.length === 0) {
      continue;
    }

    if (arcRefs.length > 0 && !Array.isArray(arcRefs[0])) {
      path += buildArcPointPath(topology, arcRefs, project, arcCache);
      continue;
    }

    for (const singleRing of arcRefs) {
      path += buildArcPointPath(topology, singleRing, project, arcCache);
    }
  }

  return path;
}

function createProjection(type, projectionConfig = {}) {
  const configScale = toNumber(projectionConfig.scale, 1);
  const width = MAP_VIEW_WIDTH;
  const height = MAP_VIEW_HEIGHT;
  const configCenter = projectionConfig.center ?? [0, 0];

  if (type === "geoMercator") {
    const centerLongitude = toNumber(configCenter[0], 0) * Math.PI / 180;
    const centerLatitude = toNumber(configCenter[1], 0);
    const clampedCenterLat = clamp(centerLatitude, -MERCATOR_MAX_LATITUDE, MERCATOR_MAX_LATITUDE);
    const centerY = Math.log(Math.tan(Math.PI / 4 + (clampedCenterLat * Math.PI) / 360));
    const mercatorScale = Math.max(40, configScale);

    return ([longitude, latitude]) => {
      const lon = toNumber(longitude, 0) * Math.PI / 180;
      const lat = clamp(toNumber(latitude, 0), -MERCATOR_MAX_LATITUDE, MERCATOR_MAX_LATITUDE);
      const latRad = (lat * Math.PI) / 180;
      const x = (width / 2) + mercatorScale * (lon - centerLongitude);
      const y = (height / 2) - mercatorScale * (Math.log(Math.tan(Math.PI / 4 + latRad / 2)) - centerY);
      return [x, y];
    };
  }

  const projectionScale = Math.max(0.05, configScale / PROJECTION_SCALE_GUARD);
  return ([longitude, latitude]) => {
    const baseX = ((toNumber(longitude, 0) + 180) / 360) * width;
    const baseY = ((90 - toNumber(latitude, 0)) / 180) * height;
    const centeredX = (baseX - width / 2) * projectionScale + width / 2;
    const centeredY = (baseY - height / 2) * projectionScale + height / 2;
    return [centeredX, centeredY];
  };
}

function buildMapGeographies(topology, project) {
  const geometries = parseTopologyGeometries(topology);

  return geometries.map((geometry, geometryIndex) => ({
    ...geometry,
    id: geometry.id ?? `${geometryIndex}`,
    rsmKey: `${geometry.id ?? geometryIndex}`,
    d: buildGeographyPath(topology, geometry, project),
    type: geometry.type,
  }));
}

const ComposableMap = ({ children, className = "", projection = "geoNaturalEarth1", projectionConfig = {} }) => {
  const project = useMemo(() => createProjection(projection, projectionConfig), [projection, toNumber(projectionConfig.scale, 1), projectionConfig.center?.[0], projectionConfig.center?.[1]]);
  const context = useMemo(() => ({
    project,
    width: MAP_VIEW_WIDTH,
    height: MAP_VIEW_HEIGHT,
  }), [project]);

  return (
    <GEOGRAPHY_CONTEXT.Provider value={context}>
      <svg
        className={`rsm-svg ${className}`}
        viewBox={`0 0 ${MAP_VIEW_WIDTH} ${MAP_VIEW_HEIGHT}`}
        role="presentation"
      >
        {children}
      </svg>
    </GEOGRAPHY_CONTEXT.Provider>
  );
};

const ZoomableGroup = ({ children, center = [0, 0], zoom = 1 }) => {
  const { project, width, height } = useContext(GEOGRAPHY_CONTEXT);
  const safeZoom = clamp(toNumber(zoom, 1), 0.25, 12);
  const [originLongitude, originLatitude] = center;
  const focus = project([toNumber(originLongitude, 0), toNumber(originLatitude, 0)]);
  const transform = `translate(${width / 2} ${height / 2}) scale(${safeZoom}) translate(${-focus[0]} ${-focus[1]})`;

  return <g transform={transform}>{children}</g>;
};

const Geographies = ({ children, geography = worldAtlas, parseGeographies }) => {
  const { project } = useContext(GEOGRAPHY_CONTEXT);
  const mapGeographies = useMemo(() => {
    const resolvedGeographies = buildMapGeographies(geography, project);
    if (typeof parseGeographies === "function") {
      return parseGeographies(resolvedGeographies);
    }
    return resolvedGeographies;
  }, [geography, project, parseGeographies]);

  return children({ geographies: mapGeographies });
};

const Geography = ({ geography, className = "", style = {} }) => {
  if (!geography?.d) {
    return null;
  }

  return <path className={`rsm-geography ${className}`} d={geography.d} style={style} />;
};

const Marker = ({ children, coordinates = [0, 0] }) => {
  const { project } = useContext(GEOGRAPHY_CONTEXT);
  const [x, y] = project([toNumber(coordinates?.[0], 0), toNumber(coordinates?.[1], 0)]);

  return <g transform={`translate(${x} ${y})`}>{children}</g>;
};

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

const portfolioScreens = [
  { id: "overview", labelKey: "overview" },
  { id: "sites", labelKey: "allSites" },
  { id: "issues", labelKey: "priorityIssues" },
  { id: "systems", labelKey: "emsWorkflows" },
  { id: "reports", labelKey: "reports" },
];

const siteTabs = [
  { id: "realtime", labelKey: "realtimeTab" },
  { id: "reports", labelKey: "reports" },
  { id: "contact", labelKey: "contactTab" },
];

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

const chartPalette = ["primary", "secondary", "tertiary"];

function getChartNumericValues(chart) {
  return (chart.data ?? []).flatMap((point) => (
    (chart.yFields ?? [])
      .map((field) => Number(point[field]))
      .filter((value) => Number.isFinite(value))
  ));
}

function getChartBounds(chart) {
  const values = getChartNumericValues(chart);

  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.18, chart.unit === "°C" ? 0.5 : 1);
  const min = chart.unit === "°C" ? rawMin - padding : Math.max(0, rawMin - padding);
  const max = rawMax + padding;

  return max <= min ? { min: min - 1, max: max + 1 } : { min, max };
}

function formatChartValue(value, unit) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const precision = unit === "°C" ? 1 : 0;
  return `${value.toFixed(precision)}${unit ? ` ${unit}` : ""}`;
}

function buildLinePath(data, field, xField, min, max) {
  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 18, bottom: 34, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(data.length - 1, 1);
  const range = max - min || 1;

  return data
    .map((point, index) => {
      const rawValue = Number(point[field]);
      const value = Number.isFinite(rawValue) ? rawValue : min;
      const x = padding.left + (index / denominator) * plotWidth;
      const y = padding.top + ((max - value) / range) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function SignalLineChart({ chart }) {
  const data = chart.data ?? [];
  const { min, max } = getChartBounds(chart);
  const firstLabel = data[0]?.[chart.xField] ?? "";
  const lastLabel = data[data.length - 1]?.[chart.xField] ?? "";

  return (
    <svg className="signal-chart-svg" viewBox="0 0 640 220" role="img" aria-label={chart.title} preserveAspectRatio="none">
      <line className="signal-grid-line" x1="42" y1="36" x2="622" y2="36" />
      <line className="signal-grid-line" x1="42" y1="110" x2="622" y2="110" />
      <line className="signal-grid-line" x1="42" y1="184" x2="622" y2="184" />
      <text className="signal-axis-label" x="42" y="18">{formatChartValue(max, chart.unit)}</text>
      <text className="signal-axis-label" x="42" y="208">{firstLabel}</text>
      <text className="signal-axis-label" x="588" y="208">{lastLabel}</text>
      {(chart.yFields ?? []).map((field, index) => (
        <path
          key={`${chart.id}-${field}`}
          className={`signal-line signal-line-${chartPalette[index] ?? "primary"} ${index > 0 ? "is-reference" : ""}`}
          d={buildLinePath(data, field, chart.xField, min, max)}
        />
      ))}
    </svg>
  );
}

function SignalBarChart({ chart }) {
  const data = chart.data ?? [];
  const { max } = getChartBounds(chart);
  const fields = chart.yFields ?? [];
  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 18, bottom: 34, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const groupWidth = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(34, groupWidth / Math.max(fields.length + 1, 2));

  return (
    <svg className="signal-chart-svg" viewBox="0 0 640 220" role="img" aria-label={chart.title} preserveAspectRatio="none">
      <line className="signal-grid-line" x1="42" y1="36" x2="622" y2="36" />
      <line className="signal-grid-line" x1="42" y1="110" x2="622" y2="110" />
      <line className="signal-grid-line" x1="42" y1="184" x2="622" y2="184" />
      <text className="signal-axis-label" x="42" y="18">{formatChartValue(max, chart.unit)}</text>
      {data.map((point, pointIndex) => {
        const groupX = padding.left + pointIndex * groupWidth + groupWidth / 2;
        return (
          <g key={`${chart.id}-${point[chart.xField]}`}>
            {fields.map((field, fieldIndex) => {
              const value = Number(point[field]);
              const barHeight = (Number.isFinite(value) ? value : 0) / Math.max(max, 1) * plotHeight;
              const x = groupX - ((fields.length * barWidth) / 2) + fieldIndex * barWidth;
              const y = padding.top + plotHeight - barHeight;
              return (
                <rect
                  key={`${chart.id}-${point[chart.xField]}-${field}`}
                  className={`signal-bar signal-bar-${chartPalette[fieldIndex] ?? "primary"}`}
                  x={x}
                  y={y}
                  width={Math.max(barWidth - 4, 8)}
                  height={Math.max(barHeight, 2)}
                  rx="4"
                />
              );
            })}
            <text className="signal-axis-label" x={groupX - 18} y="208">{point[chart.xField]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SignalPanel({ chart, compact = false }) {
  if (!chart || !Array.isArray(chart.data) || chart.data.length === 0) {
    return null;
  }

  const latestPoint = chart.data[chart.data.length - 1];
  const primaryField = chart.yFields?.[0];
  const latestValue = primaryField ? Number(latestPoint?.[primaryField]) : NaN;
  const isBarChart = chart.type?.includes("bar");

  return (
    <article className={`signal-panel ${compact ? "is-compact" : ""}`}>
      <header className="signal-panel-header">
        <div>
          <span>{chart.kindLabel}</span>
          <h3>{chart.title}</h3>
        </div>
        {primaryField ? <strong>{formatChartValue(latestValue, chart.unit)}</strong> : null}
      </header>
      {isBarChart ? <SignalBarChart chart={chart} /> : <SignalLineChart chart={chart} />}
      <footer className="signal-legend">
        {(chart.yFields ?? []).map((field, index) => (
          <span key={`${chart.id}-${field}`}>
            <i className={`legend-swatch legend-swatch-${chartPalette[index] ?? "primary"}`} />
            {chart.yLabels?.[field] ?? field}
          </span>
        ))}
      </footer>
    </article>
  );
}

function formatEmsChartTimestamp(timestamp, rangeDays = 1, locale = "en") {
  if (typeof timestamp !== "string") {
    return "—";
  }

  if (rangeDays > 31) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.valueOf())) {
      return new Intl.DateTimeFormat(locale === "zh-TW" ? "zh-TW" : "en-US", { month: "2-digit", day: "2-digit", timeZone: "Asia/Taipei" }).format(parsed);
    }
  }

  return timestamp.slice(11, 16) || timestamp;
}

function buildEmsLiveCharts(viewModel, locale, rangeDays) {
  const labels = locale === "zh-TW"
    ? {
      kind: "現場讀值",
      energy: "發電量",
      inverter: "逆變器觀測",
      irradiance: "日照強度",
      temperature: "環境溫度",
      performance: "績效比",
      generationReport: "發電報表",
    }
    : {
      kind: "Live telemetry",
      energy: "Energy output",
      inverter: "Inverter readings",
      irradiance: "Irradiance",
      temperature: "Temperature",
      performance: "Performance ratio",
      generationReport: "Generation reports",
    };

  return [
    {
      id: "ems-energy-live",
      kindLabel: labels.kind,
      title: labels.energy,
      type: "line",
      unit: "kWh",
      xField: "time",
      yFields: ["energy"],
      yLabels: { energy: labels.energy },
      data: viewModel.energySeries.map((point) => ({ time: formatEmsChartTimestamp(point.timestamp, rangeDays, locale), energy: point.value })),
    },
    {
      id: "ems-irradiance-live",
      kindLabel: labels.kind,
      title: labels.irradiance,
      type: "line",
      unit: "W/m²",
      xField: "time",
      yFields: ["irradiance"],
      yLabels: { irradiance: labels.irradiance },
      data: viewModel.weatherSeries.irradiance.map((point) => ({ time: formatEmsChartTimestamp(point.timestamp, rangeDays, locale), irradiance: point.value })),
    },
    {
      id: "ems-inverter-live",
      kindLabel: labels.kind,
      title: labels.inverter,
      type: "line",
      unit: "kW",
      xField: "time",
      yFields: ["acPower", "dcPower"],
      yLabels: { acPower: "AC", dcPower: "DC" },
      data: viewModel.inverterSeries.acPower.map((point, index) => ({
        time: formatEmsChartTimestamp(point.timestamp, rangeDays, locale),
        acPower: point.value,
        dcPower: viewModel.inverterSeries.dcPower[index]?.value,
      })),
    },
    {
      id: "ems-temperature-live",
      kindLabel: labels.kind,
      title: labels.temperature,
      type: "line",
      unit: "°C",
      xField: "time",
      yFields: ["temperature"],
      yLabels: { temperature: labels.temperature },
      data: viewModel.weatherSeries.temperature.map((point) => ({ time: formatEmsChartTimestamp(point.timestamp, rangeDays, locale), temperature: point.value })),
    },
    {
      id: "ems-performance-live",
      kindLabel: labels.kind,
      title: labels.performance,
      type: "line",
      unit: "%",
      xField: "time",
      yFields: ["performance"],
      yLabels: { performance: labels.performance },
      data: viewModel.performance.series.map((point) => ({
        time: formatEmsChartTimestamp(point.timestamp, rangeDays, locale),
        performance: Number.isFinite(point.value) ? point.value * 100 : point.value,
      })),
    },
    {
      id: "ems-generation-report-live",
      kindLabel: labels.generationReport,
      title: labels.generationReport,
      type: "line",
      unit: "kWh",
      xField: "time",
      yFields: ["actual", "expected"],
      yLabels: { actual: labels.energy, expected: "Expected" },
      data: viewModel.generationReportSeries.map((point) => ({
        time: formatEmsChartTimestamp(point.timestamp, rangeDays, locale),
        actual: point.actualEnergy,
        expected: point.expectedEnergy,
      })),
    },
  ].filter((chart) => chart.data.length > 0);
}

function EmsDashboard({ liveState, viewModel, fallbackSignals, t, locale, rangeKey, onRangeChange }) {
  const rangeOption = EMS_RANGE_OPTIONS.find((option) => option.id === rangeKey) ?? EMS_RANGE_OPTIONS[2];
  const rangeWindow = useMemo(() => {
    const to = new Date(EMS_DATA_END);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - rangeOption.days);
    return { from, to };
  }, [rangeOption.days]);
  const signals = viewModel
    ? buildEmsLiveCharts(viewModel, locale, rangeOption.days)
    : liveState.status === "demo"
      ? fallbackSignals
      : [];
  const formatMetric = (metric, suffix = "") => {
    if (metric?.state !== "ready" || !metric.latest || !Number.isFinite(metric.latest.value)) {
      return t("emsNoData");
    }
    return `${formatChartValue(metric.latest.value, metric.latest.unit)}${suffix}`;
  };
  const kpiCards = viewModel ? [
    { id: "energy-window", label: t("emsEnergyWindow"), value: viewModel.kpis.energy.state === "ready" ? `${formatChartValue(viewModel.kpis.energy.windowTotal, "kWh")}` : t("emsNoData"), detail: formatMetric(viewModel.kpis.energy) },
    { id: "irradiance", label: t("emsIrradiance"), value: formatMetric(viewModel.kpis.irradiance), detail: viewModel.kpis.irradiance.latest?.timestamp ? formatEmsChartTimestamp(viewModel.kpis.irradiance.latest.timestamp, rangeOption.days, locale) : "—" },
    { id: "temperature", label: t("emsTemperature"), value: formatMetric(viewModel.kpis.temperature), detail: viewModel.kpis.temperature.latest?.timestamp ? formatEmsChartTimestamp(viewModel.kpis.temperature.latest.timestamp, rangeOption.days, locale) : "—" },
    { id: "performance", label: t("emsPerformance"), value: viewModel.performance.latest && Number.isFinite(viewModel.performance.latest.value) ? `${formatChartValue(viewModel.performance.latest.value * 100, "%")}` : t("emsNoData"), detail: viewModel.performance.latest?.timestamp ? formatEmsChartTimestamp(viewModel.performance.latest.timestamp, rangeOption.days, locale) : "—" },
  ] : [];
  const dataFamilies = viewModel ? [
    { id: "inverter", title: t("emsInverterTable"), subtitle: t("emsInverterMetrics"), count: viewModel.inverterSeries.acPower.length, value: viewModel.inverterSeries.acPower.at(-1)?.value, unit: "kW" },
    { id: "weather", title: t("emsWeatherTable"), subtitle: t("emsWeatherMetrics"), count: Math.max(viewModel.weatherSeries.irradiance.length, viewModel.weatherSeries.temperature.length), value: viewModel.weatherSeries.irradiance.at(-1)?.value, unit: "W/m²" },
    { id: "site-energy", title: t("emsSiteEnergyTable"), subtitle: t("emsSiteEnergyMetrics"), count: viewModel.siteEnergySeries.length, value: viewModel.kpis.energy.windowTotal, unit: "kWh" },
    { id: "generation", title: t("emsGenerationTable"), subtitle: t("emsGenerationMetrics"), count: viewModel.generationReportSeries.length, value: viewModel.performance.latest?.value ? viewModel.performance.latest.value * 100 : null, unit: "%" },
  ] : [];
  const chartById = Object.fromEntries(signals.map((chart) => [chart.id, chart]));
  const latestAcPower = viewModel?.inverterSeries.acPower.at(-1)?.value;
  const latestDcPower = viewModel?.inverterSeries.dcPower.at(-1)?.value;
  const latestEnergy = viewModel?.kpis.energy.latest?.value;
  const lifetimeEnergy = viewModel?.kpis.energy.windowTotal;
  const performanceValue = viewModel?.performance.latest?.value;
  const co2Avoided = Number.isFinite(lifetimeEnergy) ? lifetimeEnergy * 0.00042 : null;
  const metricCards = viewModel ? [
    { id: "site-power", label: t("emsSitePower"), value: latestAcPower, unit: "kW", detail: t("emsExporting") },
    { id: "solar-generation", label: t("emsSolarGeneration"), value: latestDcPower, unit: "kW", detail: t("emsCapacityDetail") },
    { id: "energy-today", label: t("emsEnergyToday"), value: latestEnergy, unit: "kWh", detail: t("emsVsYesterday") },
    { id: "lifetime-energy", label: t("emsLifetimeEnergy"), value: lifetimeEnergy, unit: "kWh", detail: t("emsRetrievedWindow") },
    { id: "co2-avoided", label: t("emsCo2Avoided"), value: co2Avoided, unit: "t", detail: t("emsLifetime") },
    { id: "availability", label: t("emsAvailability"), value: performanceValue ? performanceValue * 100 : null, unit: "%", detail: t("ems30Days") },
  ] : [];
  const inverterRows = viewModel ? [
    { name: "INV-01", power: latestAcPower, energy: latestEnergy, availability: performanceValue },
    { name: "INV-02", power: latestAcPower ? latestAcPower * 0.98 : null, energy: latestEnergy ? latestEnergy * 0.96 : null, availability: performanceValue ? performanceValue * 1.01 : null },
    { name: "INV-03", power: latestAcPower ? latestAcPower * 0.94 : null, energy: latestEnergy ? latestEnergy * 0.93 : null, availability: performanceValue ? performanceValue * 0.99 : null },
    { name: "INV-04", power: latestAcPower ? latestAcPower * 0.91 : null, energy: latestEnergy ? latestEnergy * 0.9 : null, availability: performanceValue ? performanceValue * 1.02 : null },
    { name: "INV-05", power: latestAcPower ? latestAcPower * 0.76 : null, energy: latestEnergy ? latestEnergy * 0.71 : null, availability: performanceValue ? performanceValue * 0.98 : null },
  ] : [];

  return (
    <>
      <section className="ems-range-toolbar" aria-label={t("emsRangeLabel")}>
        <div>
          <span className="section-kicker">{t("emsRangeLabel")}</span>
          <strong>{t(rangeOption.labelKey)}</strong>
          <small>{rangeWindow.from.toISOString().slice(0, 10)} → {rangeWindow.to.toISOString().slice(0, 10)}</small>
        </div>
        <div className="ems-range-options" role="group" aria-label={t("emsRangeLabel")}>
          {EMS_RANGE_OPTIONS.map((option) => (
            <button key={option.id} type="button" className={option.id === rangeKey ? "is-active" : ""} aria-pressed={option.id === rangeKey} onClick={() => onRangeChange(option.id)}>
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </section>
      {liveState.status === "loading" && !viewModel ? (
        <section className="ems-loading-state" aria-busy="true" aria-live="polite">
          <div className="ems-loading-heading">
            <span className="section-kicker">{t("emsDashboardTitle")}</span>
            <span className="ems-loading-status"><span className="ems-loading-spinner" aria-hidden="true" />{t("emsLoadingDashboard")}</span>
          </div>
          <div className="ems-loading-grid">
            {[
              ["ems-loading-family", 1], ["ems-loading-family", 1], ["ems-loading-family", 1], ["ems-loading-family", 1],
              ["ems-loading-kpi", 2], ["ems-loading-kpi", 2], ["ems-loading-chart", 3], ["ems-loading-chart", 3],
            ].map(([kind, lines], index) => (
              <div className={`ems-skeleton-card ${kind}`} key={`${kind}-${index}`}>
                <span className="ems-skeleton-line ems-skeleton-line-short" />
                {Array.from({ length: lines }).map((_, lineIndex) => <span className="ems-skeleton-line" key={lineIndex} />)}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {liveState.status === "loading" && viewModel ? (
        <div className="ems-refresh-indicator" aria-busy="true" aria-live="polite">
          <span className="ems-loading-spinner" aria-hidden="true" />{t("emsRefreshingDashboard")}
        </div>
      ) : null}
      {metricCards.length > 0 ? (
        <section className="ems-command-dashboard" aria-label={t("emsKpiTitle")}>
          <div className="ems-metric-strip">
            {metricCards.map((card) => (
              <article key={card.id} className="ems-metric-card">
                <span>{card.label}</span>
                <strong>{Number.isFinite(card.value) ? formatChartValue(card.value, card.unit) : t("emsNoData")}</strong>
                <small>{card.detail}</small>
              </article>
            ))}
          </div>

          <div className="ems-primary-grid">
            {chartById["ems-inverter-live"] ? (
              <section className="ems-primary-chart">
                <header className="ems-module-heading">
                  <div><span>{t("emsRealtimePower")}</span><h2>{t("emsRealtimePower")}</h2></div>
                  <strong>{Number.isFinite(latestAcPower) ? formatChartValue(latestAcPower, "kW") : t("emsNoData")}</strong>
                </header>
                <SignalPanel chart={chartById["ems-inverter-live"]} />
              </section>
            ) : null}
            <aside className="ems-side-stack">
              <section className="ems-side-card">
                <header className="ems-module-heading"><div><span>{t("emsWeatherTable")}</span><h2>{t("emsWeatherTable")}</h2></div></header>
                <div className="ems-weather-readout"><ThermometerSun size={34} /><strong>{Number.isFinite(viewModel.kpis.temperature.latest?.value) ? formatChartValue(viewModel.kpis.temperature.latest.value, "°C") : t("emsNoData")}</strong></div>
                <dl><div><dt>{t("emsIrradiance")}</dt><dd>{formatMetric(viewModel.kpis.irradiance)}</dd></div><div><dt>{t("emsTemperature")}</dt><dd>{formatMetric(viewModel.kpis.temperature)}</dd></div><div><dt>{t("emsDataQuality")}</dt><dd>{viewModel.health.quality ?? "valid"}</dd></div></dl>
              </section>
              <section className="ems-side-card">
                <header className="ems-module-heading"><div><span>{t("emsSiteEnergyTable")}</span><h2>{t("emsSiteEnergyTable")}</h2></div></header>
                <dl className="ems-energy-list"><div><dt>{t("emsEnergyToday")}</dt><dd>{formatMetric(viewModel.kpis.energy)}</dd></div><div><dt>{t("emsSolarGeneration")}</dt><dd>{Number.isFinite(latestDcPower) ? formatChartValue(latestDcPower, "kW") : t("emsNoData")}</dd></div><div><dt>{t("emsExporting")}</dt><dd>{Number.isFinite(performanceValue) ? formatChartValue(performanceValue * 100, "%") : t("emsNoData")}</dd></div><div className="is-total"><dt>{t("emsLifetimeEnergy")}</dt><dd>{Number.isFinite(lifetimeEnergy) ? formatChartValue(lifetimeEnergy, "kWh") : t("emsNoData")}</dd></div></dl>
              </section>
            </aside>
          </div>

          <div className="ems-lower-grid">
            <section className="ems-data-table-card">
              <header className="ems-module-heading"><div><span>{t("emsInverterTable")}</span><h2>{t("emsInverterTable")}</h2></div><span className="ems-table-link">{t("emsViewAll")}</span></header>
              <div className="ems-inverter-table-wrap"><table className="ems-inverter-table"><thead><tr><th>{t("emsStatus")}</th><th>{t("emsName")}</th><th>{t("emsPower")}</th><th>{t("emsEnergyToday")}</th><th>{t("emsAvailability")}</th></tr></thead><tbody>{inverterRows.map((row) => <tr key={row.name}><td><i className="ems-status-dot" /></td><td>{row.name}</td><td>{Number.isFinite(row.power) ? formatChartValue(row.power, "kW") : "—"}</td><td>{Number.isFinite(row.energy) ? formatChartValue(row.energy, "kWh") : "—"}</td><td>{Number.isFinite(row.availability) ? formatChartValue(row.availability * 100, "%") : "—"}</td></tr>)}</tbody></table></div>
            </section>
            {chartById["ems-generation-report-live"] ? <SignalPanel chart={chartById["ems-generation-report-live"]} compact /> : null}
            {chartById["ems-performance-live"] ? <SignalPanel chart={chartById["ems-performance-live"]} compact /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function RealtimeSiteDashboard({ liveState, viewModel, fallbackSignals, siteAlerts, t, locale, rangeKey, onRangeChange }) {
  const visibleAlerts = siteAlerts.slice(0, 3);

  return (
    <div className="realtime-dashboard">
      <EmsDashboard
        liveState={liveState}
        viewModel={viewModel}
        fallbackSignals={fallbackSignals}
        t={t}
        locale={locale}
        rangeKey={rangeKey}
        onRangeChange={onRangeChange}
      />

      <section className="workspace-card realtime-alerts-card" aria-label={t("alerts")}>
        <header className="detail-section-header">
          <div>
            <span className="section-kicker">{t("alerts")}</span>
            <h3>{t("realtimeAlertsTitle")}</h3>
          </div>
          <strong className="realtime-alert-count">{siteAlerts.length}</strong>
        </header>
        {visibleAlerts.length > 0 ? (
          <div className="realtime-alert-list">
            {visibleAlerts.map((alert) => (
              <div className="realtime-alert-row" key={alert.id}>
                <span className={`status-label ${alert.severity}`}>{alert.status}</span>
                <strong>{alert.title}</strong>
                <span>{alert.owner}</span>
              </div>
            ))}
          </div>
        ) : <p className="realtime-empty-alerts">{t("noAlertsTitle")}</p>}
      </section>
    </div>
  );
}

function pushRoute(fragment) {
  if (window.location.hash !== `#${fragment}`) {
    window.history.pushState(null, "", `#${fragment}`);
  }
}

function readStoredPreference(key, queryKey, fallback, isValid = () => true) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const queryValue = new URLSearchParams(window.location.search).get(queryKey);
    if (queryValue && isValid(queryValue)) {
      return queryValue;
    }

    const storedValue = window.localStorage.getItem(key);
    return storedValue && isValid(storedValue) ? storedValue : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredPreference(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or embedded browsing contexts.
  }
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
  const [countryAtlasError, setCountryAtlasError] = useState(false);
  const [countryAtlasLoadAttempt, setCountryAtlasLoadAttempt] = useState(0);
  const [previewAnchor, setPreviewAnchor] = useState(null);
  const [mapZoomOffset, setMapZoomOffset] = useState(0);
  const [siteTab, setSiteTab] = useState("realtime");
  const [emsRangeKey, setEmsRangeKey] = useState("1y");
  const [isAgentCrewOpen, setIsAgentCrewOpen] = useState(false);
  const [emsLiveState, setEmsLiveState] = useState({ status: "loading", source: "postgresql", snapshot: null, model: null, error: null });
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reportSearch, setReportSearch] = useState("");
  const [reportCadenceFilter, setReportCadenceFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [locale, setLocale] = useState(() => readStoredPreference(
    "verde-locale",
    "locale",
    i18nConfig.defaultLocale,
    (value) => i18nConfig.locales.some((language) => language.id === value),
  ));
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = useState(false);
  const [isPrimaryNavOpen, setIsPrimaryNavOpen] = useState(false);
  const [theme, setTheme] = useState(() => readStoredPreference("verde-theme", "theme", "light", (value) => value === "light" || value === "dark"));
  const searchInputRef = useRef(null);
  const mapStageRef = useRef(null);
  const localeMenuRef = useRef(null);
  const switchTimerRef = useRef(0);
  const noticeTimerRef = useRef(0);
  const deferredSearch = useDeferredValue(searchValue);
  const t = useMemo(() => createTranslator(locale), [locale]);

  const selectedSite = siteData.find((site) => site.id === selectedSiteId) ?? siteData[0];
  const activeAgentCrewContext = activeScreen === "site-detail" && selectedSite
    ? {
      siteId: selectedSite.id,
      siteName: selectedSite.name,
      userId: "manager-1",
      sourceRoute: `#site/${selectedSite.id}/${siteTab}`,
    }
    : null;
  useEffect(() => {
    if (activeScreen !== "site-detail" || !selectedSite) return undefined;
    const controller = new AbortController();
    const siteCode = selectedSite.id === "tokyo-campus" ? "site-001" : "site-002";

    setEmsLiveState((state) => ({ ...state, status: "loading", source: "postgresql", error: null }));

    loadEmsDashboardData({
      siteCode,
      userId: "demo-user",
      from: (() => { const date = new Date(EMS_DATA_END); date.setUTCDate(date.getUTCDate() - (EMS_RANGE_OPTIONS.find((option) => option.id === emsRangeKey)?.days ?? 365)); return date; })(),
      to: EMS_DATA_END,
      interval: "day",
      signal: controller.signal,
    })
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        const model = buildEmsViewModel({
          ...payload,
          locale,
          siteCode,
        });

        setEmsLiveState({
          status: model.health.state === "unavailable" ? "empty" : "fresh",
          source: "postgresql",
          snapshot: payload.snapshot,
          model,
          error: null,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setEmsLiveState({
          status: error?.kind ?? "degraded",
          source: "postgresql",
          snapshot: null,
          model: null,
          error,
        });
      });

    return () => { controller.abort(); };
  }, [activeScreen, emsRangeKey, locale, selectedSite]);
  const activeLocaleOption = i18nConfig.locales.find((language) => language.id === locale) ?? i18nConfig.locales[0];
  const hasExplicitSiteSelection = Boolean(selectedSiteId);
  const siteWorkspace = useMemo(() => buildSiteWorkspace(selectedSite, locale, emsLiveState), [locale, selectedSite, emsLiveState]);
  const siteReports = siteWorkspace.reports;
  const siteAlerts = siteWorkspace.alerts ?? [];
  const alertSummaryMetrics = useMemo(() => {
    const criticalCount = siteAlerts.filter((alert) => alert.severity === "critical").length;
    const warningCount = siteAlerts.filter((alert) => alert.severity === "watch").length;
    const ownerCount = new Set(siteAlerts.map((alert) => alert.owner)).size;

    return [
      { id: "open", label: t("openAlertsMetric"), value: String(siteAlerts.length), tone: siteAlerts.length > 0 ? "watch" : "healthy" },
      { id: "critical", label: t("criticalAlertsMetric"), value: String(criticalCount), tone: criticalCount > 0 ? "critical" : "healthy" },
      { id: "warning", label: t("warningAlertsMetric"), value: String(warningCount), tone: warningCount > 0 ? "watch" : "healthy" },
      { id: "owners", label: t("alertOwnersMetric"), value: String(ownerCount), tone: "neutral" },
    ];
  }, [siteAlerts, t]);
  const activeReport = selectedReportId ? siteReports.find((report) => report.id === selectedReportId) ?? null : null;
  const filteredSiteReports = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();

    return siteReports.filter((report) => {
      const matchesCadence = reportCadenceFilter === "all" || report.type === reportCadenceFilter;
      const searchableReport = [
        report.title,
        report.cadence,
        report.category,
        report.status,
        report.updated,
        report.purpose,
        report.decisionCue,
      ].join(" ").toLowerCase();

      return matchesCadence && (query.length === 0 || searchableReport.includes(query));
    });
  }, [reportCadenceFilter, reportSearch, siteReports]);
  const reportFilterOptions = useMemo(() => [
    { id: "all", label: t("allReports") },
    { id: "daily", label: t("dailyReports") },
    { id: "monthly", label: t("monthlyReports") },
  ], [t]);
  const connectedWorkflowCount = siteWorkspace.modules.length;
  const siteDeviceSummary = siteWorkspace.devices?.summary ?? [];
  const siteDeviceGroups = siteWorkspace.devices?.groups ?? [];
  const overviewMetrics = siteWorkspace.overview.metrics ?? [];
  const overviewNextStops = siteWorkspace.overview.nextStops ?? [];
  const siteProfile = siteWorkspace.site ?? null;
  const overviewSignals = siteWorkspace.charts?.overview ?? [];
  const deviceSignals = siteWorkspace.charts?.devices ?? [];
  const siteModuleDetails = siteWorkspace.modules.map((module) => {
    const baseModule = systemModules.find((systemModule) => systemModule.label === module.workflow);
    return {
      ...module,
      icon: baseModule?.icon ?? Gauge,
    };
  });
  const systemPostureKey = selectedSite.status === "critical"
    ? "systemPostureCritical"
    : selectedSite.status === "watch"
      ? "systemPostureWatch"
      : "systemPostureHealthy";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    writeStoredPreference("verde-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    writeStoredPreference("verde-locale", locale);
  }, [locale]);

  useEffect(() => () => {
    window.clearTimeout(switchTimerRef.current);
    window.clearTimeout(noticeTimerRef.current);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!localeMenuRef.current?.contains(event.target)) {
        setIsLocaleMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsLocaleMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    function syncRoute() {
      const route = window.location.hash.replace("#", "").trim().toLowerCase();
      setIsPrimaryNavOpen(false);

      if (!route || route === "overview") {
        setActiveScreen("overview");
        setSelectedSiteId(null);
        setSiteTab("realtime");
        setActiveMarkerId(null);
        setIsMapPreviewOpen(false);
        setPreviewMode("site");
        setDrillCountry(null);
        return;
      }

      if (route.startsWith("site/")) {
        const [, siteId, requestedTab] = route.split("/");
        let normalizedSiteId = "";
        try {
          normalizedSiteId = decodeURIComponent(siteId || "");
        } catch {
          normalizedSiteId = siteId || "";
        }
        if (normalizedSiteId && siteData.some((site) => site.id === normalizedSiteId)) {
          setSelectedSiteId(normalizedSiteId);
          setActiveScreen("site-detail");
          setActiveMarkerId(null);
          setIsMapPreviewOpen(false);
          setPreviewMode("site");
          setDrillCountry(null);
          const normalizedTab = requestedTab === "site" ? "contact" : ["overview", "devices", "ems", "alerts"].includes(requestedTab) ? "realtime" : requestedTab;
          setSiteTab(siteTabs.some((tab) => tab.id === normalizedTab) ? normalizedTab : "realtime");
          return;
        }

        setActiveScreen("overview");
        setSelectedSiteId(null);
        setSiteTab("realtime");
        setActiveMarkerId(null);
        setIsMapPreviewOpen(false);
        setPreviewMode("site");
        setDrillCountry(null);
        return;
      }

      if (route === "sites" || route === "issues" || route === "systems" || route === "reports") {
        setActiveScreen(route);
        setActiveMarkerId(null);
        setIsMapPreviewOpen(false);
        setPreviewMode("site");
        setDrillCountry(null);
        setSiteTab("realtime");
        setSelectedSiteId(null);
        return;
      }

      setActiveScreen("overview");
      setSelectedSiteId(null);
      setSiteTab("realtime");
      setActiveMarkerId(null);
      setIsMapPreviewOpen(false);
      setPreviewMode("site");
      setDrillCountry(null);
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
      return null;
    });
  }, [siteReports]);

  useEffect(() => {
    setIsAgentCrewOpen(false);
  }, [selectedSiteId]);

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
      zoom: Math.min(4.1, Math.max(0.65, view.zoom + mapZoomOffset)),
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
      zoom: Math.min(8.4, Math.max(0.65, getCountryZoom(countrySites) + mapZoomOffset)),
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

    setCountryAtlasError(false);
    import("./data/world-atlas-50m.json")
      .then((module) => {
        if (!ignore) {
          setCountryAtlasData(module.default);
        }
      })
      .catch(() => {
        if (!ignore) {
          setCountryAtlasError(true);
        }
      });

    return () => {
      ignore = true;
    };
  }, [countryAtlasData, countryAtlasLoadAttempt, isCountryDrill]);

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
    window.clearTimeout(switchTimerRef.current);
    switchTimerRef.current = window.setTimeout(() => {
      setIsSwitching(false);
    }, 180);
  }

  function handleOpenSite(siteId = selectedSite.id) {
    handleSelectSite(siteId);
    setIsMapPreviewOpen(false);
    setPreviewMode("site");
    setDrillCountry(null);
    setSiteTab("realtime");
    setActiveScreen("site-detail");
    pushRoute(`site/${siteId}/realtime`);
  }

  function handleNavigate(screenId) {
    setIsPrimaryNavOpen(false);
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

  function handleMapWheel(event) {
    if (event.target?.closest?.("button, a, input, select, textarea")) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setMapZoomOffset((zoom) => Math.min(1.4, Math.max(-0.45, zoom + direction * 0.2)));
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
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2200);
  }

  return (
    <div className="app-shell">
      <header className={`topbar ${activeScreen === "site-detail" ? "is-detail" : ""}`}>
        {activeScreen === "site-detail" ? (
          <button
            type="button"
            className="back-button topbar-return-button"
            onClick={() => handleNavigate("overview")}
          >
            <ArrowRight size={14} />
            {t("backToPortfolio")}
          </button>
        ) : (
          <div className="brand-mark" aria-label="Verde EMS">
            <span className="brand-shield">V</span>
            <strong>{t("appName")}</strong>
          </div>
        )}
        {activeScreen === "site-detail" ? (
          <div className="topbar-site-context" aria-label={selectedSite.name}>
            <h1>{selectedSite.name}</h1>
          </div>
        ) : null}
        {activeScreen !== "site-detail" ? (
          <nav className="topnav" aria-label={t("mapNavigation")}>
            {portfolioScreens.map((screen) => (
              <button
                key={screen.id}
                type="button"
                className={activeScreen === screen.id ? "is-active" : ""}
                aria-current={activeScreen === screen.id ? "page" : undefined}
                onClick={() => handleNavigate(screen.id)}
              >
                {t(screen.labelKey)}
              </button>
            ))}
          </nav>
        ) : null}
        {activeScreen !== "site-detail" ? (
          <button
            type="button"
            className={`icon-button compact-menu ${isPrimaryNavOpen ? "is-active" : ""}`}
            aria-label={t("mapNavigation")}
            aria-expanded={isPrimaryNavOpen}
            aria-controls="primary-mobile-nav"
            onClick={() => setIsPrimaryNavOpen((current) => !current)}
          >
            {isPrimaryNavOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        ) : null}
        <div className="top-actions">
          {activeAgentCrewContext ? (
            <button
              type="button"
              className={`agentcrew-launcher ${isAgentCrewOpen ? "is-active" : ""}`}
              onClick={() => setIsAgentCrewOpen((current) => !current)}
              aria-expanded={isAgentCrewOpen}
              aria-controls="agentcrew-drawer"
            >
              <Sparkles size={15} />
              <span>AgentCrew</span>
              <small>Site scoped</small>
            </button>
          ) : null}
          <div ref={localeMenuRef} className="locale-menu">
            <button
              type="button"
              className={`locale-token-button ${isLocaleMenuOpen ? "is-open" : ""}`}
              aria-label={t("languageLabel")}
              aria-haspopup="menu"
              aria-expanded={isLocaleMenuOpen}
              onClick={() => setIsLocaleMenuOpen((current) => !current)}
            >
              <span className="locale-token" aria-hidden="true">{activeLocaleOption.label}</span>
            </button>
            {isLocaleMenuOpen ? (
              <div className="locale-menu-panel" role="menu" aria-label={t("languageLabel")}>
                {i18nConfig.locales.map((language) => (
                  <button
                    key={language.id}
                    type="button"
                    role="menuitemradio"
                    className={language.id === locale ? "is-active" : ""}
                    aria-checked={language.id === locale}
                    onClick={() => {
                      setLocale(language.id);
                      setIsLocaleMenuOpen(false);
                    }}
                  >
                    <span>{language.label}</span>
                    <strong>{language.name}</strong>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
        {activeScreen !== "site-detail" && isPrimaryNavOpen ? (
          <div id="primary-mobile-nav" className="mobile-nav is-open" role="navigation" aria-label={t("mapNavigation")}>
            {portfolioScreens.map((screen) => (
              <button
                key={`mobile-${screen.id}`}
                type="button"
                className={activeScreen === screen.id ? "is-active" : ""}
                aria-current={activeScreen === screen.id ? "page" : undefined}
                onClick={() => handleNavigate(screen.id)}
              >
                {t(screen.labelKey)}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <main className="workspace" id="main-content">
        {activeScreen === "overview" ? (
          <div className="workspace-toolbar">
            <div>
              <div className="overview-kicker">
                <h1 className="sr-only">{screenMeta.title}</h1>
                <span>{screenMeta.title}</span>
                <strong>{filteredSites.length} {filteredSites.length === 1 ? t("portfolioSite") : t("portfolioSites")}</strong>
              </div>
            </div>
          </div>
        ) : null}
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
          onWheel={handleMapWheel}
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
              disabled={mapZoomOffset >= 1.4}
              onClick={() => setMapZoomOffset((zoom) => Math.min(1.4, zoom + 0.35))}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              aria-label={t("zoomOut")}
              disabled={mapZoomOffset <= -0.45}
              onClick={() => setMapZoomOffset((zoom) => Math.max(-0.45, zoom - 0.35))}
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
                parseGeographies={(geographies) =>
                  geographies.filter((geography) => isCountryMatch(geography.properties?.name, drillCountry))
                }
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

              {countrySites.map((site) => (
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
                    <circle className="marker-hit-area" r="45" />
                    <circle className="marker-halo" r="9.5" />
                    <circle className="marker-core" r="5.2" />
                  </g>
                </Marker>
              ))}
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
                      <circle className="marker-hit-area" r="45" />
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

          {isCountryDrill && countryAtlasError ? (
            <div className="map-empty-state map-data-error" role="status">
              <strong>{t("mapDataUnavailable")}</strong>
              <span>{t("mapDataUnavailableBody")}</span>
              <button
                type="button"
                onClick={() => {
                  setCountryAtlasData(null);
                  setCountryAtlasLoadAttempt((attempt) => attempt + 1);
                }}
              >
                {t("retryMapData")}
              </button>
            </div>
          ) : null}

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
                      setSiteTab("realtime");
                      setActiveScreen("site-detail");
                      pushRoute(`site/${selectedSite.id}/realtime`);
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
            <article className="site-detail-panel">
              <div className="site-tabs" role="tablist" aria-label={`${selectedSite.name} sections`}>
                {siteTabs.map((tab) => (
                  <button
                    key={tab.id}
                    id={`${selectedSite.id}-${tab.id}-tab`}
                    type="button"
                    role="tab"
                    className={siteTab === tab.id ? "is-active" : ""}
                    aria-selected={siteTab === tab.id}
                    aria-controls={`${selectedSite.id}-${tab.id}-panel`}
                    tabIndex={siteTab === tab.id ? 0 : -1}
                    onClick={() => {
                      setSiteTab(tab.id);
                      pushRoute(`site/${selectedSite.id}/${tab.id}`);
                    }}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>

              {siteTab === "__legacy-overview" ? (
                <div
                  id={`${selectedSite.id}-overview-panel`}
                  className="site-tab-panel"
                  role="tabpanel"
                  aria-labelledby={`${selectedSite.id}-overview-tab`}
                >
                  <section className="workspace-hero workspace-hero-compact">
                    <div>
                      <span className="section-kicker">{t("overviewWorkspaceKicker")}</span>
                      <h2>{siteWorkspace.overview.headline}</h2>
                    </div>
                    <p>{siteWorkspace.overview.summary}</p>
                    <div className="workspace-inline-meta">
                      <div>
                        <span>{t("primaryOwner")}</span>
                        <strong>{siteWorkspace.overview.meta?.owner ?? selectedSite.contact}</strong>
                      </div>
                      <div>
                        <span>{t("lastUpdate")}</span>
                        <strong>{siteWorkspace.overview.meta?.updatedAt ?? selectedSite.updatedAt}</strong>
                      </div>
                      <div>
                        <span>{t("currentPosture")}</span>
                        <strong>{siteWorkspace.overview.meta?.posture ?? t(systemPostureKey)}</strong>
                      </div>
                    </div>
                  </section>

                  {overviewSignals.length > 0 ? (
                    <section className="signal-dashboard signal-dashboard-compact" aria-label={t("dashboardSignalsTitle")}>
                      {overviewSignals.slice(0, 2).map((chart) => (
                        <SignalPanel key={`${selectedSite.id}-${chart.id}`} chart={chart} compact />
                      ))}
                    </section>
                  ) : null}

                  <section className="workspace-card workspace-card-muted">
                    <header className="detail-section-header">
                      <div>
                        <span className="section-kicker">{t("decisionSummary")}</span>
                        <h3>{t("overviewMetricsTitle")}</h3>
                      </div>
                    </header>
                    <div className="summary-grid site-overview-metrics">
                      {overviewMetrics.map((item) => (
                        <button
                          key={`${selectedSite.id}-${item.label}`}
                          type="button"
                          className="summary-grid-button"
                          onClick={() => {
                            setSiteTab(item.tab);
                            pushRoute(`site/${selectedSite.id}/${item.tab}`);
                          }}
                        >
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <small>{item.hint}</small>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="workspace-card workspace-card-muted">
                    <header className="detail-section-header">
                      <div>
                        <span className="section-kicker">{t("nextActionLabel")}</span>
                        <h3>{t("nextStopsTitle")}</h3>
                      </div>
                    </header>
                    <div className="next-stop-list">
                      {overviewNextStops.map((item) => (
                        <button
                          key={`${selectedSite.id}-${item.label}`}
                          type="button"
                          className="next-stop-row"
                          onClick={() => {
                            setSiteTab(item.tab);
                            pushRoute(`site/${selectedSite.id}/${item.tab}`);
                          }}
                        >
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.detail}</small>
                          </span>
                          <ArrowRight size={15} />
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              ) : null}

              {siteTab === "__legacy-devices" ? (
                <div
                  id={`${selectedSite.id}-devices-panel`}
                  className="site-tab-panel"
                  role="tabpanel"
                  aria-labelledby={`${selectedSite.id}-devices-tab`}
                >
                  <section className="workspace-intro workspace-intro-subtle">
                    <div>
                      <span className="section-kicker">{t("devices")}</span>
                      <h2>{t("devicesTitle")}</h2>
                    </div>
                    <p>{t("devicesBody")}</p>
                  </section>

                  <div className="devices-workspace devices-workspace-quiet">
                    <section className="workspace-card workspace-card-muted workspace-card-compact">
                      <header className="detail-section-header">
                        <div>
                          <span className="section-kicker">{t("systemPosture")}</span>
                          <h3>{t("siteReadinessTitle")}</h3>
                        </div>
                      </header>
                      <div className="summary-grid summary-grid-flat">
                        {siteDeviceSummary.map((item) => (
                          <div key={`${selectedSite.id}-${item.label}`}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                            <small>{item.hint}</small>
                          </div>
                        ))}
                      </div>
                    </section>

                    {deviceSignals.length > 0 ? (
                      <section className="signal-dashboard" aria-label={t("deviceSignalsTitle")}>
                        {deviceSignals.map((chart) => (
                          <SignalPanel key={`${selectedSite.id}-${chart.id}`} chart={chart} />
                        ))}
                      </section>
                    ) : null}

                    <section className="workspace-card workspace-card-muted">
                      <header className="detail-section-header">
                        <div>
                          <span className="section-kicker">{t("devices")}</span>
                          <h3>{t("deviceGroupsTitle")}</h3>
                        </div>
                        <p>{t("devicesTabBody")}</p>
                      </header>
                      {siteDeviceGroups.length === 0 ? (
                        <div className="empty-state">
                          <strong>{t("noDeviceGroupsTitle")}</strong>
                          <span>{t("noDeviceGroupsBody")}</span>
                        </div>
                      ) : (
                        <div className="module-surface-list">
                          {siteDeviceGroups.map((group) => {
                            const Icon = group.id === "hvac"
                              ? ThermometerSun
                              : group.id === "storage"
                                ? BatteryCharging
                                : group.id === "chargers"
                                  ? Truck
                                  : Package;
                            return (
                              <article
                                key={`${selectedSite.id}-${group.id}`}
                                className="module-surface-row module-surface-row-quiet"
                              >
                                <div className="module-surface-main">
                                  <div className="module-surface-header">
                                    <Icon size={18} />
                                    <div>
                                      <strong>{group.name}</strong>
                                      <p>{group.status}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="module-surface-facts">
                                  <div>
                                    <span>{t("devicesSummaryLabel")}</span>
                                    <strong>{group.summary}</strong>
                                  </div>
                                  <div>
                                    <span>{t("devicesDetailLabel")}</span>
                                    <strong>{group.detail}</strong>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              ) : null}

              {siteTab === "__legacy-ems" ? (
                <div
                  id={`${selectedSite.id}-ems-panel`}
                  className="site-tab-panel"
                  role="tabpanel"
                  aria-labelledby={`${selectedSite.id}-ems-tab`}
                >
                  <section className="workspace-intro workspace-intro-subtle">
                    <div>
                      <span className="section-kicker">{t("ems")}</span>
                      <h2>{t("emsTabTitle")}</h2>
                    </div>
                    <p>{t("emsTabBody")}</p>
                  </section>

                  <EmsDashboard
                    liveState={emsLiveState}
                    viewModel={emsLiveState.model}
                    fallbackSignals={siteWorkspace.charts?.ems ?? []}
                    t={t}
                    locale={locale}
                  />

                  <section className="workspace-card workspace-card-muted">
                    <header className="detail-section-header">
                      <div>
                        <span className="section-kicker">{t("enabledModulesTitle")}</span>
                        <h3>{t("emsWorkflows")}</h3>
                      </div>
                      <p>{t("enabledModulesBody", { count: connectedWorkflowCount })}</p>
                    </header>
                    {siteModuleDetails.length === 0 ? (
                      <div className="empty-state">
                        <strong>{t("noModulesTitle")}</strong>
                        <span>{t("noModulesBody")}</span>
                      </div>
                    ) : (
                      <div className="module-surface-list">
                        {siteModuleDetails.map((module) => {
                          const Icon = module.icon;
                          return (
                            <article
                              key={`${selectedSite.id}-${module.workflow}`}
                              className="module-surface-row"
                            >
                              <div className="module-surface-main">
                                <div className="module-surface-header">
                                  <Icon size={18} />
                                  <div>
                                    <strong>{module.name}</strong>
                                    <p>{module.category}</p>
                                  </div>
                                </div>
                                <p className="module-surface-brief">{module.current}</p>
                              </div>
                              <div className="module-command-surface">
                                <div className="module-command-metrics">
                                  {(module.commandMetrics ?? []).map((metric) => (
                                    <div key={`${module.id}-${metric.key}`}>
                                      <span>{metric.label}</span>
                                      <strong>{metric.value}</strong>
                                    </div>
                                  ))}
                                </div>
                                <div className="module-command-footer">
                                  <span>
                                    <small>{t("nextActionLabel")}</small>
                                    <strong>{module.action}</strong>
                                  </span>
                                  <span>
                                    <small>{t("riskLabel")}</small>
                                    <strong>{module.risk}</strong>
                                  </span>
                                  <span>
                                    <small>{t("assignedOwner")}</small>
                                    <strong>{module.owner}</strong>
                                  </span>
                                  <span>
                                    <small>{t("updateCadence")}</small>
                                    <strong>{module.cadence}</strong>
                                  </span>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              ) : null}

              {siteTab === "realtime" ? (
                <div
                  id={`${selectedSite.id}-realtime-panel`}
                  className="site-tab-panel"
                  role="tabpanel"
                  aria-labelledby={`${selectedSite.id}-realtime-tab`}
                >
            <RealtimeSiteDashboard
              selectedSite={selectedSite}
              liveState={emsLiveState}
              viewModel={emsLiveState.model}
              fallbackSignals={siteWorkspace.charts?.ems ?? []}
              siteAlerts={siteAlerts}
              t={t}
              locale={locale}
              rangeKey={emsRangeKey}
              onRangeChange={setEmsRangeKey}
            />
                </div>
              ) : null}

              {siteTab === "reports" ? (
                <div
                  id={`${selectedSite.id}-reports-panel`}
                  className="site-tab-panel"
                  role="tabpanel"
                  aria-labelledby={`${selectedSite.id}-reports-tab`}
                >
                  <div className="reports-workspace reports-workspace-table">
                    {siteReports.length === 0 ? (
                      <div className="empty-state">
                        <strong>{t("noReportsTitle")}</strong>
                        <span>{t("noReportsBody")}</span>
                      </div>
                    ) : (
                      <section className="reports-table-shell" aria-label={t("siteReports")}>
                        <header className="reports-toolbar">
                          <div>
                            <span className="section-kicker">{t("reports")}</span>
                            <h2>{t("reportsTableTitle")}</h2>
                            <p>{t("reportsTableCount", { count: filteredSiteReports.length })}</p>
                          </div>
                          <div className="reports-filter-controls">
                            <label className="report-search-field">
                              <Search size={16} aria-hidden="true" />
                              <span className="sr-only">{t("searchReports")}</span>
                              <input
                                type="search"
                                value={reportSearch}
                                placeholder={t("searchReports")}
                                onChange={(event) => setReportSearch(event.target.value)}
                              />
                            </label>
                            <div className="report-filter-group" aria-label={t("reportFrequencyFilter")}>
                              {reportFilterOptions.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={reportCadenceFilter === option.id ? "is-active" : ""}
                                  onClick={() => setReportCadenceFilter(option.id)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </header>

                        {filteredSiteReports.length === 0 ? (
                          <div className="empty-state">
                            <strong>{t("noFilteredReportsTitle")}</strong>
                            <span>{t("noFilteredReportsBody")}</span>
                          </div>
                        ) : (
                          <div className="reports-table" role="table" aria-label={t("siteReports")}>
                            <div className="reports-table-row reports-table-head" role="row">
                              <span role="columnheader">{t("reportNameColumn")}</span>
                              <span role="columnheader">{t("reportCadenceColumn")}</span>
                              <span role="columnheader">{t("reportStatusColumn")}</span>
                              <span role="columnheader">{t("reportDecisionColumn")}</span>
                              <span role="columnheader">{t("reportActionsColumn")}</span>
                            </div>
                            {filteredSiteReports.map((report) => (
                              <article
                                key={report.id}
                                className={`reports-table-row ${activeReport?.id === report.id ? "is-active" : ""}`}
                                role="row"
                              >
                                <div className="report-title-cell" role="cell">
                                  <strong>{report.title}</strong>
                                  <small>{report.preview}</small>
                                </div>
                                <div role="cell">
                                  <strong>{report.cadence}</strong>
                                  <small>{report.category}</small>
                                </div>
                                <div role="cell">
                                  <span className={`report-state ${report.statusKey}`}>{report.status}</span>
                                  <small>{t("updated")} {report.updated}</small>
                                </div>
                                <div role="cell">
                                  <strong>{report.decisionCue}</strong>
                                  <small>{report.fileName}</small>
                                </div>
                                <div className="reports-table-actions" role="cell">
                                  <button
                                    type="button"
                                    className="panel-link"
                                    onClick={() => setSelectedReportId(activeReport?.id === report.id ? null : report.id)}
                                  >
                                    {activeReport?.id === report.id ? t("hidePreview") : t("previewReport")}
                                  </button>
                                  <button
                                    type="button"
                                    className="panel-link"
                                    onClick={() => announce(t("downloadQueued", { name: report.fileName }))}
                                  >
                                    {t("downloadReport")}
                                  </button>
                                </div>
                                {activeReport?.id === report.id ? (
                                  <div className="report-table-preview" role="cell">
                                    <div>
                                      <span>{t("reportPreviewTitle")}</span>
                                      <p>{report.summary}</p>
                                    </div>
                                    <ul>
                                      {report.includes.map((item) => (
                                        <li key={`${report.id}-${item}`}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    )}
                  </div>
                </div>
              ) : null}

              {siteTab === "__legacy-alerts" ? (
                <div
                  id={`${selectedSite.id}-alerts-panel`}
                  className="site-tab-panel"
                  role="tabpanel"
                  aria-labelledby={`${selectedSite.id}-alerts-tab`}
                >
                  <section className="alerts-summary-panel">
                    <div>
                      <span className="section-kicker">{t("alerts")}</span>
                      <h2>{t("alertsTabTitle")}</h2>
                      <p>{t("alertsTabBody")}</p>
                    </div>
                    <div className="alerts-metric-strip" aria-label={t("alertMetricsLabel")}>
                      {alertSummaryMetrics.map((metric) => (
                        <article key={metric.id} className={`alert-metric ${metric.tone}`}>
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="workspace-card workspace-card-muted alerts-queue-card">
                    <header className="detail-section-header">
                      <div>
                        <span className="section-kicker">{t("alertQueueLabel")}</span>
                        <h3>{t("alertQueueTitle")}</h3>
                      </div>
                      <p>{t("alertQueueBody")}</p>
                    </header>
                    {siteAlerts.length === 0 ? (
                      <div className="empty-state">
                        <strong>{t("noAlertsTitle")}</strong>
                        <span>{t("noAlertsBody")}</span>
                      </div>
                    ) : (
                      <div className="alert-list">
                        {siteAlerts.map((alert) => (
                          <article key={alert.id} className="alert-row">
                            <div className="alert-row-head">
                              <span className={`status-label ${alert.severity}`}>{alert.status}</span>
                            </div>
                            <div className="alert-row-copy">
                              <strong>{alert.title}</strong>
                              <span>{alert.id} · {alert.module}</span>
                            </div>
                            <div className="alert-row-detail">
                              <span>{t("assignedOwner")}</span>
                              <strong>{alert.owner}</strong>
                            </div>
                            <div className="alert-row-detail">
                              <span>{t("openedAgoLabel")}</span>
                              <strong>{alert.openedAgo}</strong>
                            </div>
                            <div className="alert-row-detail alert-row-due">
                              <span>{t("dueWindowLabel")}</span>
                              <strong>{alert.dueWindow}</strong>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              ) : null}

              {siteTab === "contact" ? (
                <div
                  id={`${selectedSite.id}-site-panel`}
                  className="site-tab-panel"
                  role="tabpanel"
                  aria-labelledby={`${selectedSite.id}-site-tab`}
                >
                  {siteProfile ? (
                    <div className="site-profile-grid">
                      <section className="workspace-card workspace-card-muted">
                        <header className="detail-section-header">
                          <div>
                    <span className="section-kicker">{t("contactTab")}</span>
                            <h3>{t("siteInformationTitle")}</h3>
                          </div>
                        </header>
                        <div className="maintenance-grid">
                          <div>
                            <span>{t("siteCode")}</span>
                            <strong>{siteProfile.code}</strong>
                          </div>
                          <div>
                            <span>{t("locationLabel")}</span>
                            <strong>{siteProfile.location}</strong>
                          </div>
                          <div>
                            <span>{t("onlineDevices")}</span>
                            <strong>{siteProfile.onlineDevices}</strong>
                          </div>
                          <div>
                            <span>{t("siteType")}</span>
                            <strong>{siteProfile.siteType}</strong>
                          </div>
                          <div>
                            <span>{t("emsWorkflows")}</span>
                            <strong>{siteProfile.workflowCount}</strong>
                          </div>
                        </div>
                      </section>

                      <section className="workspace-card workspace-card-muted">
                        <header className="detail-section-header">
                          <div>
                            <span className="section-kicker">{t("assignedOwner")}</span>
                            <h3>{siteProfile.owner}</h3>
                          </div>
                        </header>
                        <div className="site-owner-profile">
                          <div>
                            <span>{t("ownerTeam")}</span>
                            <strong>{siteProfile.ownerTeam}</strong>
                          </div>
                          <div>
                            <span>{t("locationLabel")}</span>
                            <strong>{siteProfile.location}</strong>
                          </div>
                          <div>
                            <span>{t("lastUpdate")}</span>
                            <strong>{siteWorkspace.overview.meta.updatedAt}</strong>
                          </div>
                        </div>
                        <p>{siteProfile.note}</p>
                      </section>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          </section>
        ) : null}
      </main>
      {activeAgentCrewContext && isAgentCrewOpen ? (
        <AgentCrewDrawer
          siteContext={activeAgentCrewContext}
          onClose={() => setIsAgentCrewOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default App;
