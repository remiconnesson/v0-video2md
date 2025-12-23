## 2024-05-23 - Avoid Large JSON Columns in Metadata Queries
**Learning:** Fetching full JSONB columns (like transcripts) in database queries when only basic metadata is needed can significantly impact performance, especially on Server Components that block rendering.
**Action:** Create specialized "metadata-only" queries that exclude large text/JSON columns for list views or initial page loads.
