# PoC Application Decision

- Timestamp: `2026-06-30 22:33:23` Asia/Taipei
- Topic: `PoC application boundaries for microgrid platform`

## Final Decision

Build **3 PoC-level applications** on top of **1 shared platform**.

## Applications

### 1. Internal Operations App

Covers:
- 工務管理系統
- 工務管理與 ERP 對接
- Server 管理及內部資料優化
- 報表、單據、文件產生自動化

Purpose:
- Internal management and backoffice workflows
- Master data and administrative control
- ERP-facing operational data handling
- Reports, forms, and document automation

### 2. Site + Integration App

Covers:
- 工地管理
- EMS 整合平台入口
- 工地管理與 EMS 銜接
- IoT 與後端軟硬體及團隊整合

Purpose:
- Site operations and field execution
- Device onboarding and field data collection
- Site-to-EMS operational handoff
- Integration of hardware, backend services, and field workflows

### 3. Energy Operations App

Covers:
- 發電預測與優化
- 用電預測與優化
- 售電預測與管理
- 雙向充電樁商業模式管理預測
- 移動式雙向充電樁
- 能源資源商品化庫存管理

Purpose:
- EMS operations and energy decision-making
- Forecasting and optimization
- Dispatch and V2G-related logic
- Energy asset and resource business management

## Why 3 Applications

- `1-2` applications would be too compressed and would mix backoffice, field operations, and energy logic into oversized products.
- `4+` applications would fragment the PoC too early and introduce unnecessary coordination, deployment, permissions, and integration overhead.
- `3` applications preserve clear operational boundaries while still supporting a practical path to a local MVP.

## Shared Platform Expectation

These applications should not be built as isolated systems. They should share a platform layer for:
- identity and permissions
- sites, projects, devices, customers, and asset master data
- workflow and event contracts
- reporting and document services
- ERP / EMS / IoT integration infrastructure

## What Should Not Be Standalone Applications Yet

- ERP connector
- Reporting / document automation
- Server management
- Site-to-EMS handoff
- Individual forecasting domains split into separate apps
- V2G business-mode management as its own app
- Energy resource inventory management as its own app

## Architectural Boundary Rule

ERP and IoT integration must be isolated behind stable interfaces so customer-specific mappings and device-specific logic do not leak into core operations or EMS domain logic.

## Review Trigger

Revisit the `3 application` decision only if IoT / edge integration develops:
- a distinct end-user group
- a separate operational workflow
- an independent budget owner
- a credible standalone product surface

If those conditions become true, a future split to `4 applications` may be justified.
