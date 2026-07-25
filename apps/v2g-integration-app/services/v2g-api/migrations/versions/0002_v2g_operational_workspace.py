"""Persist deterministic operational-analysis simulator data.

Revision ID: 0002_v2g_operational_workspace
Revises: 0001_v2g_scada_foundation
Create Date: 2026-07-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_v2g_operational_workspace"
down_revision = "0001_v2g_scada_foundation"
branch_labels = None
depends_on = None


json_document = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "inverter_readings",
        sa.Column("inverter_id", sa.String(length=128), primary_key=True),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column("ac_power_kw", sa.Numeric(18, 6), nullable=False),
        sa.Column("dc_power_kw", sa.Numeric(18, 6), nullable=False),
        sa.Column("temperature_c", sa.Numeric(18, 6), nullable=False),
        sa.Column("efficiency_percent", sa.Numeric(18, 6), nullable=False),
        sa.Column("communication_state", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="simulated"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_inverter_readings_site_id", "inverter_readings", ["site_id"])
    op.create_index("ix_inverter_readings_site_occurred_at", "inverter_readings", ["site_id", "occurred_at"])

    op.create_table(
        "string_readings",
        sa.Column("string_reading_id", sa.Integer(), primary_key=True),
        sa.Column(
            "inverter_id",
            sa.String(length=128),
            sa.ForeignKey("inverter_readings.inverter_id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column("string_id", sa.String(length=128), nullable=False),
        sa.Column("dc_power_kw", sa.Numeric(18, 6), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="simulated"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_string_readings_inverter_occurred_at", "string_readings", ["inverter_id", "occurred_at"])
    op.create_index("ix_string_readings_site_occurred_at", "string_readings", ["site_id", "occurred_at"])

    op.create_table(
        "work_orders",
        sa.Column("work_order_id", sa.String(length=128), primary_key=True),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column(
            "asset_id",
            sa.String(length=128),
            sa.ForeignKey("evses.asset_id", ondelete="RESTRICT"),
        ),
        sa.Column("source_alarm_code", sa.String(length=128)),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("assigned_team", sa.String(length=128), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_work_orders_site_id", "work_orders", ["site_id"])
    op.create_index("ix_work_orders_site_created_at", "work_orders", ["site_id", "created_at"])
    op.create_index("ix_work_orders_asset_created_at", "work_orders", ["asset_id", "created_at"])

    op.create_table(
        "work_order_events",
        sa.Column("work_order_event_id", sa.Integer(), primary_key=True),
        sa.Column(
            "work_order_id",
            sa.String(length=128),
            sa.ForeignKey("work_orders.work_order_id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("payload", json_document, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_work_order_events_work_order_occurred_at",
        "work_order_events",
        ["work_order_id", "occurred_at"],
    )

    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """
            CREATE FUNCTION prevent_work_order_event_mutation() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'work_order_events are append-only';
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute(
            """
            CREATE TRIGGER work_order_events_append_only
            BEFORE UPDATE OR DELETE ON work_order_events
            FOR EACH ROW EXECUTE FUNCTION prevent_work_order_event_mutation();
            """
        )
        op.execute(
            """
            CREATE TRIGGER work_order_events_prevent_truncate
            BEFORE TRUNCATE ON work_order_events
            FOR EACH STATEMENT EXECUTE FUNCTION prevent_work_order_event_mutation();
            """
        )
        op.execute("REVOKE ALL ON TABLE audit_records, work_order_events FROM v2g_runtime")
        op.execute(
            "REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_records, work_order_events FROM v2g_runtime"
        )
        op.execute("GRANT SELECT, INSERT ON TABLE audit_records, work_order_events TO v2g_runtime")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("REVOKE ALL ON TABLE work_order_events FROM v2g_runtime")
        op.execute("DROP TRIGGER IF EXISTS work_order_events_prevent_truncate ON work_order_events")
        op.execute("DROP TRIGGER IF EXISTS work_order_events_append_only ON work_order_events")
        op.execute("DROP FUNCTION IF EXISTS prevent_work_order_event_mutation()")

    op.drop_index("ix_work_order_events_work_order_occurred_at", table_name="work_order_events")
    op.drop_table("work_order_events")
    op.drop_index("ix_work_orders_asset_created_at", table_name="work_orders")
    op.drop_index("ix_work_orders_site_created_at", table_name="work_orders")
    op.drop_index("ix_work_orders_site_id", table_name="work_orders")
    op.drop_table("work_orders")
    op.drop_index("ix_string_readings_site_occurred_at", table_name="string_readings")
    op.drop_index("ix_string_readings_inverter_occurred_at", table_name="string_readings")
    op.drop_table("string_readings")
    op.drop_index("ix_inverter_readings_site_occurred_at", table_name="inverter_readings")
    op.drop_index("ix_inverter_readings_site_id", table_name="inverter_readings")
    op.drop_table("inverter_readings")
