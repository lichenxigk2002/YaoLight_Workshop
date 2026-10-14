# YaoLight CLI

YaoLight CLI is a small command-line entry point for humans and AI agents to inspect a YaoLight instance through the existing HTTP API.

## Build

```bash
cd backend
go build -o yaolight ./cmd/yaolight
```

## Configure

```bash
./yaolight config set --base-url http://localhost:8080/api
./yaolight login --username your-user --password your-password
```

`--base-url` accepts either the API root (`http://localhost:8080/api`) or the server root (`http://localhost:8080`).

You can also use environment variables:

```bash
export YAOLIGHT_BASE_URL=http://localhost:8080/api
export YAOLIGHT_TOKEN=your-jwt-token
```

For MCP client usage, use a dedicated MCP token:

```bash
export YAOLIGHT_BASE_URL=http://localhost:8080/api
export YAOLIGHT_MCP_TOKEN=yl_mcp_xxx
./yaolight mcp serve
```

If using the npm launcher package from this repository:

```bash
YAOLIGHT_CLI=/absolute/path/to/yaolight npx ./packages/yaolight-mcp
```

## Commands

```bash
./yaolight me
./yaolight projects list --page 1 --page-size 20
./yaolight projects get 1 --json
./yaolight workflows list --project-id 1
./yaolight workflows get 1 --nodes --json
./yaolight tasks get 1 --json
./yaolight tasks logs 1 --limit 100
./yaolight mcp tokens create --name Codex
./yaolight mcp tools list
./yaolight mcp serve
./yaolight api get '/projects?page=1&pageSize=20'
```

## AI Tooling Direction

This CLI is intentionally read-heavy and low-risk. It can become the execution layer for a future MCP server where each command maps to a structured AI tool, such as `list_projects`, `get_workflow`, `get_task_logs`, and `api_get`.
