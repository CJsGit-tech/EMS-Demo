"""Async EMS repository interfaces plus deterministic demo implementation."""

import asyncio
import math
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol
from weakref import WeakKeyDictionary

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from agentcrew.config import settings
from .models import Asset, AssetChannel, CanonicalObservation, DerivedMetricValue, Site


class EmsRepositoryProtocol(Protocol):
    async def get_site(self, site_code: str) -> dict[str, Any] | None: ...
    async def list_assets(self, site_code: str) -> list[dict[str, Any]]: ...
    async def query_observations(self, site_code: str, query: dict[str, Any]) -> list[dict[str, Any]]: ...
    async def query_derived_metrics(self, site_code: str, query: dict[str, Any]) -> list[dict[str, Any]]: ...
    async def quality_summary(self, site_code: str) -> dict[str, Any]: ...


class EmsRepository:
    def __init__(self, session_factory) -> None:
        self.session_factory = session_factory
        # Asyncio synchronization primitives are loop-bound. Keep one gate per
        # loop so TestClient and MCP callers cannot share a semaphore across
        # loops, while each loop still has a bounded database concurrency cap.
        self._loop_semaphores: WeakKeyDictionary[Any, asyncio.Semaphore] = WeakKeyDictionary()

    @asynccontextmanager
    async def _session(self):
        loop = asyncio.get_running_loop()
        semaphore = self._loop_semaphores.get(loop)
        if semaphore is None:
            semaphore = asyncio.Semaphore(max(1, settings.db_pool_size))
            self._loop_semaphores[loop] = semaphore
        async with semaphore:
            async with self.session_factory() as session:
                yield session

    async def get_site(self, site_code: str) -> dict[str, Any] | None:
        async with self._session() as session:
            row = (await session.execute(select(Site).where(Site.external_site_code == site_code))).scalar_one_or_none()
            if row is None:
                return None
            return {"site_id": site_code, "site_name": row.site_name, "timezone": row.timezone, "capacity_kwp": float(row.capacity_kwp) if row.capacity_kwp is not None else None}

    async def list_assets(self, site_code: str) -> list[dict[str, Any]]:
        async with self._session() as session:
            rows = (await session.execute(select(Asset).join(Site, Asset.site_id == Site.site_id).where(Site.external_site_code == site_code))).scalars()
            return [{"asset_id": str(row.external_asset_code), "asset_type": row.asset_type, "asset_name": row.asset_name, "rated_capacity_kw": float(row.rated_capacity_kw) if row.rated_capacity_kw is not None else None} for row in rows]

    async def query_observations(self, site_code: str, query: dict[str, Any]) -> list[dict[str, Any]]:
        async with self._session() as session:
            statement = select(CanonicalObservation, Asset.external_asset_code, AssetChannel.channel_code).join(Site, CanonicalObservation.site_id == Site.site_id).outerjoin(Asset, and_(CanonicalObservation.asset_id == Asset.asset_id, CanonicalObservation.site_id == Asset.site_id)).outerjoin(AssetChannel, and_(CanonicalObservation.channel_id == AssetChannel.channel_id, CanonicalObservation.asset_id == AssetChannel.asset_id, CanonicalObservation.site_id == AssetChannel.site_id)).where(Site.external_site_code == site_code)
            if query.get("from") is not None: statement = statement.where(CanonicalObservation.event_time >= query["from"])
            if query.get("to") is not None: statement = statement.where(CanonicalObservation.event_time < query["to"])
            if query.get("metric_codes"): statement = statement.where(CanonicalObservation.metric_code.in_(query["metric_codes"]))
            if not query.get("include_degraded"): statement = statement.where(CanonicalObservation.quality_state == "valid")
            rows = (await session.execute(statement.order_by(CanonicalObservation.event_time, CanonicalObservation.metric_code, CanonicalObservation.observation_id).limit(query.get("limit", 100)))).all()
            return [_observation_dict(row[0], site_code, row[1], row[2]) for row in rows]

    async def query_derived_metrics(self, site_code: str, query: dict[str, Any]) -> list[dict[str, Any]]:
        async with self._session() as session:
            statement = select(DerivedMetricValue, Asset.external_asset_code).join(Site, DerivedMetricValue.site_id == Site.site_id).outerjoin(Asset, and_(DerivedMetricValue.asset_id == Asset.asset_id, DerivedMetricValue.site_id == Asset.site_id)).where(Site.external_site_code == site_code)
            if query.get("from") is not None: statement = statement.where(DerivedMetricValue.period_start >= query["from"])
            if query.get("to") is not None: statement = statement.where(DerivedMetricValue.period_end <= query["to"])
            if query.get("metric_codes"): statement = statement.where(DerivedMetricValue.metric_code.in_(query["metric_codes"]))
            rows = (await session.execute(statement.order_by(DerivedMetricValue.period_start, DerivedMetricValue.formula_version.desc()).limit(query.get("limit", 1000)))).all()
            records = []
            seen_periods = set()
            for row in rows:
                period_key = (row[0].metric_code, row[0].period_start)
                if period_key in seen_periods:
                    continue
                seen_periods.add(period_key)
                records.append(_derived_dict(row[0], site_code, row[1]))
            return records[:query.get("limit", 100)]

    async def quality_summary(self, site_code: str) -> dict[str, Any]:
        return {"site_id": site_code, "state": "valid", "score": 1.0, "flags": [], "freshness_at": datetime.now(timezone.utc).isoformat()}


