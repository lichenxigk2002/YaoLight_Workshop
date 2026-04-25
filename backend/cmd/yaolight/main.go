package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"
)

const defaultBaseURL = "http://localhost:8080/api"

type configFile struct {
	BaseURL string `json:"base_url"`
	Token   string `json:"token,omitempty"`
}

type apiResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage()
		return nil
	}

	switch args[0] {
	case "help", "-h", "--help":
		printUsage()
		return nil
	case "config":
		return runConfig(args[1:])
	case "login":
		return runLogin(args[1:])
	case "me":
		return runMe(args[1:])
	case "projects":
		return runProjects(args[1:])
	case "workflows":
		return runWorkflows(args[1:])
	case "tasks":
		return runTasks(args[1:])
	case "api":
		return runAPI(args[1:])
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func printUsage() {
	fmt.Println(`YaoLight CLI

Usage:
  yaolight config show
  yaolight config set --base-url http://localhost:8080/api
  yaolight login --username USER --password PASS [--base-url URL]
  yaolight me [--json]
  yaolight projects list [--page 1 --page-size 20 --json]
  yaolight projects get <id> [--json]
  yaolight workflows list [--project-id 1 --page 1 --page-size 20 --json]
  yaolight workflows get <id> [--nodes] [--json]
  yaolight tasks get <id> [--json]
  yaolight tasks logs <id> [--page 1 --limit 100 --level error --json]
  yaolight api get /projects?page=1&pageSize=20

Environment:
  YAOLIGHT_BASE_URL  Overrides saved base URL
  YAOLIGHT_TOKEN     Overrides saved token
  YAOLIGHT_CONFIG    Overrides config file path`)
}

func runConfig(args []string) error {
	if len(args) == 0 {
		return errors.New("config needs a subcommand: show or set")
	}

	switch args[0] {
	case "show":
		cfg, path, err := loadConfig()
		if err != nil {
			return err
		}
		out := map[string]any{
			"path":      path,
			"base_url":  effectiveBaseURL(cfg),
			"has_token": effectiveToken(cfg) != "",
		}
		return printJSON(out)
	case "set":
		fs := flag.NewFlagSet("config set", flag.ContinueOnError)
		baseURL := fs.String("base-url", "", "API base URL, for example http://localhost:8080/api")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if strings.TrimSpace(*baseURL) == "" {
			return errors.New("--base-url is required")
		}
		cfg, _, err := loadConfig()
		if err != nil {
			return err
		}
		cfg.BaseURL = normalizeBaseURL(*baseURL)
		if err := saveConfig(cfg); err != nil {
			return err
		}
		fmt.Println("base URL saved:", cfg.BaseURL)
		return nil
	default:
		return fmt.Errorf("unknown config subcommand %q", args[0])
	}
}

func runLogin(args []string) error {
	fs := flag.NewFlagSet("login", flag.ContinueOnError)
	baseURL := fs.String("base-url", "", "API base URL")
	username := fs.String("username", os.Getenv("YAOLIGHT_USERNAME"), "username")
	password := fs.String("password", os.Getenv("YAOLIGHT_PASSWORD"), "password")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *username == "" || *password == "" {
		return errors.New("--username and --password are required, or set YAOLIGHT_USERNAME and YAOLIGHT_PASSWORD")
	}

	cfg, _, err := loadConfig()
	if err != nil {
		return err
	}
	if *baseURL != "" {
		cfg.BaseURL = normalizeBaseURL(*baseURL)
	}
	c := newClient(cfg)

	body := map[string]string{"username": *username, "password": *password}
	data, err := c.do(http.MethodPost, "/auth/login", nil, body, true)
	if err != nil {
		return err
	}
	var login struct {
		Token string         `json:"token"`
		User  map[string]any `json:"user"`
	}
	if err := json.Unmarshal(data, &login); err != nil {
		return fmt.Errorf("decode login response: %w", err)
	}
	if login.Token == "" {
		return errors.New("login response did not include token")
	}
	cfg.Token = login.Token
	if err := saveConfig(cfg); err != nil {
		return err
	}
	if name := stringValue(login.User, "username", "email"); name != "" {
		fmt.Println("logged in as", name)
		return nil
	}
	fmt.Println("logged in")
	return nil
}

func runMe(args []string) error {
	fs := flag.NewFlagSet("me", flag.ContinueOnError)
	jsonOut := fs.Bool("json", false, "print JSON")
	if err := fs.Parse(args); err != nil {
		return err
	}
	c, err := configuredClient()
	if err != nil {
		return err
	}
	data, err := c.do(http.MethodGet, "/users/current", nil, nil, true)
	if err != nil {
		return err
	}
	if *jsonOut {
		return printRawJSON(data)
	}
	var user map[string]any
	if err := json.Unmarshal(data, &user); err != nil {
		return err
	}
	fmt.Printf("id: %s\nusername: %s\nemail: %s\nstatus: %s\n",
		valueString(user["id"]),
		stringValue(user, "username"),
		stringValue(user, "email"),
		stringValue(user, "status"),
	)
	return nil
}

func runProjects(args []string) error {
	if len(args) == 0 {
		return errors.New("projects needs a subcommand: list or get")
	}
	switch args[0] {
	case "list":
		fs := flag.NewFlagSet("projects list", flag.ContinueOnError)
		page := fs.Int("page", 1, "page")
		pageSize := fs.Int("page-size", 20, "page size")
		jsonOut := fs.Bool("json", false, "print JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		q := url.Values{"page": {strconv.Itoa(*page)}, "pageSize": {strconv.Itoa(*pageSize)}}
		return getPage("/projects", q, *jsonOut, []string{"id", "name", "status", "created_at"})
	case "get":
		fs := flag.NewFlagSet("projects get", flag.ContinueOnError)
		jsonOut := fs.Bool("json", false, "print JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 1 {
			return errors.New("projects get requires an id")
		}
		return getObject("/projects/"+fs.Arg(0), *jsonOut)
	default:
		return fmt.Errorf("unknown projects subcommand %q", args[0])
	}
}

func runWorkflows(args []string) error {
	if len(args) == 0 {
		return errors.New("workflows needs a subcommand: list or get")
	}
	switch args[0] {
	case "list":
		fs := flag.NewFlagSet("workflows list", flag.ContinueOnError)
		projectID := fs.Int("project-id", 0, "project id")
		page := fs.Int("page", 1, "page")
		pageSize := fs.Int("page-size", 20, "page size")
		jsonOut := fs.Bool("json", false, "print JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		q := url.Values{"page": {strconv.Itoa(*page)}, "pageSize": {strconv.Itoa(*pageSize)}}
		if *projectID > 0 {
			q.Set("projectId", strconv.Itoa(*projectID))
		}
		return getPage("/workflows", q, *jsonOut, []string{"id", "name", "projectId", "status", "updatedAt"})
	case "get":
		fs := flag.NewFlagSet("workflows get", flag.ContinueOnError)
		includeNodes := fs.Bool("nodes", false, "include workflow nodes")
		jsonOut := fs.Bool("json", false, "print JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 1 {
			return errors.New("workflows get requires an id")
		}
		if *includeNodes {
			return getObject("/workflows/"+fs.Arg(0)+"/nodes", *jsonOut)
		}
		return getObject("/workflows/"+fs.Arg(0), *jsonOut)
	default:
		return fmt.Errorf("unknown workflows subcommand %q", args[0])
	}
}

func runTasks(args []string) error {
	if len(args) == 0 {
		return errors.New("tasks needs a subcommand: get or logs")
	}
	switch args[0] {
	case "get":
		fs := flag.NewFlagSet("tasks get", flag.ContinueOnError)
		jsonOut := fs.Bool("json", false, "print JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 1 {
			return errors.New("tasks get requires an id")
		}
		return getObject("/tasks/"+fs.Arg(0), *jsonOut)
	case "logs":
		fs := flag.NewFlagSet("tasks logs", flag.ContinueOnError)
		page := fs.Int("page", 1, "page")
		limit := fs.Int("limit", 100, "limit")
		level := fs.String("level", "", "log level")
		jsonOut := fs.Bool("json", false, "print JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 1 {
			return errors.New("tasks logs requires an id")
		}
		q := url.Values{"page": {strconv.Itoa(*page)}, "limit": {strconv.Itoa(*limit)}}
		if *level != "" {
			q.Set("level", *level)
		}
		data, err := configuredGet("/tasks/"+fs.Arg(0)+"/logs", q)
		if err != nil {
			return err
		}
		if *jsonOut {
			return printRawJSON(data)
		}
		return printTaskLogs(data)
	default:
		return fmt.Errorf("unknown tasks subcommand %q", args[0])
	}
}

func runAPI(args []string) error {
	if len(args) == 0 {
		return errors.New("api needs a subcommand: get")
	}
	switch args[0] {
	case "get":
		fs := flag.NewFlagSet("api get", flag.ContinueOnError)
		jsonOut := fs.Bool("json", true, "print JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 1 {
			return errors.New("api get requires a path")
		}
		data, err := configuredGet(fs.Arg(0), nil)
		if err != nil {
			return err
		}
		if *jsonOut {
			return printRawJSON(data)
		}
		fmt.Println(string(data))
		return nil
	default:
		return fmt.Errorf("unknown api subcommand %q", args[0])
	}
}

func getPage(path string, q url.Values, jsonOut bool, fields []string) error {
	data, err := configuredGet(path, q)
	if err != nil {
		return err
	}
	if jsonOut {
		return printRawJSON(data)
	}
	var page struct {
		List     []map[string]any `json:"list"`
		Total    int              `json:"total"`
		Page     int              `json:"page"`
		PageSize int              `json:"pageSize"`
	}
	if err := json.Unmarshal(data, &page); err != nil {
		return err
	}
	printTable(page.List, fields)
	fmt.Printf("\ntotal: %d page: %d pageSize: %d\n", page.Total, page.Page, page.PageSize)
	return nil
}

func getObject(path string, jsonOut bool) error {
	data, err := configuredGet(path, nil)
	if err != nil {
		return err
	}
	if jsonOut {
		return printRawJSON(data)
	}
	return printRawJSON(data)
}

func configuredGet(path string, q url.Values) (json.RawMessage, error) {
	c, err := configuredClient()
	if err != nil {
		return nil, err
	}
	return c.do(http.MethodGet, path, q, nil, true)
}

func configuredClient() (*client, error) {
	cfg, _, err := loadConfig()
	if err != nil {
		return nil, err
	}
	return newClient(cfg), nil
}

func newClient(cfg configFile) *client {
	return &client{
		baseURL: normalizeBaseURL(effectiveBaseURL(cfg)),
		token:   effectiveToken(cfg),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *client) do(method, path string, q url.Values, body any, unwrap bool) (json.RawMessage, error) {
	reqURL, err := c.buildURL(path, q)
	if err != nil {
		return nil, err
	}

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(payload)
	}

	req, err := http.NewRequest(method, reqURL, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%s %s failed: HTTP %d: %s", method, path, resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	if !unwrap {
		return respBody, nil
	}

	var wrapped apiResponse
	if err := json.Unmarshal(respBody, &wrapped); err == nil && wrapped.Code != 0 {
		if wrapped.Code != 200 {
			return nil, fmt.Errorf("API %d: %s", wrapped.Code, wrapped.Message)
		}
		if wrapped.Data == nil {
			return json.RawMessage("null"), nil
		}
		return wrapped.Data, nil
	}
	return respBody, nil
}

func (c *client) buildURL(path string, q url.Values) (string, error) {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		u, err := url.Parse(path)
		if err != nil {
			return "", err
		}
		if q != nil {
			mergeQuery(u, q)
		}
		return u.String(), nil
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	u, err := url.Parse(c.baseURL + path)
	if err != nil {
		return "", err
	}
	if q != nil {
		mergeQuery(u, q)
	}
	return u.String(), nil
}

func mergeQuery(u *url.URL, q url.Values) {
	existing := u.Query()
	for k, values := range q {
		for _, value := range values {
			existing.Add(k, value)
		}
	}
	u.RawQuery = existing.Encode()
}

func loadConfig() (configFile, string, error) {
	path, err := configPath()
	if err != nil {
		return configFile{}, "", err
	}
	cfg := configFile{BaseURL: defaultBaseURL}
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return cfg, path, nil
		}
		return configFile{}, path, err
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return configFile{}, path, fmt.Errorf("read config %s: %w", path, err)
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultBaseURL
	}
	return cfg, path, nil
}

func saveConfig(cfg configFile) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

func configPath() (string, error) {
	if p := os.Getenv("YAOLIGHT_CONFIG"); p != "" {
		return p, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".yaolight", "config.json"), nil
}

func effectiveBaseURL(cfg configFile) string {
	if v := strings.TrimSpace(os.Getenv("YAOLIGHT_BASE_URL")); v != "" {
		return v
	}
	if cfg.BaseURL != "" {
		return cfg.BaseURL
	}
	return defaultBaseURL
}

func effectiveToken(cfg configFile) string {
	if v := strings.TrimSpace(os.Getenv("YAOLIGHT_TOKEN")); v != "" {
		return v
	}
	return cfg.Token
}

func normalizeBaseURL(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimRight(raw, "/")
	if strings.HasSuffix(raw, "/api") {
		return raw
	}
	return raw + "/api"
}

func printJSON(v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(data))
	return nil
}

