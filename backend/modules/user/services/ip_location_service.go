package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"yaolight-workshop/backend/infrastructure/config"
	log "yaolight-workshop/backend/infrastructure/logx"
)

const ipLocationLookupTimeout = 3 * time.Second

type ipLocationService struct {
	client *http.Client
	cache  sync.Map
}

type ipLocationCacheItem struct {
	location string
	expires  time.Time
}

type ipAPIResponse struct {
	Status     string `json:"status"`
	Message    string `json:"message"`
	Country    string `json:"country"`
	RegionName string `json:"regionName"`
	City       string `json:"city"`
}

var (
	defaultIPLocationService   *ipLocationService
	defaultIPLocationServiceMu sync.Mutex
)

func newIPLocationService() *ipLocationService {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if proxyURL := strings.TrimSpace(config.IPGeoProxyURL); proxyURL != "" {
		if parsed, err := url.Parse(proxyURL); err == nil {
			transport.Proxy = http.ProxyURL(parsed)
		}
	}

	return &ipLocationService{
		client: &http.Client{
			Timeout:   ipLocationLookupTimeout,
			Transport: transport,
		},
	}
}

func resolveIPLocation(ip string) string {
	return getDefaultIPLocationService().Resolve(ip)
}

func getDefaultIPLocationService() *ipLocationService {
	defaultIPLocationServiceMu.Lock()
	defer defaultIPLocationServiceMu.Unlock()

	if defaultIPLocationService == nil {
		defaultIPLocationService = newIPLocationService()
	}
	return defaultIPLocationService
}

func (s *ipLocationService) Resolve(raw string) string {
	normalized := normalizeIP(raw)
	if normalized == "" {
		return ""
	}

	if cached, ok := s.loadCache(normalized); ok {
		return cached
	}

	if location := classifySpecialIP(normalized); location != "" {
		s.storeCache(normalized, location)
		return location
	}

	location, err := s.lookupRemote(normalized)
	if err != nil {
		log.Printf("⚠️ IP location lookup failed for %s: %v", normalized, err)
		s.storeCacheWithTTL(normalized, "", 15*time.Minute)
		return ""
	}
	s.storeCache(normalized, location)
	return location
}

func (s *ipLocationService) loadCache(ip string) (string, bool) {
	value, ok := s.cache.Load(ip)
	if !ok {
		return "", false
	}
	item, ok := value.(ipLocationCacheItem)
	if !ok || time.Now().After(item.expires) {
		s.cache.Delete(ip)
		return "", false
	}
	return item.location, true
}

func (s *ipLocationService) storeCache(ip, location string) {
	s.storeCacheWithTTL(ip, location, 24*time.Hour)
}

func (s *ipLocationService) storeCacheWithTTL(ip, location string, ttl time.Duration) {
	s.cache.Store(ip, ipLocationCacheItem{
		location: location,
		expires:  time.Now().Add(ttl),
	})
}

func (s *ipLocationService) lookupRemote(ip string) (string, error) {
	baseURL := strings.TrimRight(config.IPGeoAPIBaseURL, "/")
	if baseURL == "" {
		return "", nil
	}

	requestURL := fmt.Sprintf("%s/%s?lang=zh-CN&fields=status,message,country,regionName,city", baseURL, url.PathEscape(ip))
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, requestURL, nil)
	if err != nil {
		return "", err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	var payload ipAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}
	if !strings.EqualFold(payload.Status, "success") {
		if payload.Message == "" {
			payload.Message = "lookup failed"
		}
		return "", errors.New(payload.Message)
	}

	return formatLocationParts(payload.Country, payload.RegionName, payload.City), nil
}

func normalizeIP(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}

	if ip := net.ParseIP(value); ip != nil {
		return ip.String()
	}

	if host, _, err := net.SplitHostPort(value); err == nil {
		if ip := net.ParseIP(host); ip != nil {
			return ip.String()
		}
	}

	return value
}

func classifySpecialIP(raw string) string {
	ip := net.ParseIP(raw)
	if ip == nil {
		return ""
	}

	switch {
	case ip.IsLoopback():
		return "本机 / 回环地址"
	case ip.IsPrivate():
		return "局域网 / 私有网络"
	case ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast():
		return "链路本地 / 局域网络"
	case isCarrierGradeNAT(ip):
		return "运营商内网 / 保留地址"
	case isDocumentationIP(ip):
		return "文档示例 / 保留地址"
	default:
		return ""
	}
}

func isCarrierGradeNAT(ip net.IP) bool {
	_, block, _ := net.ParseCIDR("100.64.0.0/10")
	return block != nil && block.Contains(ip)
}

func isDocumentationIP(ip net.IP) bool {
	cidrs := []string{
		"192.0.2.0/24",
		"198.51.100.0/24",
		"203.0.113.0/24",
	}
	for _, cidr := range cidrs {
		_, block, _ := net.ParseCIDR(cidr)
		if block != nil && block.Contains(ip) {
			return true
		}
	}
	return false
}

func formatLocationParts(country, region, city string) string {
	parts := make([]string, 0, 3)
	for _, part := range []string{country, region, city} {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if len(parts) > 0 && parts[len(parts)-1] == part {
			continue
		}
		parts = append(parts, part)
	}
	return strings.Join(parts, " ")
}