def _observation_dict(row: CanonicalObservation, site_code: str, asset_code: str | None, channel_code: str | None) -> dict[str, Any]:
    return {"site_id": site_code, "asset_id": asset_code, "channel_id": channel_code, "timestamp": row.event_time.isoformat(), "metric": row.metric_code, "value": float(row.value_numeric) if row.value_numeric is not None else row.value_text, "unit": row.unit_code, "quality": {"state": row.quality_state, "score": float(row.quality_score) if row.quality_score is not None else None}}


def _derived_dict(row: DerivedMetricValue, site_code: str, asset_code: str | None) -> dict[str, Any]:
    return {"site_id": site_code, "asset_id": asset_code, "metric": row.metric_code, "period_start": row.period_start.isoformat(), "period_end": row.period_end.isoformat(), "value": float(row.value_numeric) if row.value_numeric is not None else None, "unit": row.unit_code, "quality": {"state": row.quality_state}, "formula_version": row.formula_version, "dependencies": row.dependency_metric_codes, "calculated_at": row.calculated_at.isoformat()}


class InMemoryEmsRepository:
    """Deterministic fixture repository with the same read contract as Postgres."""

    def __init__(self) -> None:
        self.sites = {
            "site-001": {"site_id": "site-001", "site_name": "Verde North", "timezone": "Asia/Taipei", "capacity_kwp": 4200.0},
            "site-002": {"site_id": "site-002", "site_name": "Verde South", "timezone": "Asia/Taipei", "capacity_kwp": 3100.0},
        }
        self.assets = {
            "site-001": [{"asset_id": "inv-001", "asset_type": "inverter", "asset_name": "Inverter 01", "rated_capacity_kw": 1000.0}, {"asset_id": "weather-001", "asset_type": "weather_device", "asset_name": "Weather Station 01", "rated_capacity_kw": None}],
            "site-002": [{"asset_id": "inv-101", "asset_type": "inverter", "asset_name": "Inverter 101", "rated_capacity_kw": 1000.0}, {"asset_id": "weather-101", "asset_type": "weather_device", "asset_name": "Weather Station 101", "rated_capacity_kw": None}],
        }
        self.observations = {site: _fake_observations(site) for site in self.sites}
        self.derived = {site: _fake_derived(site) for site in self.sites}

    async def get_site(self, site_code: str): return self.sites.get(site_code)
    async def list_assets(self, site_code: str): return list(self.assets.get(site_code, []))
    async def query_observations(self, site_code: str, query: dict[str, Any]): return _filter_time(self.observations.get(site_code, []), query, "timestamp")[:query.get("limit", 100)]
    async def query_derived_metrics(self, site_code: str, query: dict[str, Any]): return _filter_time(self.derived.get(site_code, []), query, "period_start")[:query.get("limit", 100)]
    async def quality_summary(self, site_code: str): return {"site_id": site_code, "state": "valid", "score": 1.0, "flags": [], "freshness_at": "2026-07-22T12:00:00+00:00"}


