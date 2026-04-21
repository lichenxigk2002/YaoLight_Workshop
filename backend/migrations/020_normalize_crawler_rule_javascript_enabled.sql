DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'crawler_rules'
          AND column_name = 'java_script_enabled'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'crawler_rules'
          AND column_name = 'javascript_enabled'
    ) THEN
        ALTER TABLE crawler_rules RENAME COLUMN java_script_enabled TO javascript_enabled;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'crawler_rules'
          AND column_name = 'java_script_enabled'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'crawler_rules'
          AND column_name = 'javascript_enabled'
    ) THEN
        EXECUTE 'UPDATE crawler_rules SET javascript_enabled = COALESCE(javascript_enabled, FALSE) OR COALESCE(java_script_enabled, FALSE)';
    END IF;
END $$;