func printRawJSON(data []byte) error {
	var v any
	if err := json.Unmarshal(data, &v); err != nil {
		fmt.Println(string(data))
		return nil
	}
	return printJSON(v)
}

func printTable(rows []map[string]any, fields []string) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	for _, field := range fields {
		fmt.Fprintf(w, "%s\t", field)
	}
	fmt.Fprintln(w)
	for _, row := range rows {
		for _, field := range fields {
			fmt.Fprintf(w, "%s\t", valueString(row[field]))
		}
		fmt.Fprintln(w)
	}
	w.Flush()
}

func printTaskLogs(data []byte) error {
	var obj map[string]any
	if err := json.Unmarshal(data, &obj); err != nil {
		return err
	}
	items := firstArray(obj, "logs", "list", "items")
	if len(items) == 0 {
		return printRawJSON(data)
	}
	fields := []string{"createdAt", "level", "nodeId", "message"}
	if _, ok := items[0]["created_at"]; ok {
		fields[0] = "created_at"
	}
	if _, ok := items[0]["node_id"]; ok {
		fields[2] = "node_id"
	}
	printTable(items, fields)
	return nil
}

func firstArray(obj map[string]any, keys ...string) []map[string]any {
	for _, key := range keys {
		raw, ok := obj[key].([]any)
		if !ok {
			continue
		}
		rows := make([]map[string]any, 0, len(raw))
		for _, item := range raw {
			if row, ok := item.(map[string]any); ok {
				rows = append(rows, row)
			}
		}
		return rows
	}
	return nil
}

func stringValue(m map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			if s := valueString(value); s != "" {
				return s
			}
		}
	}
	return ""
}

func valueString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case float64:
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	default:
		data, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprint(v)
		}
		return string(data)
	}
}
