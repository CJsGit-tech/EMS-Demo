"""Deterministic synthetic EMS seed manifest."""

from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import math

from sqlalchemy import select

from .models import (
    Asset, AssetChannel, CanonicalObservation, DerivedMetricValue,
    IngestionRun, MetricDictionary, QualityEvent, Site, SourceFile,
)
from .schemas import SeedManifest


FIXED_FROM = datetime(2025, 7, 23, 0, 0, tzinfo=timezone.utc)
FIXED_TO = datetime(2026, 7, 23, 0, 0, tzinfo=timezone.utc)


async def seed_ems(session_factory=None, seed_version: int = 3) -> SeedManifest:
    day_count = (FIXED_TO - FIXED_FROM).days
    counts = {"sites": 2, "assets": 4, "asset_channels": 10, "canonical_observations": day_count * 5 * 2, "quality_events": 3, "derived_metric_values": day_count * 2}
    payload = {"seed_version": seed_version, "row_counts": counts, "from": FIXED_FROM.isoformat(), "to": FIXED_TO.isoformat()}
    manifest_hash = sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    if session_factory is not None:
        await _persist_seed(session_factory, seed_version, manifest_hash)
    return SeedManifest(seed_version=seed_version, row_counts=counts, fixed_from=FIXED_FROM, fixed_to=FIXED_TO, manifest_hash=manifest_hash)


