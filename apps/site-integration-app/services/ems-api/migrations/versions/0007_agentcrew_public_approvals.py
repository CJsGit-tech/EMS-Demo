"""Restore the AgentCrew approval boundary to the public persistence schema."""

from alembic import op
import sqlalchemy as sa


revision = "0007_agentcrew_public_approvals"
down_revision = "0006_report_draft_revisions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("approvals", schema="public"):
        op.create_table(
            "approvals",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("user_id", sa.String(128), nullable=False),
            sa.Column("site_id", sa.String(128), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("run_id", sa.String(64), nullable=False),
            sa.Column("session_id", sa.String(64), nullable=False),
            sa.Column("mode", sa.String(32), nullable=False),
            sa.Column("tool_key", sa.String(96), nullable=False),
            sa.Column("status", sa.String(32), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True)),
            schema="public",
        )
    index_names = {index["name"] for index in inspector.get_indexes("approvals", schema="public")}
    if "ix_approvals_run_id" not in index_names:
        op.create_index("ix_approvals_run_id", "approvals", ["run_id"], schema="public")
    if "ix_approvals_session_id" not in index_names:
        op.create_index("ix_approvals_session_id", "approvals", ["session_id"], schema="public")


def downgrade() -> None:
    # `approvals` originates in the base AgentCrew migration on fresh installs
    # and can pre-exist on upgraded deployments, so never drop the table here.
    inspector = sa.inspect(op.get_bind())
    index_names = {index["name"] for index in inspector.get_indexes("approvals", schema="public")}
    if "ix_approvals_session_id" in index_names:
        op.drop_index("ix_approvals_session_id", table_name="approvals", schema="public")
    if "ix_approvals_run_id" in index_names:
        op.drop_index("ix_approvals_run_id", table_name="approvals", schema="public")
