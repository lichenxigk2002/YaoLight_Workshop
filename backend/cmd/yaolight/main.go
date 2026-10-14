package main

import (
	"bufio"
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
	case "mcp":
		return runMCP(args[1:])
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
  yaolight mcp tokens create --name "Codex" [--expires-in-days 90] [--scopes projects:read,workflows:read,tasks:read,artifacts:read,knowledge:read,models:read]
  yaolight mcp tokens list [--json]
  yaolight mcp tokens revoke <id>
  yaolight mcp serve
  yaolight api get /projects?page=1&pageSize=20

Environment:
  YAOLIGHT_BASE_URL  Overrides saved base URL
  YAOLIGHT_TOKEN     Overrides saved token
  YAOLIGHT_MCP_TOKEN Overrides token for mcp serve / mcp tool calls
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

func runMCP(args []string) error {
	if len(args) == 0 {
		return errors.New("mcp needs a subcommand: tokens, tools, or serve")
	}
	switch args[0] {
	case "tokens":
		return runMCPTokens(args[1:])
	case "tools":
		return runMCPTools(args[1:])
	case "serve":
		return runMCPServe(args[1:])
	default:
		return fmt.Errorf("unknown mcp subcommand %q", args[0])
	}
}

func runMCPTokens(args []string) error {
	if len(args) == 0 {
		return errors.New("mcp tokens needs a subcommand: create, list, or revoke")
	}
	switch args[0] {
	case "create":
		fs := flag.NewFlagSet("mcp tokens create", flag.ContinueOnError)
		name := fs.String("name", "YaoLight MCP Token", "token name")
		expiresInDays := fs.Int("expires-in-days", 90, "token lifetime in days")
		scopesRaw := fs.String("scopes", strings.Join([]string{"projects:read", "workflows:read", "tasks:read", "artifacts:read", "knowledge:read", "models:read"}, ","), "comma separated scopes")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		body := map[string]any{
			"name":            *name,
			"expires_in_days": *expiresInDays,
			"scopes":          splitCSV(*scopesRaw),
		}
		c, err := configuredClient()
		if err != nil {
			return err
		}
		data, err := c.do(http.MethodPost, "/mcp/tokens", nil, body, true)
		if err != nil {
			return err
		}
		return printRawJSON(data)
	case "list":
		fs := flag.NewFlagSet("mcp tokens list", flag.ContinueOnError)
		jsonOut := fs.Bool("json", false, "print JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		data, err := configuredGet("/mcp/tokens", nil)
		if err != nil {
			return err
		}
		if *jsonOut {
			return printRawJSON(data)
		}
		var rows []map[string]any
		if err := json.Unmarshal(data, &rows); err != nil {
			return printRawJSON(data)
		}
		printTable(rows, []string{"id", "name", "token_prefix", "scopes", "expires_at", "revoked_at", "last_used_at"})
		return nil
	case "revoke":
		fs := flag.NewFlagSet("mcp tokens revoke", flag.ContinueOnError)
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 1 {
			return errors.New("mcp tokens revoke requires an id")
		}
		c, err := configuredClient()
		if err != nil {
			return err
		}
		if _, err := c.do(http.MethodDelete, "/mcp/tokens/"+fs.Arg(0), nil, nil, true); err != nil {
			return err
		}
		fmt.Println("revoked")
		return nil
	default:
		return fmt.Errorf("unknown mcp tokens subcommand %q", args[0])
	}
}

func runMCPTools(args []string) error {
	if len(args) == 0 {
		return errors.New("mcp tools needs a subcommand: list or call")
	}
	switch args[0] {
	case "list":
		data, err := configuredMCPGet("/mcp/tools", nil)
		if err != nil {
			return err
		}
		return printRawJSON(data)
	case "call":
		fs := flag.NewFlagSet("mcp tools call", flag.ContinueOnError)
		argsJSON := fs.String("args", "{}", "tool arguments as JSON")
		if err := fs.Parse(args[1:]); err != nil {
			return err
		}
		if fs.NArg() != 1 {
			return errors.New("mcp tools call requires a tool name")
		}
		var arguments map[string]any
		if err := json.Unmarshal([]byte(*argsJSON), &arguments); err != nil {
			return err
		}
		data, err := callMCPTool(fs.Arg(0), arguments)
		if err != nil {
			return err
		}
		return printRawJSON(data)
	default:
		return fmt.Errorf("unknown mcp tools subcommand %q", args[0])
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

func configuredMCPGet(path string, q url.Values) (json.RawMessage, error) {
	c, err := configuredClient()
	if err != nil {
		return nil, err
	}
	if token := strings.TrimSpace(os.Getenv("YAOLIGHT_MCP_TOKEN")); token != "" {
		c.token = token
	}
	return c.do(http.MethodGet, path, q, nil, true)
}

func configuredMCPPost(path string, body any) (json.RawMessage, error) {
	c, err := configuredClient()
	if err != nil {
		return nil, err
	}
	if token := strings.TrimSpace(os.Getenv("YAOLIGHT_MCP_TOKEN")); token != "" {
		c.token = token
	}
	return c.do(http.MethodPost, path, nil, body, true)
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

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			values = append(values, part)
		}
	}
	return values
}

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string    `json:"jsonrpc"`
	ID      any       `json:"id,omitempty"`
	Result  any       `json:"result,omitempty"`
	Error   *rpcError `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func runMCPServe(args []string) error {
	fs := flag.NewFlagSet("mcp serve", flag.ContinueOnError)
	if err := fs.Parse(args); err != nil {
		return err
	}

	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var req rpcRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			writeRPCError(nil, -32700, "parse error")
			continue
		}
		if len(req.ID) == 0 {
			continue
		}
		handleMCPRPC(req)
	}
	return scanner.Err()
}

func handleMCPRPC(req rpcRequest) {
	switch req.Method {
	case "initialize":
		writeRPCResult(req.ID, map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
			"serverInfo": map[string]any{
				"name":    "yaolight-mcp",
				"version": "0.1.0",
			},
		})
	case "tools/list":
		writeRPCResult(req.ID, map[string]any{"tools": mcpToolDefinitions()})
	case "tools/call":
		var params struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			writeRPCError(req.ID, -32602, "invalid tool call params")
			return
		}
		data, err := callMCPTool(params.Name, params.Arguments)
		if err != nil {
			writeRPCError(req.ID, -32000, err.Error())
			return
		}
		writeRPCResult(req.ID, map[string]any{
			"content": []map[string]string{
				{"type": "text", "text": string(mustIndentJSON(data))},
			},
		})
	default:
		writeRPCError(req.ID, -32601, "method not found")
	}
}

func callMCPTool(name string, arguments map[string]any) (json.RawMessage, error) {
	switch name {
	case "run_workflow":
		id, err := requiredArg(arguments, "id")
		if err != nil {
			return nil, err
		}
		return configuredMCPPost("/mcp/tools/workflows/"+id+"/run", map[string]any{
			"confirmed":    boolArg(arguments, "confirmed"),
			"runtimeInput": arguments["runtimeInput"],
		})
	case "cancel_task":
		id, err := requiredArg(arguments, "id")
		if err != nil {
			return nil, err
		}
		return configuredMCPPost("/mcp/tools/tasks/"+id+"/cancel", map[string]any{"confirmed": boolArg(arguments, "confirmed")})
	case "retry_task":
		id, err := requiredArg(arguments, "id")
		if err != nil {
			return nil, err
		}
		return configuredMCPPost("/mcp/tools/tasks/"+id+"/retry", map[string]any{"confirmed": boolArg(arguments, "confirmed")})
	}
	path, q, err := mcpToolPath(name, arguments)
	if err != nil {
		return nil, err
	}
	return configuredMCPGet(path, q)
}

func mcpToolPath(name string, arguments map[string]any) (string, url.Values, error) {
	q := url.Values{}
	switch name {
	case "get_current_user":
		return "/mcp/tools/current-user", q, nil
	case "list_projects":
		addPageArgs(q, arguments)
		return "/mcp/tools/projects", q, nil
	case "get_project":
		id, err := requiredArg(arguments, "id")
		return "/mcp/tools/projects/" + id, q, err
	case "list_workflows":
		addPageArgs(q, arguments)
		if projectID := stringArg(arguments, "projectId"); projectID != "" {
			q.Set("projectId", projectID)
		}
		return "/mcp/tools/workflows", q, nil
	case "get_workflow":
		id, err := requiredArg(arguments, "id")
		return "/mcp/tools/workflows/" + id, q, err
	case "get_workflow_nodes":
		id, err := requiredArg(arguments, "id")
		return "/mcp/tools/workflows/" + id + "/nodes", q, err
	case "get_task":
		id, err := requiredArg(arguments, "id")
		return "/mcp/tools/tasks/" + id, q, err
	case "get_task_logs":
		id, err := requiredArg(arguments, "id")
		addPageArgs(q, arguments)
		if limit := stringArg(arguments, "limit"); limit != "" {
			q.Set("limit", limit)
		}
		if level := stringArg(arguments, "level"); level != "" {
			q.Set("level", level)
		}
		return "/mcp/tools/tasks/" + id + "/logs", q, err
	case "get_task_node_executions":
		id, err := requiredArg(arguments, "id")
		return "/mcp/tools/tasks/" + id + "/node-executions", q, err
	case "list_task_artifacts":
		id, err := requiredArg(arguments, "id")
		addPageArgs(q, arguments)
		return "/mcp/tools/tasks/" + id + "/artifacts", q, err
	case "list_project_artifacts":
		id, err := requiredArg(arguments, "id")
		addPageArgs(q, arguments)
		if keyword := stringArg(arguments, "keyword"); keyword != "" {
			q.Set("keyword", keyword)
		}
		if kind := stringArg(arguments, "kind"); kind != "" {
			q.Set("kind", kind)
		}
		return "/mcp/tools/projects/" + id + "/artifacts", q, err
	case "search_project_knowledge":
		id, err := requiredArg(arguments, "id")
		if query := stringArg(arguments, "query"); query != "" {
			q.Set("query", query)
		}
		if limit := stringArg(arguments, "limit"); limit != "" {
			q.Set("limit", limit)
		}
		return "/mcp/tools/projects/" + id + "/knowledge/search", q, err
	case "list_available_models":
		addPageArgs(q, arguments)
		return "/mcp/tools/models", q, nil
	default:
		return "", nil, fmt.Errorf("unknown MCP tool %q", name)
	}
}

func addPageArgs(q url.Values, arguments map[string]any) {
	if page := stringArg(arguments, "page"); page != "" {
		q.Set("page", page)
	}
	if pageSize := stringArg(arguments, "pageSize"); pageSize != "" {
		q.Set("pageSize", pageSize)
	}
}

func requiredArg(arguments map[string]any, key string) (string, error) {
	value := stringArg(arguments, key)
	if value == "" {
		return "", fmt.Errorf("missing required argument %q", key)
	}
	return value, nil
}

func stringArg(arguments map[string]any, key string) string {
	value, ok := arguments[key]
	if !ok || value == nil {
		return ""
	}
	return valueString(value)
}

func boolArg(arguments map[string]any, key string) bool {
	value, ok := arguments[key]
	if !ok || value == nil {
		return false
	}
	switch v := value.(type) {
	case bool:
		return v
	case string:
		parsed, _ := strconv.ParseBool(v)
		return parsed
	default:
		return false
	}
}

func mcpToolDefinitions() []map[string]any {
	return []map[string]any{
		toolDef("get_current_user", "Get the current YaoLight user.", map[string]any{}),
		toolDef("list_projects", "List projects visible to the current user.", pagedSchema(nil)),
		toolDef("get_project", "Get one project by id.", idSchema()),
		toolDef("list_workflows", "List workflows visible to the current user.", pagedSchema(map[string]any{"projectId": stringProperty("Project id filter.")})),
		toolDef("get_workflow", "Get one workflow by id.", idSchema()),
		toolDef("get_workflow_nodes", "Get workflow nodes, edges, and comment cards.", idSchema()),
		toolDef("get_task", "Get one task by id.", idSchema()),
		toolDef("get_task_logs", "Get logs for a task.", pagedSchema(map[string]any{
			"id":    stringProperty("Task id."),
			"limit": stringProperty("Maximum logs to return."),
			"level": stringProperty("Optional log level filter."),
		})),
		toolDef("get_task_node_executions", "Get node execution summaries for a task.", idSchema()),
		toolDef("list_task_artifacts", "List artifacts generated by a task.", pagedSchema(map[string]any{
			"id": stringProperty("Task id."),
		})),
		toolDef("list_project_artifacts", "List artifacts in a project.", pagedSchema(map[string]any{
			"id":      stringProperty("Project id."),
			"keyword": stringProperty("Optional artifact search keyword."),
			"kind":    stringProperty("Optional artifact kind filter."),
		})),
		toolDef("search_project_knowledge", "Search active knowledge available to a project.", map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":    stringProperty("Project id."),
				"query": stringProperty("Search text."),
				"limit": stringProperty("Maximum results."),
			},
			"required": []string{"id", "query"},
		}),
		toolDef("list_available_models", "List current user's models and system preset models.", pagedSchema(nil)),
		toolDef("run_workflow", "Run a workflow after explicit confirmation.", map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":           stringProperty("Workflow id."),
				"confirmed":    booleanProperty("Must be true after the user confirms the workflow and input."),
				"runtimeInput": map[string]any{"description": "Optional runtime input payload."},
			},
			"required": []string{"id", "confirmed"},
		}),
		toolDef("cancel_task", "Cancel a pending, queued, running, or paused task after explicit confirmation.", map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":        stringProperty("Task id."),
				"confirmed": booleanProperty("Must be true after the user confirms cancellation."),
			},
			"required": []string{"id", "confirmed"},
		}),
		toolDef("retry_task", "Retry a failed, timed out, or cancelled task after explicit confirmation.", map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":        stringProperty("Task id."),
				"confirmed": booleanProperty("Must be true after the user confirms retry."),
			},
			"required": []string{"id", "confirmed"},
		}),
	}
}

func toolDef(name, description string, inputSchema map[string]any) map[string]any {
	return map[string]any{"name": name, "description": description, "inputSchema": inputSchema}
}

func idSchema() map[string]any {
	return map[string]any{
		"type":       "object",
		"properties": map[string]any{"id": stringProperty("Resource id.")},
		"required":   []string{"id"},
	}
}

func pagedSchema(extra map[string]any) map[string]any {
	properties := map[string]any{
		"page":     stringProperty("Page number."),
		"pageSize": stringProperty("Page size."),
	}
	required := []string{}
	for key, value := range extra {
		properties[key] = value
		if key == "id" {
			required = append(required, key)
		}
	}
	return map[string]any{"type": "object", "properties": properties, "required": required}
}

func stringProperty(description string) map[string]any {
	return map[string]any{"type": "string", "description": description}
}

func booleanProperty(description string) map[string]any {
	return map[string]any{"type": "boolean", "description": description}
}

func writeRPCResult(id json.RawMessage, result any) {
	writeRPC(rpcResponse{JSONRPC: "2.0", ID: rawID(id), Result: result})
}

func writeRPCError(id json.RawMessage, code int, message string) {
	writeRPC(rpcResponse{JSONRPC: "2.0", ID: rawID(id), Error: &rpcError{Code: code, Message: message}})
}

func writeRPC(resp rpcResponse) {
	data, _ := json.Marshal(resp)
	fmt.Println(string(data))
}

func rawID(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	var id any
	if err := json.Unmarshal(raw, &id); err != nil {
		return nil
	}
	return id
}

func mustIndentJSON(data []byte) []byte {
	var v any
	if err := json.Unmarshal(data, &v); err != nil {
		return data
	}
	pretty, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return data
	}
	return pretty
}
