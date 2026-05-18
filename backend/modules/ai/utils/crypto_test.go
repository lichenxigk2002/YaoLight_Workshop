package utils

import (
	"encoding/base64"
	"testing"

	"yaolight-workshop/backend/infrastructure/config"
)

func TestEncryptDecryptAPIKeyRoundTrip(t *testing.T) {
	originalSecret := config.JWTSecret
	t.Cleanup(func() { config.JWTSecret = originalSecret })
	config.JWTSecret = "short-secret"

	encrypted, err := EncryptAPIKey("sk-test-123")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if encrypted == "sk-test-123" {
		t.Fatalf("expected encrypted value to differ from plaintext")
	}

	decrypted, err := DecryptAPIKey(encrypted)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if decrypted != "sk-test-123" {
		t.Fatalf("expected original api key, got %q", decrypted)
	}
}

func TestEncryptAPIKeyRejectsEmptyValue(t *testing.T) {
	if _, err := EncryptAPIKey(""); err == nil {
		t.Fatalf("expected error")
	}
}

func TestDecryptAPIKeyRejectsInvalidCiphertext(t *testing.T) {
	originalSecret := config.JWTSecret
	t.Cleanup(func() { config.JWTSecret = originalSecret })
	config.JWTSecret = "unit-test-secret"

	if _, err := DecryptAPIKey(""); err == nil {
		t.Fatalf("expected empty value error")
	}
	if _, err := DecryptAPIKey("not-base64"); err == nil {
		t.Fatalf("expected base64 error")
	}

	short := base64.StdEncoding.EncodeToString([]byte("short"))
	if _, err := DecryptAPIKey(short); err == nil {
		t.Fatalf("expected short ciphertext error")
	}
}
