# REQUEST

## 內部管理

- 工務管理系統
- 工務管理與 ERP 對接
- Server 管理及內部資料優化
- 報表、單據、文件產生自動化

## 產品對接

- 工地管理
- EMS 整合平台
- 工地管理與 EMS 銜接
- IOT 與後端軟硬體及團隊整合

## EMS

EMS scope should be defined as operational decision-support workflows, not only as telemetry or device monitoring.

### EMS Modules

#### 1. 發電預測與優化
- English: Generation Forecasting & Optimization
- Purpose: Predict site-level generation output and recommend dispatch or optimization actions.
- Operational focus: Solar output forecast, battery contribution planning, curtailment risk, weather-driven variance.
- Example demo fields: forecast generation, forecast confidence, optimized output delta, curtailment alert, weather driver.

#### 2. 用電預測與優化
- English: Consumption Forecasting & Optimization
- Purpose: Forecast site demand and improve energy usage posture before peak or abnormal periods.
- Operational focus: Load forecast, peak-demand control, HVAC impact, load-shifting readiness, savings opportunity.
- Example demo fields: demand forecast, peak window, optimized load plan, expected savings, demand response readiness.

#### 3. 售電預測與管理
- English: Sell-Power Forecasting & Management
- Purpose: Support commercial decisions on when and how much power can be sold back to the market or grid.
- Operational focus: Export commitment planning, market nomination, sell-power availability, reconciliation status.
- Example demo fields: export volume, cleared market window, expected revenue, nomination status, settlement flag.

#### 4. 雙向充電樁商業模式管理預測
- English: Bidirectional Charger Business Mode Forecasting
- Purpose: Manage bidirectional charger usage as both an operational asset and a commercial energy resource.
- Operational focus: Charger utilization, reserve margin, fleet charging/discharging posture, business mode selection.
- Example demo fields: active chargers, connected fleet count, reserve capacity, forecast utilization, business mode recommendation.

#### 5. 移動式雙向充電樁
- English: Mobile Bidirectional Chargers
- Purpose: Track and coordinate portable bidirectional charging assets across different sites or field operations.
- Operational focus: Unit assignment, redeployment priority, travel status, temporary support readiness.
- Example demo fields: mobile unit count, assigned destination, ETA, availability status, redeploy priority.

#### 6. 能源資源商品化庫存管理
- English: Energy Resource Commercial Inventory Management
- Purpose: Manage tradable or allocatable energy resources as inventory tied to site operations and commercial workflows.
- Operational focus: Available energy inventory, reserved inventory, release conditions, commercial readiness, hold reasons.
- Example demo fields: available inventory, reserved inventory, tradable status, release threshold, commercial hold reason.

### EMS Platform Thinking

- Chinese: EMS 不應只呈現設備狀態，而應協助營運管理者做出下一步判斷。
- English: EMS should not only show device status; it should help operations managers make the next decision.

- Chinese: 每個模組都應同時具備「現況」、「預測」、「風險」、「建議動作」。
- English: Each module should include current posture, forecast, risk, and recommended action.

- Chinese: 站點頁面應聚焦站點層級的營運判斷，而不是投資組合層級的資訊重複堆疊。
- English: The site page should focus on site-level operational judgment, not repeat portfolio-level information.

- Chinese: 報告應分成 Daily / Weekly / Settlement 或 Review 類型，讓管理者快速理解用途。
- English: Reports should be grouped into Daily, Weekly, Settlement, or Review types so managers can immediately understand their purpose.

### Recommended Fake Data Direction

- Chinese: 假資料應偏向營運決策資料，不要偏向 SCADA 式即時數值牆。
- English: Mock data should lean toward operational decision data, not SCADA-style real-time number walls.

- Chinese: 每個站點可配置 4 到 6 個 EMS 模組狀態、1 到 3 份報告、0 到 5 個未結警報、1 個主要負責人、1 個下一步建議動作。
- English: Each site can carry 4 to 6 EMS module states, 1 to 3 reports, 0 to 5 open alarms, 1 primary owner, and 1 next recommended action.
