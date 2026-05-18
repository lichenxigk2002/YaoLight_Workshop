package jwt

import (
	"errors"
	"testing"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
	"yaolight-workshop/backend/infrastructure/config"
)

func TestGenerateAndParseToken(t *testing.T) {
	originalSecret := config.JWTSecret
	originalExpire := config.JWTExpireHours
	t.Cleanup(func() {
		config.JWTSecret = originalSecret
		config.JWTExpireHours = originalExpire
	})

	config.JWTSecret = "unit-test-secret"
	config.JWTExpireHours = 2

	token, err := GenerateToken(42, "alice", "admin")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	claims, err := ParseToken(token)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if claims.UserID != 42 || claims.Username != "alice" || claims.Role != "admin" {
		t.Fatalf("unexpected claims: %#v", claims)
	}
	if claims.Issuer != "yaolight-workshop" {
		t.Fatalf("unexpected issuer: %s", claims.Issuer)
	}
}

func TestParseTokenRejectsExpiredToken(t *testing.T) {
	originalSecret := config.JWTSecret
	t.Cleanup(func() { config.JWTSecret = originalSecret })
	config.JWTSecret = "unit-test-secret"

	claims := Claims{
		UserID:   1,
		Username: "expired",
		RegisteredClaims: jwtlib.RegisteredClaims{
			ExpiresAt: jwtlib.NewNumericDate(time.Now().Add(-time.Hour)),
			IssuedAt:  jwtlib.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			NotBefore: jwtlib.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}
	token, err := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, claims).SignedString([]byte(config.JWTSecret))
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	_, err = ParseToken(token)
	if !errors.Is(err, ErrExpiredToken) {
		t.Fatalf("expected ErrExpiredToken, got %v", err)
	}
}

func TestParseTokenRejectsWrongSigningMethod(t *testing.T) {
	originalSecret := config.JWTSecret
	t.Cleanup(func() { config.JWTSecret = originalSecret })
	config.JWTSecret = "unit-test-secret"

	token, err := jwtlib.NewWithClaims(jwtlib.SigningMethodNone, Claims{UserID: 1}).SignedString(jwtlib.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	_, err = ParseToken(token)
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
}
