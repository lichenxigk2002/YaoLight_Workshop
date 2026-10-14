package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/infrastructure/storage"
	"yaolight-workshop/backend/modules/artifact/models"
	"yaolight-workshop/backend/modules/artifact/repositories"
	userModels "yaolight-workshop/backend/modules/user/models"
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

func (s *ArtifactService) CreateArtifact(in CreateArtifactInput) (*models.Artifact, error) {
	if config.COSEnabled {
		return s.CreateCOSArtifact(in)
	}
	return s.CreateLocalFileArtifact(in)
}

func (s *ArtifactService) CreateLocalFileArtifact(in CreateArtifactInput) (*models.Artifact, error) {
	if err := validateCreateArtifactInput(in); err != nil {
		return nil, err
	}

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

	absPath := ArtifactAbsolutePath(relPath)
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(absPath, in.Bytes, 0o644); err != nil {
		return nil, err
	}

	a := buildArtifactModel(in, "local", relPath)
	if err := s.repo.Create(a); err != nil {
		_ = os.Remove(absPath)
		return nil, err
	}
	return a, nil
}

func (s *ArtifactService) CreateCOSArtifact(in CreateArtifactInput) (*models.Artifact, error) {
	if err := validateCreateArtifactInput(in); err != nil {
		return nil, err
	}

	objectKey, err := buildWorkflowArtifactObjectKey(in)
	if err != nil {
		return nil, err
	}

	if err := storage.UploadPrivateObject(
		context.Background(),
		objectKey,
		bytes.NewReader(in.Bytes),
		int64(len(in.Bytes)),
		in.MimeType,
	); err != nil {
		return nil, err
	}

	a := buildArtifactModel(in, "cos", objectKey)
	if err := s.repo.Create(a); err != nil {
		return nil, err
	}
	return a, nil
}

func ArtifactAbsolutePath(relPath string) string {
	return filepath.Join(ArtifactStorageRoot(), filepath.FromSlash(relPath))
}

func ArtifactContent(a *models.Artifact) ([]byte, error) {
	switch a.Storage {
	case "local":
		return os.ReadFile(ArtifactAbsolutePath(a.Path))
	case "cos":
		return storage.DownloadObject(context.Background(), a.Path)
	default:
		return nil, fmt.Errorf("unsupported artifact storage: %s", a.Storage)
	}
}

func ArtifactDownloadURL(a *models.Artifact, expires time.Duration) (string, error) {
	switch a.Storage {
	case "local":
		return "", nil
	case "cos":
		return storage.GetPresignedDownloadURL(context.Background(), a.Path, expires)
	default:
		return "", fmt.Errorf("unsupported artifact storage: %s", a.Storage)
	}
}

func validateCreateArtifactInput(in CreateArtifactInput) error {
	if in.UserID == 0 {
		return fmt.Errorf("userId 不能为空")
	}
	if in.Kind == "" {
		return fmt.Errorf("kind 不能为空")
	}
	if in.MimeType == "" {
		return fmt.Errorf("mimeType 不能为空")
	}
	if in.Name == "" {
		return fmt.Errorf("name 不能为空")
	}
	return nil
}

func buildArtifactModel(in CreateArtifactInput, storageType string, path string) *models.Artifact {
	var metaJSONB *shared.JSONB
	if in.Metadata != nil {
		metaJSONB = &shared.JSONB{Data: in.Metadata}
	}

	return &models.Artifact{
		UserID:      in.UserID,
		WorkflowID:  in.WorkflowID,
		TaskID:      in.TaskID,
		NodeID:      in.NodeID,
		Name:        in.Name,
		Description: in.Description,
		Kind:        in.Kind,
		MimeType:    in.MimeType,
		Size:        int64(len(in.Bytes)),
		Storage:     storageType,
		Path:        path,
		Metadata:    metaJSONB,
	}
}

func buildWorkflowArtifactObjectKey(in CreateArtifactInput) (string, error) {
	var user userModels.User
	if err := database.DB.Select("user_no").First(&user, in.UserID).Error; err != nil {
		return "", fmt.Errorf("load user for artifact storage failed: %w", err)
	}
	if user.UserNo == 0 {
		return "", fmt.Errorf("userNo is empty for user %d", in.UserID)
	}

	workflowSegment := "standalone"
	if in.WorkflowID != nil && *in.WorkflowID > 0 {
		workflowSegment = strconv.FormatUint(uint64(*in.WorkflowID), 10)
	}

	taskSegment := "taskless"
	if in.TaskID != nil && *in.TaskID > 0 {
		taskSegment = strconv.FormatUint(uint64(*in.TaskID), 10)
	}

	randHex, err := randomHex(16)
	if err != nil {
		return "", err
	}
	safeName := sanitizeFileName(in.Name)

	return filepath.ToSlash(filepath.Join(
		"user",
		"workflow",
		strconv.FormatInt(user.UserNo, 10),
		workflowSegment,
		taskSegment,
		fmt.Sprintf("%s_%s", randHex, safeName),
	)), nil
}

func randomHex(nBytes int) (string, error) {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func sanitizeFileName(name string) string {
	name = filepath.Base(name)
	runes := make([]rune, 0, len(name))
	for _, r := range name {
		if r == '/' || r == '\\' || r == ':' || r == 0 {
			runes = append(runes, '_')
			continue
		}
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
