-- Runs once when the postgres volume is first created.
-- pgvector is pre-installed in the pgvector/pgvector image; enabled now for Phase 5 search.
CREATE EXTENSION IF NOT EXISTS vector;
