package database

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	log "yaolight-workshop/backend/infrastructure/logx"

	"gorm.io/gorm"

	embeddedMigrations "yaolight-workshop/backend/migrations"
)

const migrationAdvisoryLockKey int64 = 2026031201

var migrationFilePattern = regexp.MustCompile(`^(\d+)_(.+)\.sql$`)

type sqlMigration struct {
	Version  int
	Name     string
	Checksum string
	Content  string
}

type appliedMigration struct {
	Version  int    `gorm:"column:version"`
	Name     string `gorm:"column:name"`
	Checksum string `gorm:"column:checksum"`
}

func RunSQLMigrations() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	if err := acquireMigrationLock(); err != nil {
		return err
	}
	defer releaseMigrationLock()

	if err := ensureMigrationTable(); err != nil {
		return err
	}

	migrations, err := loadSQLMigrations()
	if err != nil {
		return err
	}

	applied, err := loadAppliedMigrations()
	if err != nil {
		return err
	}

	for _, migration := range migrations {
		if existing, ok := applied[migration.Version]; ok {
			if existing.Name != migration.Name || existing.Checksum != migration.Checksum {
				return fmt.Errorf(
					"migration %s already recorded with different content; expected checksum=%s got checksum=%s",
					migration.Name,
					existing.Checksum,
					migration.Checksum,
				)
			}
			continue
		}

		if alreadySatisfied, err := isLegacyMigrationAlreadySatisfied(migration); err != nil {
			return fmt.Errorf("failed to inspect migration %s state: %w", migration.Name, err)
		} else if alreadySatisfied {
			log.Printf("SQL migration %s already satisfied by existing data; recording without execution", migration.Name)
			if err := recordAppliedMigration(DB, migration); err != nil {
				return fmt.Errorf("failed to record legacy-applied migration %s: %w", migration.Name, err)
			}
			continue
		}

		log.Printf("Applying SQL migration %s", migration.Name)
		if err := executeSQLMigration(migration); err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", migration.Name, err)
		}
		if err := recordAppliedMigration(DB, migration); err != nil {
			return fmt.Errorf("failed to record migration %s: %w", migration.Name, err)
		}
		log.Printf("Applied SQL migration %s", migration.Name)
	}

	return nil
}

func loadSQLMigrations() ([]sqlMigration, error) {
	entries, err := fs.ReadDir(embeddedMigrations.Files, ".")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded migrations: %w", err)
	}

	migrations := make([]sqlMigration, 0, len(entries))
	seenVersions := make(map[int]string)

	for _, entry := range entries {
		if entry.IsDir() || strings.ToLower(filepath.Ext(entry.Name())) != ".sql" {
			continue
		}

		matches := migrationFilePattern.FindStringSubmatch(entry.Name())
		if len(matches) != 3 {
			return nil, fmt.Errorf("invalid migration filename: %s", entry.Name())
		}

		version, err := strconv.Atoi(matches[1])
		if err != nil {
			return nil, fmt.Errorf("invalid migration version in %s: %w", entry.Name(), err)
		}
		if existing, ok := seenVersions[version]; ok {
			return nil, fmt.Errorf("duplicate migration version %03d: %s and %s", version, existing, entry.Name())
		}
		seenVersions[version] = entry.Name()

		contentBytes, err := embeddedMigrations.Files.ReadFile(entry.Name())
		if err != nil {
			return nil, fmt.Errorf("failed to read migration %s: %w", entry.Name(), err)
		}

		content := normalizeMigrationContent(string(contentBytes))
		sum := sha256.Sum256([]byte(content))

		migrations = append(migrations, sqlMigration{
			Version:  version,
			Name:     entry.Name(),
			Checksum: hex.EncodeToString(sum[:]),
			Content:  content,
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

func loadAppliedMigrations() (map[int]appliedMigration, error) {
	var rows []appliedMigration
	if err := DB.Raw(`SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC`).Scan(&rows).Error; err != nil {
		return nil, err
	}

	applied := make(map[int]appliedMigration, len(rows))
	for _, row := range rows {
		applied[row.Version] = row
	}
	return applied, nil
}

func ensureMigrationTable() error {
	return DB.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id BIGSERIAL PRIMARY KEY,
			version INTEGER NOT NULL UNIQUE,
			name VARCHAR(255) NOT NULL,
			checksum VARCHAR(64) NOT NULL,
			executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`).Error
}

func acquireMigrationLock() error {
	return DB.Exec(`SELECT pg_advisory_lock(?)`, migrationAdvisoryLockKey).Error
}

func releaseMigrationLock() {
	if err := DB.Exec(`SELECT pg_advisory_unlock(?)`, migrationAdvisoryLockKey).Error; err != nil {
		log.Printf("Warning: failed to release migration advisory lock: %v", err)
	}
}

func executeSQLMigration(migration sqlMigration) error {
	if strings.TrimSpace(migration.Content) == "" {
		return nil
	}

	if hasExplicitTransaction(migration.Content) {
		return DB.Exec(migration.Content).Error
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		return tx.Exec(migration.Content).Error
	})
}

func recordAppliedMigration(db *gorm.DB, migration sqlMigration) error {
	return db.Exec(
		`INSERT INTO schema_migrations (version, name, checksum, executed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
		migration.Version,
		migration.Name,
		migration.Checksum,
	).Error
}

func hasExplicitTransaction(content string) bool {
	upper := strings.ToUpper(content)
	return strings.Contains(upper, "\nBEGIN;") || strings.HasPrefix(upper, "BEGIN;")
}

func normalizeMigrationContent(content string) string {
	content = strings.TrimPrefix(content, "\uFEFF")
	return strings.ReplaceAll(content, "\r\n", "\n")
}

func isLegacyMigrationAlreadySatisfied(migration sqlMigration) (bool, error) {
	switch migration.Name {
	case "006_insert_alkaid_knowledge.sql":
		var systemKnowledgeCount int64
		err := DB.Raw(`SELECT COUNT(*) FROM alkaid_knowledge WHERE user_id IS NULL AND deleted_at IS NULL`).Scan(&systemKnowledgeCount).Error
		return systemKnowledgeCount >= 30, err
	case "011_update_output_node_knowledge.sql":
		var newTitlesCount int64
		if err := DB.Raw(`
			SELECT COUNT(*)
			FROM alkaid_knowledge
			WHERE user_id IS NULL
			  AND deleted_at IS NULL
			  AND title IN (
				'输出节点（导出/制品Artifacts/导出API）使用说明',
				'SVG 图表（chart）输入结构与示例',
				'Mermaid（timeline/sankey/network）输入结构与示例',
				'场景模板：AI 生成图表数据并导出 SVG（chart）'
			  )
		`).Scan(&newTitlesCount).Error; err != nil {
			return false, err
		}

		var legacyActiveCount int64
		if err := DB.Raw(`
			SELECT COUNT(*)
			FROM alkaid_knowledge
			WHERE user_id IS NULL
			  AND deleted_at IS NULL
			  AND title = '输出节点使用说明'
			  AND is_active = true
		`).Scan(&legacyActiveCount).Error; err != nil {
			return false, err
		}

		return newTitlesCount == 4 && legacyActiveCount == 0, nil
	default:
		return false, nil
	}
}