async def _persist_seed(session_factory, seed_version: int, manifest_hash: str) -> None:
    """Insert the fixed demo profile once; the source hash is the idempotency key."""
    source_hash = f"ems-deterministic-seed-v{seed_version}-{manifest_hash}"
    source_file_id = 9000 + seed_version
    ingestion_run_id = 9100 + seed_version
    observation_id_base = seed_version * 100000
    derived_metric_id_base = seed_version * 10000
    async with session_factory() as session:
        existing = await session.scalar(select(SourceFile).where(SourceFile.file_hash == source_hash))
        if existing is not None:
            return
        now = FIXED_TO
        source = SourceFile(source_file_id=source_file_id, relative_path=f"seed/ems-v{seed_version}.json", file_hash=source_hash, source_system="deterministic-seed", parser_version="ems-seed-v2", schema_fingerprint=manifest_hash, load_status="loaded", row_count=counts["canonical_observations"], error_count=3, created_at=now)
        run = IngestionRun(ingestion_run_id=ingestion_run_id, source_file_id=source_file_id, parser_version="ems-seed-v2", status="completed", started_at=FIXED_FROM, completed_at=now, row_count=counts["canonical_observations"], accepted_count=counts["canonical_observations"], rejected_count=3)
        sites = [
            Site(site_id=1, external_site_code="site-001", site_name="Verde North", location_name="North campus", timezone="Asia/Taipei", capacity_kwp=4200, active_from=FIXED_FROM.date()),
            Site(site_id=2, external_site_code="site-002", site_name="Verde South", location_name="South campus", timezone="Asia/Taipei", capacity_kwp=3100, active_from=FIXED_FROM.date()),
        ]
        assets = [
            Asset(asset_id=101, site_id=1, external_asset_code="inv-001", asset_type="inverter", asset_name="Inverter 01", rated_capacity_kw=1000),
            Asset(asset_id=102, site_id=1, external_asset_code="weather-001", asset_type="weather_device", asset_name="Weather Station 01"),
            Asset(asset_id=201, site_id=2, external_asset_code="inv-101", asset_type="inverter", asset_name="Inverter 101", rated_capacity_kw=1000),
            Asset(asset_id=202, site_id=2, external_asset_code="weather-101", asset_type="weather_device", asset_name="Weather Station 101"),
        ]
        channels = [AssetChannel(channel_id=1001, asset_id=101, site_id=1, channel_code="ac_power_kw", channel_type="power", unit_code="kW"), AssetChannel(channel_id=1002, asset_id=101, site_id=1, channel_code="energy_kwh", channel_type="energy", unit_code="kWh"), AssetChannel(channel_id=1005, asset_id=101, site_id=1, channel_code="dc_power_kw", channel_type="power", unit_code="kW"), AssetChannel(channel_id=1003, asset_id=102, site_id=1, channel_code="irradiance_w_m2", channel_type="weather", unit_code="W/m2"), AssetChannel(channel_id=1004, asset_id=102, site_id=1, channel_code="temperature_c", channel_type="weather", unit_code="C"), AssetChannel(channel_id=2001, asset_id=201, site_id=2, channel_code="ac_power_kw", channel_type="power", unit_code="kW"), AssetChannel(channel_id=2002, asset_id=201, site_id=2, channel_code="energy_kwh", channel_type="energy", unit_code="kWh"), AssetChannel(channel_id=2005, asset_id=201, site_id=2, channel_code="dc_power_kw", channel_type="power", unit_code="kW"), AssetChannel(channel_id=2003, asset_id=202, site_id=2, channel_code="irradiance_w_m2", channel_type="weather", unit_code="W/m2"), AssetChannel(channel_id=2004, asset_id=202, site_id=2, channel_code="temperature_c", channel_type="weather", unit_code="C")]
        metrics = [
            MetricDictionary(metric_definition_id=7001, metric_code="energy_kwh", display_name_en="Energy", display_name_zh_tw="發電量", value_kind="numeric", unit_code="kWh", aggregation_rule="interval_sum", version=1),
            MetricDictionary(metric_definition_id=7002, metric_code="irradiance_w_m2", display_name_en="Irradiance", display_name_zh_tw="日照強度", value_kind="numeric", unit_code="W/m2", aggregation_rule="average", version=1),
            MetricDictionary(metric_definition_id=7003, metric_code="performance_ratio", display_name_en="Performance ratio", display_name_zh_tw="性能比", value_kind="numeric", unit_code="ratio", aggregation_rule="derived", formula_version="pr-v1", version=1),
            MetricDictionary(metric_definition_id=7004, metric_code="ac_power_kw", display_name_en="AC power", display_name_zh_tw="交流功率", value_kind="numeric", unit_code="kW", aggregation_rule="average", version=1),
            MetricDictionary(metric_definition_id=7005, metric_code="dc_power_kw", display_name_en="DC power", display_name_zh_tw="直流功率", value_kind="numeric", unit_code="kW", aggregation_rule="average", version=1),
        ]
        observations = []
        observation_id = observation_id_base
        for day_offset in range((FIXED_TO - FIXED_FROM).days):
            event_time = FIXED_FROM + timedelta(days=day_offset, hours=8)
            seasonal = 1 + 0.18 * math.sin((2 * math.pi * day_offset) / 365)
            weekly = 1 + 0.04 * math.sin((2 * math.pi * day_offset) / 7)
            for site_id, asset_id, channel_id, power_channel_id in ((1, 101, 1002, 1001), (2, 201, 2002, 2001)):
                value = round((812 + (site_id - 1) * 40) * seasonal * weekly, 2)
                observations.append(CanonicalObservation(observation_id=observation_id, site_id=site_id, asset_id=asset_id, channel_id=channel_id, event_time=event_time, metric_code="energy_kwh", value_numeric=value, unit_code="kWh", quality_state="valid", quality_score=1, source_file_id=source_file_id, ingestion_run_id=ingestion_run_id, record_hash=sha256(f"{site_id}:energy:{event_time.isoformat()}".encode()).hexdigest(), ingested_at=now))
                observation_id += 1
                ac_power = round(value / 4.2, 2)
                dc_power = round(ac_power * 1.06, 2)
                for metric_code, power_value, channel_code in (("ac_power_kw", ac_power, power_channel_id), ("dc_power_kw", dc_power, 1005 if site_id == 1 else 2005)):
                    observations.append(CanonicalObservation(observation_id=observation_id, site_id=site_id, asset_id=asset_id, channel_id=channel_code, event_time=event_time, metric_code=metric_code, value_numeric=power_value, unit_code="kW", quality_state="valid", quality_score=1, source_file_id=source_file_id, ingestion_run_id=ingestion_run_id, record_hash=sha256(f"{site_id}:{metric_code}:{event_time.isoformat()}".encode()).hexdigest(), ingested_at=now))
                    observation_id += 1
            for site_id, asset_id, channel_ids in ((1, 102, (1003, 1004)), (2, 202, (2003, 2004))):
                irradiance = round(720 + 150 * math.sin((2 * math.pi * day_offset) / 365) + 35 * math.sin((2 * math.pi * day_offset) / 30) + (site_id - 1) * 20, 2)
                temperature = round(23 + 7 * math.sin((2 * math.pi * (day_offset + 35)) / 365) + (site_id - 1) * 0.5, 2)
                for metric_code, value, unit_code, channel_id in (("irradiance_w_m2", irradiance, "W/m2", channel_ids[0]), ("temperature_c", temperature, "C", channel_ids[1])):
                    observations.append(CanonicalObservation(observation_id=observation_id, site_id=site_id, asset_id=asset_id, channel_id=channel_id, event_time=event_time, metric_code=metric_code, value_numeric=value, unit_code=unit_code, quality_state="valid", quality_score=1, source_file_id=source_file_id, ingestion_run_id=ingestion_run_id, record_hash=sha256(f"{site_id}:{metric_code}:{event_time.isoformat()}".encode()).hexdigest(), ingested_at=now))
                    observation_id += 1
        quality = [QualityEvent(quality_event_id=8000 + seed_version * 10 + i, site_id=1, rule_code=code, severity=severity, observed_value=value, threshold=threshold, resolution_state="open", created_at=now) for i, (code, severity, value, threshold) in enumerate((("stale_source", "warning", "26h", "24h"), ("duplicate_timestamp", "info", "1", "0"), ("unit_mismatch", "warning", "kWh", "kW")))]
        derived = [DerivedMetricValue(derived_metric_id=derived_metric_id_base + day_offset * 2 + site_id, site_id=site_id, metric_code="performance_ratio", period_start=FIXED_FROM + timedelta(days=day_offset), period_end=FIXED_FROM + timedelta(days=day_offset + 1), value_numeric=round(0.86 + 0.07 * math.sin((2 * math.pi * day_offset) / 365) - (site_id - 1) * 0.03, 4), unit_code="ratio", quality_state="valid", formula_version=f"pr-v{seed_version}", dependency_metric_codes=["energy_kwh", "irradiance_w_m2"], aggregation_rule="derived", source_window_hash=manifest_hash, calculated_at=now) for day_offset in range((FIXED_TO - FIXED_FROM).days) for site_id in (1, 2)]
        session.add(source)
        await session.flush()
        session.add(run)
        await session.flush()
        for row in sites + assets + channels + metrics:
            await session.merge(row)
        await session.flush()
        session.add_all(observations + quality + derived)
        await session.commit()
