"""Create the V2G historian and append-only command audit schema.

Revision ID: 0001_v2g_scada_foundation
Revises:
Create Date: 2026-07-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_v2g_scada_foundation"
down_revision = None
branch_labels = None
depends_on = None


json_document = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "evses",
        sa.Column("asset_id", sa.String(length=128), primary_key=True),
        sa.Column("site_id", sa.String(length=128), nullable=False, index=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="available"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "telemetry_points",
        sa.Column("telemetry_id", sa.Integer(), primary_key=True),
        sa.Column("asset_id", sa.String(length=128), sa.ForeignKey("evses.asset_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column("metric", sa.String(length=128), nullable=False),
        sa.Column("value", sa.Numeric(18, 6), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("quality", sa.String(length=32), nullable=False, server_default="good"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_telemetry_points_asset_occurred_at", "telemetry_points", ["asset_id", "occurred_at"])
    op.create_index("ix_telemetry_points_site_occurred_at", "telemetry_points", ["site_id", "occurred_at"])
    op.create_table(
        "charging_sessions",
        sa.Column("session_id", sa.String(length=128), primary_key=True),
        sa.Column("asset_id", sa.String(length=128), sa.ForeignKey("evses.asset_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("energy_imported_kwh", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("energy_exported_kwh", sa.Numeric(18, 6), nullable=False, server_default="0"),
    )
    op.create_index("ix_charging_sessions_asset_started_at", "charging_sessions", ["asset_id", "started_at"])
    op.create_table(
        "alarms",
        sa.Column("alarm_id", sa.Integer(), primary_key=True),
        sa.Column("asset_id", sa.String(length=128), sa.ForeignKey("evses.asset_id", ondelete="RESTRICT")),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column("code", sa.String(length=128), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("raised_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cleared_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_alarms_state_severity", "alarms", ["state", "severity"])
    op.create_index("ix_alarms_asset_raised_at", "alarms", ["asset_id", "raised_at"])
    op.create_table(
        "dispatch_recommendations",
        sa.Column("recommendation_id", sa.String(length=128), primary_key=True),
        sa.Column("asset_id", sa.String(length=128), sa.ForeignKey("evses.asset_id", ondelete="RESTRICT")),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="proposed"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", json_document, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dispatch_recommendations_site_expires_at", "dispatch_recommendations", ["site_id", "expires_at"])
    op.create_index("ix_dispatch_recommendations_asset_created_at", "dispatch_recommendations", ["asset_id", "created_at"])
    op.create_table(
        "simulated_commands",
        sa.Column("command_id", sa.String(length=128), primary_key=True),
        sa.Column("asset_id", sa.String(length=128), sa.ForeignKey("evses.asset_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column("command_type", sa.String(length=64), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", json_document, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_simulated_commands_state_expires_at", "simulated_commands", ["state", "expires_at"])
    op.create_index("ix_simulated_commands_asset_created_at", "simulated_commands", ["asset_id", "created_at"])
    op.create_table(
        "audit_records",
        sa.Column("audit_id", sa.Integer(), primary_key=True),
        sa.Column("command_id", sa.String(length=128), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("payload", json_document, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("command_id", "sequence", name="uq_audit_records_command_sequence"),
    )
    op.create_index("ix_audit_records_command_id", "audit_records", ["command_id"])

    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            """
            CREATE FUNCTION prevent_audit_record_mutation() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_records are append-only';
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute(
            """
            CREATE TRIGGER audit_records_append_only
            BEFORE UPDATE OR DELETE ON audit_records
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_record_mutation();
            """
        )
        op.execute(
            """
            CREATE TRIGGER audit_records_prevent_truncate
            BEFORE TRUNCATE ON audit_records
            FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_record_mutation();
            """
        )
        op.execute(
            """
            COMMENT ON TABLE audit_records IS
            'Append-only audit trail. The runtime role must not own this table or have DDL, '
            'trigger-management, or TRUNCATE privileges. Run migrations with a separate owner role.';
            """
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TRIGGER IF EXISTS audit_records_prevent_truncate ON audit_records")
        op.execute("DROP TRIGGER IF EXISTS audit_records_append_only ON audit_records")
        op.execute("DROP FUNCTION IF EXISTS prevent_audit_record_mutation()")

    op.drop_index("ix_audit_records_command_id", table_name="audit_records")
    op.drop_table("audit_records")
    op.drop_index("ix_simulated_commands_asset_created_at", table_name="simulated_commands")
    op.drop_index("ix_simulated_commands_state_expires_at", table_name="simulated_commands")
    op.drop_table("simulated_commands")
    op.drop_index("ix_dispatch_recommendations_asset_created_at", table_name="dispatch_recommendations")
    op.drop_index("ix_dispatch_recommendations_site_expires_at", table_name="dispatch_recommendations")
    op.drop_table("dispatch_recommendations")
    op.drop_index("ix_alarms_asset_raised_at", table_name="alarms")
    op.drop_index("ix_alarms_state_severity", table_name="alarms")
    op.drop_table("alarms")
    op.drop_index("ix_charging_sessions_asset_started_at", table_name="charging_sessions")
    op.drop_table("charging_sessions")
    op.drop_index("ix_telemetry_points_site_occurred_at", table_name="telemetry_points")
    op.drop_index("ix_telemetry_points_asset_occurred_at", table_name="telemetry_points")
    op.drop_table("telemetry_points")
    op.drop_table("evses")