def _filter_time(records: list[dict[str, Any]], query: dict[str, Any], field: str) -> list[dict[str, Any]]:
    start, end = query.get("from"), query.get("to")
    metrics = set(query.get("metric_codes") or [])
    result = []
    for row in records:
        stamp = datetime.fromisoformat(row[field].replace("Z", "+00:00"))
        if start and stamp < start: continue
        if end and stamp >= end: continue
        if metrics and row.get("metric") not in metrics: continue
        if not query.get("include_degraded") and row.get("quality", {}).get("state") != "valid": continue
        result.append(row)
    return result


def _fake_observations(site: str) -> list[dict[str, Any]]:
    records = []
    for day_offset in range(365):
        timestamp = datetime(2025, 7, 23, 9, tzinfo=timezone.utc) + timedelta(days=day_offset)
        seasonal = 1 + 0.18 * math.sin((2 * math.pi * day_offset) / 365)
        site_offset = 40 if site == "site-002" else 0
        energy = round((812 + site_offset) * seasonal, 2)
        asset_id = "inv-001" if site == "site-001" else "inv-101"
        records.append({"site_id": site, "asset_id": asset_id, "timestamp": timestamp.isoformat(), "metric": "energy_kwh", "value": energy, "unit": "kWh", "quality": {"state": "valid", "score": 1.0, "flags": []}})
        records.extend([
            {"site_id": site, "asset_id": asset_id, "timestamp": timestamp.isoformat(), "metric": "ac_power_kw", "value": round(energy / 4.2, 2), "unit": "kW", "quality": {"state": "valid", "score": 1.0, "flags": []}},
            {"site_id": site, "asset_id": asset_id, "timestamp": timestamp.isoformat(), "metric": "dc_power_kw", "value": round(energy / 4.2 * 1.06, 2), "unit": "kW", "quality": {"state": "valid", "score": 1.0, "flags": []}},
        ])
        records.extend([
            {"site_id": site, "asset_id": "weather-001" if site == "site-001" else "weather-101", "timestamp": timestamp.isoformat(), "metric": "irradiance_w_m2", "value": round(720 + 150 * math.sin((2 * math.pi * day_offset) / 365) + (20 if site == "site-002" else 0), 2), "unit": "W/m2", "quality": {"state": "valid", "score": 1.0, "flags": []}},
            {"site_id": site, "asset_id": "weather-001" if site == "site-001" else "weather-101", "timestamp": timestamp.isoformat(), "metric": "temperature_c", "value": round(23 + 7 * math.sin((2 * math.pi * (day_offset + 35)) / 365), 2), "unit": "C", "quality": {"state": "valid", "score": 1.0, "flags": []}},
        ])
    return records


def _fake_derived(site: str) -> list[dict[str, Any]]:
    return [{"site_id": site, "asset_id": None, "metric": "performance_ratio", "period_start": (datetime(2025, 7, 23, tzinfo=timezone.utc) + timedelta(days=day_offset)).isoformat(), "period_end": (datetime(2025, 7, 23, tzinfo=timezone.utc) + timedelta(days=day_offset + 1)).isoformat(), "value": round(0.86 + 0.07 * math.sin((2 * math.pi * day_offset) / 365) - (0.03 if site == "site-002" else 0), 4), "unit": "ratio", "quality": {"state": "valid"}, "formula_version": "pr-v1", "dependencies": ["energy_kwh", "irradiance_w_m2"], "calculated_at": "2026-07-23T00:00:00+00:00"} for day_offset in range(365)]
