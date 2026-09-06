select
  (select count(*) from information_schema.columns
     where table_schema = 'public'
       and table_name  = 'companies'
       and column_name = 'background') as has_background,
  (select string_agg(version, ', ' order by version)
     from supabase_migrations.schema_migrations
     where version >= '20260906090000') as ledger_recent;