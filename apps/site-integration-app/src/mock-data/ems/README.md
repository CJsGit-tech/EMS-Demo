# EMS Mock Data

Dedicated fake data package for later site-detail integration.

## Purpose

This folder defines a site-detail EMS data contract that leans toward operational decision support rather than SCADA-style telemetry walls.

It is designed to support the current product direction in [REQUEST.md](/Users/chuang/Desktop/projects/EMS/EMS-Demo/REQUEST.md):

- site-first operational judgment
- bilingual labels and narratives
- EMS modules with current posture, forecast, risk, and next action
- report-ready daily / weekly / settlement flows

## Files

- [site-detail.schema.json](/Users/chuang/Desktop/projects/EMS/EMS-Demo/apps/site-integration-app/src/mock-data/ems/site-detail.schema.json)
  Defines the fake-data schema for one site workspace.
- [site-detail-workspaces.json](/Users/chuang/Desktop/projects/EMS/EMS-Demo/apps/site-integration-app/src/mock-data/ems/site-detail-workspaces.json)
  Seed mock records for three site states: healthy, watch, and critical.
- [visualization-presets.json](/Users/chuang/Desktop/projects/EMS/EMS-Demo/apps/site-integration-app/src/mock-data/ems/visualization-presets.json)
  Reusable chart and surface definitions for Overview, Devices, EMS, and Reports tabs.

## What Data Should Be Included

Each site workspace should include these sections:

1. `site`
   Core identity, location, timezone, site type, owner, and status.
2. `summary`
   The operator-facing headline, posture, next action, and unresolved alarm count.
3. `energyProfile`
   The cross-cutting site metrics that belong above individual modules.
4. `assets`
   Physical and commercial resource posture for HVAC, storage, PV, chargers, mobile chargers, and inventory.
5. `modules`
   EMS decision-support workflows with current, forecast, risk, and recommended action.
6. `alerts`
   Open issues with severity, owner, due window, and workflow linkage.
7. `reports`
   Daily / Weekly / Settlement artifacts with purpose, status, and content summary.
8. `visualizations`
   References to chart surfaces and compact metric tiles used by the detail page.

## Standard Metrics To Include

These are the core metrics worth standardizing across the fake data model.

### Site Energy / Building Posture

- `siteEuiKbtuFt2Yr`
  English: Site energy use intensity
  中文: 場址能源使用強度
- `sourceEuiKbtuFt2Yr`
  English: Source energy use intensity
  中文: 源頭能源使用強度
- `annualEmissionsTco2e`
  English: Annual greenhouse gas emissions
  中文: 年度溫室氣體排放量
- `avoidedEmissionsTco2e`
  English: Avoided emissions from green power / optimization
  中文: 綠電或優化帶來的避免排放量

### Load / Consumption

- `actualDemandKw`
- `forecastDemandKw`
- `peakDemandKw`
- `peakWindow`
- `loadFactorPct`
- `demandResponseReady`

### Generation

- `actualGenerationKw`
- `forecastGenerationKw`
- `forecastConfidencePct`
- `capacityFactorPct`
- `curtailmentRiskLevel`

### Storage / Reserve

- `stateOfChargePct`
- `stateOfHealthPct`
- `availablePowerKw`
- `availableEnergyKwh`
- `reserveMarginPct`
- `roundTripEfficiencyPct`
- `cycles30d`

### Bidirectional Chargers / Fleet

- `activeChargers`
- `connectedFleetCount`
- `v2gAvailableKw`
- `utilizationPct`
- `businessModeRecommendation`

### Commercial / Sell Power / Inventory

- `exportCommittedKw`
- `exportAvailableKw`
- `expectedRevenueUsd`
- `nominationStatus`
- `settlementStatus`
- `tradableInventoryMwh`
- `reservedInventoryMwh`
- `releaseThresholdMwh`

### Forecast Quality

- `forecastErrorPct`
- `forecastBiasPct`
- `confidencePct`

These should stay subordinate to operational decisions. They help explain whether a recommendation is trustworthy, but they should not dominate the UI.

## Visualizations That Should Be Included

The detail page does not need a control-room wall. It needs a small set of purposeful visual surfaces.

### Required

1. `24h actual vs forecast line`
   Use for demand and generation.
2. `SOC and reserve band line / area`
   Use for battery and charger reserve posture.
3. `planned vs available bar`
   Use for export commitment, mobile charger support, or inventory release.
4. `alarm severity list`
   Use as a compact operator backlog, not a chart.
5. `report list with status`
   Use for Daily / Weekly / Settlement or Review.

### Recommended

1. `module posture strip`
   A compact status rail showing each active EMS module.
2. `forecast confidence sparkline`
   Small historical confidence trend for modules with forecast-driven decisions.
3. `weekly variance bar`
   Helpful in reports for forecast drift or settlement deviation.

### Avoid

- dense telemetry tables
- real-time oscilloscopes
- large gauge collections
- duplicated portfolio metrics inside a site page

## Why These Metrics

The metric set is anchored by a few durable external references:

- ENERGY STAR defines EUI as a key building metric, available in both site and source forms, and explains that source energy includes transmission, delivery, and production losses.
  Source: [What is Energy Use Intensity (EUI)?](https://www.energystar.gov/buildings/benchmark/understand-metrics/what-eui)
  Source: [The Difference Between Source and Site Energy](https://www.energystar.gov/buildings/benchmark/understand-metrics/source-site-difference)
- ENERGY STAR also treats emissions as a standard building-performance output and tracks direct fuel plus purchased electricity / district energy impacts.
  Source: [How Portfolio Manager Calculates Emissions](https://www.energystar.gov/buildings/benchmark/understand-metrics/how)
- Battery and storage operations commonly rely on state of charge, state of health, and round-trip efficiency as core operating descriptors.
  Source: [Relax, Estimate, and Track: a Simple Battery State-of-charge and State-of-health Estimation Method](https://arxiv.org/abs/2408.01127)
  Source: [Round-Trip Energy Efficiency and Energy-Efficiency Fade Estimation for Battery Passport](https://arxiv.org/abs/2308.15828)

## Integration Notes

- Keep numeric fields machine-friendly in the JSON payload.
- Keep user-facing copy bilingual where the UI may render directly from mock data.
- Prefer one detailed workspace record per site.
- If this data is later imported into React, keep visualization presets separate from the raw site records so the UI can swap layouts without mutating the payload.
