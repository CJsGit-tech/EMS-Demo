# EMS-Demo

## Overview

`EMS-Demo` is a microgrid-oriented platform concept organized as **3 PoC-level applications** on top of **1 shared platform**.

The current product direction is to avoid:
- one oversized system that mixes every workflow together
- too many fragmented applications too early

Instead, the project is structured around three operating domains that can be demonstrated as PoC applications and later unified into a fuller local MVP platform.

## Platform Direction

The long-term platform is expected to provide shared foundations for:
- identity and permissions
- sites, projects, devices, customers, and asset master data
- workflow and event contracts
- reporting and document services
- ERP, EMS, and IoT integration infrastructure

The applications below should be treated as separate product surfaces built on top of that common layer, not as isolated systems.

## Applications

### 1. Internal Operations App

Serves the internal management and backoffice side of the business.

Primary responsibilities:
- 工務管理系統
- 工務管理與 ERP 對接
- Server 管理及內部資料優化
- 報表、單據、文件產生自動化

What it serves:
- internal administration
- operational control and approvals
- document and reporting workflows
- ERP-facing data handling

### 2. Site + Integration App

Serves field execution, site operations, and cross-system integration.

Primary responsibilities:
- 工地管理
- EMS 整合平台入口
- 工地管理與 EMS 銜接
- IoT 與後端軟硬體及團隊整合

What it serves:
- site and field workflows
- device onboarding and telemetry intake
- site-to-EMS handoff
- coordination between field teams, hardware, and backend systems

### 3. Energy Operations App

Serves EMS decision-making, optimization, and energy-resource operations.

Primary responsibilities:
- 發電預測與優化
- 用電預測與優化
- 售電預測與管理
- 雙向充電樁商業模式管理預測
- 移動式雙向充電樁
- 能源資源商品化庫存管理

What it serves:
- forecasting and optimization
- dispatch and energy operations
- V2G and charging-related business logic
- energy asset and resource management

## Scope Guidance

The current project direction treats the following as **modules or platform capabilities**, not standalone applications yet:
- ERP connectors
- reporting and document automation
- server management
- site-to-EMS handoff workflows
- individual prediction domains split into separate apps
- V2G business-mode management as its own product
- energy resource inventory management as its own product

## Design Records

Finalized product and architecture decisions are documented under [`design/`](./design/).

Repository-level conventions for documenting finalized decisions are defined in [`AGENTS.md`](./AGENTS.md).
