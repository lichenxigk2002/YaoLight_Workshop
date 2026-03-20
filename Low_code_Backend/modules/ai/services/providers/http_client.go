package providers

import (
	"net/http"
	"time"
)

const DefaultHTTPTimeout = 15 * time.Second

func NewHTTPClient() *http.Client {
	return &http.Client{Timeout: DefaultHTTPTimeout}
}
