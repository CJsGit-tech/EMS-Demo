-- Local simulator roles. The init container's postgres superuser is not used
-- by migrations or the API once this one-time database initialization ends.
CREATE ROLE v2g_owner
  LOGIN
  PASSWORD 'v2g_owner_local_only'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE ROLE v2g_runtime
  LOGIN
  PASSWORD 'v2g_runtime_local_only'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON DATABASE v2g_simulator FROM PUBLIC;
GRANT CONNECT ON DATABASE v2g_simulator TO v2g_owner, v2g_runtime;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO v2g_owner WITH GRANT OPTION;
