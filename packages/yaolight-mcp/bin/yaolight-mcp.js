#!/usr/bin/env node

const { spawn } = require('node:child_process');

const command = process.env.YAOLIGHT_CLI || 'yaolight';
const child = spawn(command, ['mcp', 'serve'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  console.error(`Failed to start ${command} mcp serve: ${error.message}`);
  console.error('Install or build the YaoLight CLI first, or set YAOLIGHT_CLI to its absolute path.');
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
