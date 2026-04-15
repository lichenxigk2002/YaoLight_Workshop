package migrations

import "embed"

// Files embeds versioned SQL migration files into the backend binary.
//
//go:embed *.sql
var Files embed.FS
