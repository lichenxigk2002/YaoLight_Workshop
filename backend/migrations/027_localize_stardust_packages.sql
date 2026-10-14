ALTER TABLE stardust_packages
    ADD COLUMN IF NOT EXISTS name_en VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tag_en VARCHAR(32),
    ADD COLUMN IF NOT EXISTS description_en VARCHAR(255);

UPDATE stardust_packages
SET
    name_en = COALESCE(NULLIF(name_en, ''), 'Spark Pack'),
    tag_en = COALESCE(NULLIF(tag_en, ''), 'Starter'),
    description_en = COALESCE(NULLIF(description_en, ''), 'A cost-effective starter package for new users.')
WHERE id = 'pkg_s';

UPDATE stardust_packages
SET
    name_en = COALESCE(NULLIF(name_en, ''), 'Nebula Pack'),
    tag_en = COALESCE(NULLIF(tag_en, ''), 'Popular'),
    description_en = COALESCE(NULLIF(description_en, ''), 'The most popular option for everyday platform usage.')
WHERE id = 'pkg_m';

UPDATE stardust_packages
SET
    name_en = COALESCE(NULLIF(name_en, ''), 'Galaxy Pack'),
    tag_en = COALESCE(NULLIF(tag_en, ''), 'Best Value'),
    description_en = COALESCE(NULLIF(description_en, ''), 'A high-value bundle for heavy usage.')
WHERE id = 'pkg_l';
