# Bruno MCP Server

[![Tests](https://img.shields.io/badge/tests-362%20passing-success)](.)
[![Coverage](https://img.shields.io/badge/coverage-91.04%25-success)](.)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](.)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Model Context Protocol (MCP) server that integrates Bruno CLI for API testing and collection management. Execute API tests, validate collections, and generate reports through the Model Context Protocol.

## Features

- 🚀 **Run API Tests** - Execute individual requests or entire collections
- 🔍 **Request Introspection** - Inspect request details without execution
- ✅ **Validation** - Validate collections and environments
- 📊 **Report Generation** - JSON, JUnit XML, and HTML reports
- 🌍 **Environment Management** - List, validate, and switch environments
- 🔎 **Collection Discovery** - Recursive search for Bruno collections
- 🧪 **Dry Run Mode** - Validate without making HTTP calls
- 🔒 **Security** - Path validation, input sanitization, secret masking
- ⚡ **Performance** - Request caching and execution metrics
- 🏥 **Health Monitoring** - Server health checks with detailed diagnostics

## Quick Start

### Prerequisites
- Node.js 20 or higher
- Bruno collections (`.bru` files)

### Installation

#### Option 1: Using Claude MCP Add (Recommended)

**Basic Installation:**
```bash
claude mcp add --transport stdio bruno -- npx -y bruno-mcp-server
```

**Install Specific Version:**
```bash
claude mcp add --transport stdio bruno -- npx -y bruno-mcp-server@latest
```

**Project-Scoped Installation (for team projects):**
```bash
claude mcp add --transport stdio bruno --scope project -- npx -y bruno-mcp-server@latest
```

**Important Notes:**
- The `--transport stdio` flag is **required** for local npm packages
- The `--` separator is **required** to separate Claude CLI flags from the server command
- The `-y` flag automatically accepts npx prompts
- Use `--scope project` to store the configuration in your project instead of globally

This will automatically configure the MCP server in your Claude CLI configuration file.

#### Option 2: Manual Installation

```bash
npm install -g bruno-mcp-server
```

### Configuration

#### Manual Configuration (Skip if you used `claude mcp add`)

If you installed manually via npm, add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bruno": {
      "command": "npx",
      "args": ["bruno-mcp-server"]
    }
  }
}
```

## Available Tools

### 1. `bruno_run_request` - Execute a Single Request

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Get User",
  environment: "dev",           // optional
  envVariables: {               // optional
    "API_KEY": "your-key"
  },
  reporterJson: "./report.json",   // optional
  reporterJunit: "./report.xml",   // optional
  reporterHtml: "./report.html",   // optional
  dryRun: false                    // optional - validate only
})
```

### 2. `bruno_run_collection` - Execute a Collection

```typescript
bruno_run_collection({
  collectionPath: "/path/to/collection",
  environment: "dev",          // optional
  folderPath: "auth",          // optional - run specific folder
  envVariables: { },           // optional
  reporterJson: "./report.json",  // optional
  dryRun: false                   // optional
})
```

### 3. `bruno_list_requests` - List All Requests

```typescript
bruno_list_requests({
  collectionPath: "/path/to/collection"
})
```

### 4. `bruno_discover_collections` - Find Collections

```typescript
bruno_discover_collections({
  searchPath: "/path/to/workspace",
  maxDepth: 5  // optional (default: 5, max: 10)
})
```

### 5. `bruno_list_environments` - List Environments

```typescript
bruno_list_environments({
  collectionPath: "/path/to/collection"
})
```

### 6. `bruno_validate_environment` - Validate Environment

```typescript
bruno_validate_environment({
  collectionPath: "/path/to/collection",
  environmentName: "dev"
})
```

### 7. `bruno_get_request_details` - Inspect Request

```typescript
bruno_get_request_details({
  collectionPath: "/path/to/collection",
  requestName: "Create User"
})
```

### 8. `bruno_validate_collection` - Validate Collection

```typescript
bruno_validate_collection({
  collectionPath: "/path/to/collection"
})
```

### 9. `bruno_health_check` - Health Diagnostics

```typescript
bruno_health_check({
  includeMetrics: true,      // optional
  includeCacheStats: true    // optional
})
```

## Dry Run Mode

Validate request configuration without executing HTTP calls:

```typescript
bruno_run_request({
  collectionPath: "/path/to/collection",
  requestName: "Create User",
  dryRun: true
})
```

Output:
```
=== DRY RUN: Request Validation ===

✅ Request validated successfully (HTTP call not executed)

Request: Create User
Method: POST
URL: {{baseUrl}}/api/users

Configuration Summary:
  Headers: 2
  Body: json
  Auth: bearer
  Tests: 3

ℹ️  This was a dry run - no HTTP request was sent.
```

## Report Generation

Generate test reports in multiple formats:

```typescript
bruno_run_collection({
  collectionPath: "./my-api-tests",
  environment: "production",
  reporterJson: "./reports/results.json",
  reporterJunit: "./reports/results.xml",
  reporterHtml: "./reports/results.html"
})
```

- **JSON**: Detailed results for programmatic processing
- **JUnit XML**: CI/CD integration (Jenkins, GitHub Actions, GitLab CI)
- **HTML**: Interactive report with Vue.js interface

## Configuration

Create `bruno-mcp.config.json` in your project root or home directory:

```json
{
  "timeout": {
    "request": 30000,
    "collection": 120000
  },
  "retry": {
    "enabled": true,
    "maxAttempts": 3,
    "backoff": "exponential"
  },
  "security": {
    "allowedPaths": ["/path/to/collections"],
    "maskSecrets": true,
    "secretPatterns": ["password", "api[_-]?key", "token"]
  },
  "logging": {
    "level": "info",
    "format": "json"
  },
  "performance": {
    "cacheEnabled": true,
    "cacheTTL": 300000
  }
}
```

See [bruno-mcp.config.example.json](bruno-mcp.config.example.json) for all options.

## Development

```bash
# Clone repository
git clone https://github.com/jcr82/bruno-mcp-server.git
cd bruno-mcp-server

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run in development
npm run dev
```

## Project Structure

```
bruno-mcp-server/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── bruno-cli.ts          # Bruno CLI wrapper
│   ├── config.ts             # Configuration management
│   ├── security.ts           # Security utilities
│   ├── performance.ts        # Caching and metrics
│   ├── logger.ts             # Logging system
│   ├── di/                   # Dependency injection
│   ├── services/             # Business logic services
│   ├── tools/
│   │   ├── handlers/         # MCP tool handlers (9 tools)
│   │   └── formatters/       # Output formatters
│   └── __tests__/            # Test suites
│       ├── unit/             # Unit tests (100% handler coverage)
│       ├── integration/      # Integration tests
│       └── e2e/              # End-to-end workflow tests
├── dist/                     # Compiled output
└── bruno-mcp.config.json     # Configuration file
```

## Test Coverage

- **Overall Coverage**: 91.04%
- **Handler Coverage**: 99.72% (9/9 handlers)
- **Formatter Coverage**: 98.74%
- **Total Tests**: 362 passing
- **Test Types**: Unit, Integration, E2E

## Security Features

- **Path Validation**: Prevents directory traversal attacks
- **Input Sanitization**: Protects against command injection
- **Secret Masking**: Automatically masks sensitive data in logs
- **Environment Validation**: Validates variables for safe characters

## Troubleshooting

### Installation Issues

**Error: "missing required argument 'commandOrUrl'"**
- Make sure you include `--transport stdio` and `--` separator
- Correct: `claude mcp add --transport stdio bruno -- npx -y bruno-mcp-server`
- Wrong: `claude mcp add bruno-mcp-server`

**MCP Server Not Showing Up in Claude**
1. Verify installation: `cat ~/.claude.json` (or project's `.claude.json` if using `--scope project`)
2. Restart Claude Desktop/CLI after installation
3. Check the server is configured correctly in the JSON file

**npx Prompts During Installation**
- Always use the `-y` flag: `npx -y bruno-mcp-server`
- This auto-accepts installation prompts

### Bruno CLI Not Found
```bash
# Verify Bruno CLI installation
npx bru --version

# Server uses local installation in node_modules/.bin/bru
```

### Collection Not Found
- Use absolute paths
- Verify `bruno.json` exists in collection directory
- Check file permissions

### Permission Issues
- Ensure read access to Bruno collections
- Verify server can execute Bruno CLI

## Documentation

- [Getting Started Guide](docs/guides/getting-started.md)
- [Configuration Reference](docs/guides/configuration.md)
- [Usage Patterns](docs/guides/usage-patterns.md)
- [Troubleshooting Guide](docs/guides/troubleshooting.md)
- [CI/CD Integration](docs/guides/ci-cd-integration.md)
- [MCP Tools API Reference](docs/api/tools.md)

## Contributing

Contributions welcome! Please submit issues or pull requests.

## License

MIT © Juan Ruiz

## Links

- [GitHub Repository](https://github.com/jcr82/bruno-mcp-server)
- [Issue Tracker](https://github.com/jcr82/bruno-mcp-server/issues)
- [Bruno CLI Documentation](https://docs.usebruno.com/cli/overview)
- [Model Context Protocol](https://modelcontextprotocol.io)
