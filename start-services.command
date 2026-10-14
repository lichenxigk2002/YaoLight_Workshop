#!/bin/bash

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

print_header() {
  echo "========================================"
  echo "  Start Backend, Frontend, Admin"
  echo "========================================"
  echo
}

is_port_in_use() {
  local port="$1"
  lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
}

open_terminal_service() {
  local service_name="$1"
  local workdir="$2"
  local command="$3"

  osascript <<EOF
tell application "Terminal"
  activate
  do script "cd $(printf '%q' "$workdir") && $command"
  set custom title of front window to "$service_name"
end tell
EOF
}

start_service() {
  local step_label="$1"
  local service_name="$2"
  local port="$3"
  local workdir="$4"
  local command="$5"

  if is_port_in_use "$port"; then
    echo "[$step_label] $service_name on $port"
    echo "      Warning: port $port is already in use."
  else
    echo "[$step_label] Starting $service_name on $port..."
    open_terminal_service "$service_name" "$workdir" "$command"
    sleep 2
    echo "      $service_name started."
  fi

  echo
}

print_header

start_service "1/3" "Backend" "8080" "$SCRIPT_DIR/backend" "go run cmd/server/main.go"
start_service "2/3" "Frontend" "3000" "$SCRIPT_DIR/frontend" "npm run dev"
start_service "3/3" "Admin" "3200" "$SCRIPT_DIR/admin-frontend" "npm run dev"

echo "========================================"
echo "  All services processed"
echo "========================================"
echo
echo "Backend : http://localhost:8080"
echo "Frontend: http://localhost:3000"
echo "Admin   : http://localhost:3200/admin/"
echo
echo "If macOS blocks execution, run:"
echo "chmod +x \"$SCRIPT_DIR/start-services.command\""
echo
read -r -p "Press Enter to close this window..."
