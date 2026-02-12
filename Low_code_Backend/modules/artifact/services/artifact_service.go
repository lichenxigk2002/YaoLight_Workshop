package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/artifact/models"
	"yaolight-workshop/backend/modules/artifact/repositories"
)

// ArtifactStorageRoot 制品文件本地存储根目录（可用环境变量覆盖）
// 注意：不要放在 UploadPath 下，否则会被 /api/uploads 静态服务直接暴露
func ArtifactStorageRoot() string {
	if v := os.Getenv("ARTIFACT_STORAGE_PATH"); v != "" {
		return v
	}
	return "./storage/artifacts"
}

type CreateArtifactInput struct {
	UserID     uint
	WorkflowID *uint
	TaskID     *uint
	NodeID     string

	Kind        string
	MimeType    string
	Name        string
	Description *string
	Bytes       []byte
	Metadata    map[string]interface{}
}

// ArtifactService 负责制品落盘与落库
type ArtifactService struct {
	repo repositories.ArtifactRepository
}

func NewArtifactService(repo repositories.ArtifactRepository) *ArtifactService {
	return &ArtifactService{repo: repo}
}

func (s *ArtifactService) CreateLocalFileArtifact(in CreateArtifactInput) (*models.Artifact, error) {
	if in.UserID == 0 {
		return nil, fmt.Errorf("userId 不能为空")
	}
	if in.Kind == "" {
		return nil, fmt.Errorf("kind 不能为空")
	}
	if in.MimeType == "" {
		return nil, fmt.Errorf("mimeType 不能为空")
	}
	if in.Name == "" {
		return nil, fmt.Errorf("name 不能为空")
	}

	// 生成相对路径：YYYY/MM/<rand>_<name>
	now := time.Now().UTC()
	relDir := filepath.Join(
		fmt.Sprintf("%04d", now.Year()),
		fmt.Sprintf("%02d", int(now.Month())),
	)
	randHex, err := randomHex(16)
	if err != nil {
		return nil, err
	}
	safeName := sanitizeFileName(in.Name)
	relPath := filepath.ToSlash(filepath.Join(relDir, fmt.Sprintf("%s_%s", randHex, safeName)))

	root := ArtifactStorageRoot()
	absPath := filepath.Join(root, filepath.FromSlash(relPath))
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(absPath, in.Bytes, 0o644); err != nil {
		return nil, err
	}

	var metaJSONB *shared.JSONB
	if in.Metadata != nil {
		metaJSONB = &shared.JSONB{Data: in.Metadata}
	}

	a := &models.Artifact{
		UserID:      in.UserID,
		WorkflowID:  in.WorkflowID,
		TaskID:      in.TaskID,
		NodeID:      in.NodeID,
		Name:        in.Name,
		Description: in.Description,
		Kind:        in.Kind,
		MimeType:    in.MimeType,
		Size:        int64(len(in.Bytes)),
		Storage:     "local",
		Path:        relPath,
		Metadata:    metaJSONB,
	}
	if err := s.repo.Create(a); err != nil {
		// 回滚文件（最佳努力）
		_ = os.Remove(absPath)
		return nil, err
	}
	return a, nil
}

func randomHex(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func sanitizeFileName(name string) string {
	// 允许中文/英文/数字/常见符号，其他替换为 _
	// 简化实现：仅替换路径分隔符与控制字符
	name = filepath.Base(name)
	runes := make([]rune, 0, len(name))
	for _, r := range name {
		if r == '/' || r == '\\' || r == ':' || r == 0 {
			runes = append(runes, '_')
			continue
		}
		// 控制字符
		if r < 32 {
			runes = append(runes, '_')
			continue
		}
		runes = append(runes, r)
	}
	if len(runes) == 0 {
		return "artifact"
	}
	return string(runes)
}
