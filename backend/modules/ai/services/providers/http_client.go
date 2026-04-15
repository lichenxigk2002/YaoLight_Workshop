package providers

import (
	"net/http"
	"time"
)

const DefaultHTTPTimeout = 300 * time.Second

func NewHTTPClient() *http.Client {
	return &http.Client{Timeout: DefaultHTTPTimeout}
}
