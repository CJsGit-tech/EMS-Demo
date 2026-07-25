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
    op.create_unique_constraint("uq_evses_asset_site", "evses", ["asset_id", "site_id"])

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
        sa.UniqueConstraint("inverter_id", "site_id", name="uq_inverter_readings_inverter_site"),
    )
    op.create_index("ix_inverter_readings_site_id", "inverter_readings", ["site_id"])
    op.create_index("ix_inverter_readings_site_occurred_at", "inverter_readings", ["site_id", "occurred_at"])

    op.create_table(
        "string_readings",
        sa.Column("string_reading_id", sa.Integer(), primary_key=True),
        sa.Column("inverter_id", sa.String(length=128), nullable=False),
        sa.Column("site_id", sa.String(length=128), nullable=False),
        sa.Column("string_id", sa.String(length=128), nullable=False),
        sa.Column("dc_power_kw", sa.Numeric(18, 6), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="simulated"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["inverter_id", "site_id"],
            ["inverter_readings.inverter_id", "inverter_readings.site_id"],
            name="fk_string_readings_inverter_site",
            ondelete="RESTRICT",
        ),
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
        ),
        sa.Column("source_alarm_code", sa.String(length=128)),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("assigned_team", sa.String(length=128), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="simulated"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["asset_id", "site_id"],
            ["evses.asset_id", "evses.site_id"],
            name="fk_work_orders_asset_site",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "state IN ('open', 'in_progress', 'completed')", name="ck_work_orders_permitted_state"
        ),
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
        sa.Column("actor", sa.String(length=128)),
        sa.Column("reason", sa.Text()),
        sa.Column("payload", json_document, nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "event_type <> 'work_order.state_changed' OR "
            "(actor IS NOT NULL AND length(trim(actor)) > 0 AND "
            "reason IS NOT NULL AND length(trim(reason)) > 0)",
            name="ck_work_order_events_state_transition_attribution",
        ),
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
        op.execute(
            """
            CREATE FUNCTION prevent_direct_runtime_work_order_event_insert() RETURNS trigger AS $$
            BEGIN
                IF current_user = 'v2g_runtime' THEN
                    RAISE EXCEPTION 'work_order_events must be appended through a controlled function';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        op.execute(
            """
            CREATE TRIGGER work_order_events_controlled_insert
            BEFORE INSERT ON work_order_events
            FOR EACH ROW EXECUTE FUNCTION prevent_direct_runtime_work_order_event_insert();
            """
        )
        op.execute(
            """
            CREATE FUNCTION transition_work_order_state(
                p_work_order_id VARCHAR,
                p_site_id VARCHAR,
                p_state VARCHAR,
                p_actor VARCHAR,
                p_reason TEXT
            ) RETURNS VOID
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public, pg_temp
            AS $$
            DECLARE
                v_previous_state VARCHAR;
            BEGIN
                IF btrim(COALESCE(p_actor, '')) = '' OR btrim(COALESCE(p_reason, '')) = '' THEN
                    RAISE EXCEPTION 'work-order state transitions require actor and reason';
                END IF;
                IF p_site_id IS DISTINCT FROM 'demo-v2g-site' THEN
                    RAISE EXCEPTION 'work-order transitions are restricted to demo-v2g-site';
                END IF;

                SELECT state INTO v_previous_state
                FROM work_orders
                WHERE work_order_id = p_work_order_id AND site_id = p_site_id
                FOR UPDATE;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'work order does not belong to the expected site';
                END IF;
                IF NOT (
                    (v_previous_state = 'open' AND p_state = 'in_progress')
                    OR (v_previous_state = 'in_progress' AND p_state IN ('completed', 'open'))
                ) THEN
                    RAISE EXCEPTION 'work-order state transition from % to % is not permitted',
                        v_previous_state, p_state;
                END IF;

                UPDATE work_orders SET state = p_state
                WHERE work_order_id = p_work_order_id AND site_id = p_site_id;
                INSERT INTO work_order_events (
                    work_order_id, event_type, actor, reason, payload
                ) VALUES (
                    p_work_order_id,
                    'work_order.state_changed',
                    btrim(p_actor),
                    btrim(p_reason),
                    jsonb_build_object(
                        'source', 'simulated-runtime',
                        'from_state', v_previous_state,
                        'to_state', p_state,
                        'actor', btrim(p_actor),
                        'reason', btrim(p_reason)
                    )
                );
            END;
            $$;
            """
        )
        op.execute(
            """
            CREATE FUNCTION append_demo_work_order_event(
                p_work_order_id VARCHAR,
                p_event_type VARCHAR,
                p_payload JSONB,
                p_actor VARCHAR,
                p_reason TEXT
            ) RETURNS INTEGER
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public, pg_temp
            AS $$
            DECLARE
                v_site_id VARCHAR;
                v_event_id INTEGER;
            BEGIN
                SELECT site_id INTO v_site_id
                FROM work_orders
                WHERE work_order_id = p_work_order_id;
                IF NOT FOUND OR v_site_id <> 'demo-v2g-site' THEN
                    RAISE EXCEPTION 'work-order events are restricted to demo-v2g-site';
                END IF;
                IF p_event_type = 'work_order.state_changed' THEN
                    RAISE EXCEPTION 'work-order state events must use the controlled transition boundary';
                END IF;
                IF p_actor IS NOT NULL AND btrim(p_actor) = '' THEN
                    RAISE EXCEPTION 'actor is required when supplied';
                END IF;
                IF p_reason IS NOT NULL AND btrim(p_reason) = '' THEN
                    RAISE EXCEPTION 'reason is required when supplied';
                END IF;

                INSERT INTO work_order_events (
                    work_order_id, event_type, actor, reason, payload
                ) VALUES (
                    p_work_order_id, p_event_type, NULLIF(btrim(p_actor), ''),
                    NULLIF(btrim(p_reason), ''), p_payload
                ) RETURNING work_order_event_id INTO v_event_id;
                RETURN v_event_id;
            END;
            $$;
            """
        )
        op.execute(
            """
            CREATE FUNCTION append_audit_record(
                p_command_id VARCHAR,
                p_event_type VARCHAR,
                p_payload JSONB
            ) RETURNS INTEGER
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = pg_catalog, public, pg_temp
            AS $$
            DECLARE
                v_audit_id INTEGER;
                v_command_id VARCHAR := btrim(p_command_id);
                v_event_type VARCHAR := btrim(p_event_type);
                v_sequence INTEGER;
            BEGIN
                IF COALESCE(v_command_id, '') = '' THEN
                    RAISE EXCEPTION 'audit command_id is required';
                END IF;
                IF COALESCE(v_event_type, '') = '' THEN
                    RAISE EXCEPTION 'audit event_type is required';
                END IF;
                IF p_payload IS NULL THEN
                    RAISE EXCEPTION 'audit payload is required';
                END IF;

                PERFORM pg_advisory_xact_lock(hashtext(v_command_id));
                SELECT COALESCE(MAX(sequence), 0) + 1 INTO v_sequence
                FROM public.audit_records
                WHERE command_id = v_command_id;

                INSERT INTO public.audit_records (
                    command_id, sequence, event_type, payload, occurred_at
                ) VALUES (
                    v_command_id, v_sequence, v_event_type, p_payload, CURRENT_TIMESTAMP
                ) RETURNING audit_id INTO v_audit_id;
                RETURN v_audit_id;
            END;
            $$;
            """
        )
        op.execute("REVOKE ALL ON FUNCTION transition_work_order_state(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) FROM PUBLIC")
        op.execute("REVOKE ALL ON FUNCTION append_demo_work_order_event(VARCHAR, VARCHAR, JSONB, VARCHAR, TEXT) FROM PUBLIC")
        op.execute("REVOKE ALL ON FUNCTION append_audit_record(VARCHAR, VARCHAR, JSONB) FROM PUBLIC")
        op.execute("REVOKE ALL ON TABLE audit_records, work_order_events, work_orders FROM v2g_runtime")
        op.execute(
            "REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_records, work_order_events, work_orders FROM v2g_runtime"
        )
        op.execute("GRANT USAGE ON SCHEMA public TO v2g_runtime")
        op.execute("GRANT SELECT ON TABLE audit_records TO v2g_runtime")
        op.execute("GRANT SELECT ON TABLE work_order_events TO v2g_runtime")
        op.execute("GRANT SELECT ON TABLE work_orders TO v2g_runtime")
        op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO v2g_runtime")
        op.execute("GRANT EXECUTE ON FUNCTION append_audit_record(VARCHAR, VARCHAR, JSONB) TO v2g_runtime")
        op.execute("GRANT EXECUTE ON FUNCTION transition_work_order_state(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) TO v2g_runtime")
        op.execute("GRANT EXECUTE ON FUNCTION append_demo_work_order_event(VARCHAR, VARCHAR, JSONB, VARCHAR, TEXT) TO v2g_runtime")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("REVOKE ALL ON TABLE audit_records FROM v2g_runtime")
        op.execute("REVOKE ALL ON TABLE work_order_events FROM v2g_runtime")
        op.execute("REVOKE ALL ON FUNCTION append_audit_record(VARCHAR, VARCHAR, JSONB) FROM v2g_runtime")
        op.execute("DROP FUNCTION IF EXISTS append_audit_record(VARCHAR, VARCHAR, JSONB)")
        op.execute("REVOKE ALL ON FUNCTION append_demo_work_order_event(VARCHAR, VARCHAR, JSONB, VARCHAR, TEXT) FROM v2g_runtime")
        op.execute("DROP FUNCTION IF EXISTS append_demo_work_order_event(VARCHAR, VARCHAR, JSONB, VARCHAR, TEXT)")
        op.execute("REVOKE ALL ON FUNCTION transition_work_order_state(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) FROM v2g_runtime")
        op.execute("DROP FUNCTION IF EXISTS transition_work_order_state(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT)")
        op.execute("DROP TRIGGER IF EXISTS work_order_events_controlled_insert ON work_order_events")
        op.execute("DROP TRIGGER IF EXISTS work_order_events_prevent_truncate ON work_order_events")
        op.execute("DROP TRIGGER IF EXISTS work_order_events_append_only ON work_order_events")
        op.execute("DROP FUNCTION IF EXISTS prevent_direct_runtime_work_order_event_insert()")
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
    op.drop_constraint("uq_evses_asset_site", "evses", type_="unique")
