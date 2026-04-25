CREATE TABLE IF NOT EXISTS stardust_packages (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    stardust BIGINT NOT NULL,
    tag VARCHAR(32),
    tag_en VARCHAR(32),
    description VARCHAR(255),
    description_en VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stardust_packages_status_sort
    ON stardust_packages (status, sort_order);

INSERT INTO stardust_packages (id, name, name_en, price, stardust, tag, tag_en, description, description_en, status, sort_order, created_at, updated_at)
VALUES
    ('pkg_s', '星火包', 'Spark Pack', 9.90, 4000000, '入门', 'Starter', '适合新手用户，性价比高', 'A cost-effective starter package for new users.', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pkg_m', '星云包', 'Nebula Pack', 49.90, 20000000, '热门', 'Popular', '最受欢迎的选择，适合日常使用', 'The most popular option for everyday platform usage.', 'active', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('pkg_l', '星河包', 'Galaxy Pack', 199.90, 80000000, '超值', 'Best Value', '超值大礼包，适合重度用户', 'A high-value bundle for heavy usage.', 'active', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
