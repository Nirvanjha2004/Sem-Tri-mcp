# TrimCP — Surgical Context MCP Server

TrimCP is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that gives AI assistants precise, relevant code snippets from your project instead of dumping entire files into context. It uses three signals — keyword search, semantic embeddings, and AST structure — to triangulate the exact lines most relevant to a query.

## How It Works

When you ask your AI assistant something like *"How does authentication work?"*, TrimCP:

1. **Keyword Signal** — runs [ripgrep](https://github.com/BurntSushi/ripgrep) across your source files to find lines matching your query terms (comments and docs excluded)
2. **Structural Signal** — parses your TypeScript source with [ts-morph](https://ts-morph.com) to find function and class declarations whose names match the query
3. **Triangulation** — scores and ranks results by how many signals agree, returning the top 10 most relevant snippets with surrounding context

The result is a tight, surgical slice of your codebase — not a firehose.

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- [ripgrep](https://github.com/BurntSushi/ripgrep#installation) (`rg`) available on your PATH

### Installing ripgrep

| Platform | Command |
|----------|---------|
| macOS | `brew install ripgrep` |
| Windows | `winget install BurntSushi.ripgrep.MSVC` or `choco install ripgrep` |
| Ubuntu/Debian | `sudo apt install ripgrep` |
| Arch Linux | `sudo pacman -S ripgrep` |

Verify with: `rg --version`

## Installation

```bash
git clone https://github.com/your-username/trimcp.git
cd trimcp
npm install
npm run build
```

## Connecting to Your AI Client

TrimCP runs as a stdio MCP server. Add it to your client's MCP configuration.

### Kiro / VS Code (via `.kiro/settings/mcp.json`)

```json
{
  "mcpServers": {
    "trimcp": {
      "command": "node",
      "args": ["C:/path/to/trimcp/build/index.js"],
      "disabled": false,
      "autoApprove": ["get_surgical_context"]
    }
  }
}
```

### Claude Desktop (via `claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "trimcp": {
      "command": "node",
      "args": ["/absolute/path/to/trimcp/build/index.js"]
    }
  }
}
```

> Use the absolute path to `build/index.js`. On Windows use forward slashes or escaped backslashes.

## Usage

Once connected, TrimCP exposes a single tool: **`get_surgical_context`**.

### Tool Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Natural language description of what you're looking for |
| `projectPath` | string | ✅ | Absolute path to the project you want to search |

### Example Queries

**In your AI chat, you can say:**

> "Use get_surgical_context to find how user authentication is handled in `C:\projects\myapp`"

> "Search for the database connection setup in `/home/user/projects/api`"

> "Find the payment processing logic in my project at `C:\projects\ecommerce`"

### Direct Tool Call (MCP Inspector)

```json
{
  "query": "user authentication middleware",
  "projectPath": "C:\\Users\\you\\projects\\myapp"
}
```

### Example Response

```json
[
  {
    "file": "C:\\projects\\myapp\\src\\middleware\\auth.ts",
    "snippet": "export function requireAuth(req: Request, res: Response, next: NextFunction) {\n  const token = req.headers.authorization?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'Unauthorized' });\n  ..."
  },
  {
    "file": "C:\\projects\\myapp\\src\\services\\authService.ts",
    "snippet": "export async function verifyToken(token: string): Promise<User> {\n  const payload = jwt.verify(token, process.env.JWT_SECRET!);\n  ..."
  }
]
```

If nothing relevant is found, the tool returns:
```
No results found for the given query in this project.
```

## What Gets Searched

TrimCP searches **source code only**. The following are automatically excluded:

- `node_modules/`, `build/`, `dist/`
- `*.d.ts` type declaration files
- `*.md`, `*.json`, `*.txt`, `*.lock` documentation and config files
- Pure comment lines (`//`, `/* */`, `#`)

Currently supports any language ripgrep can search, with enhanced structural analysis for **TypeScript** projects that have a `src/` directory.

## Project Structure

```
trimcp/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── triangulate.ts              # Score intersection logic
│   ├── cache/
│   │   └── embeddingCache.ts       # Semantic embedding cache
│   ├── indexer/
│   │   ├── vectorIndex.ts          # Vector indexing & search
│   │   └── watcher.ts              # File system watcher
│   ├── signals/
│   │   ├── keyword.ts              # ripgrep-based keyword search
│   │   ├── semantic.ts             # Transformers-based embeddings
│   │   └── structure.ts            # ts-morph AST analysis
│   └── tools/
│       └── getSurgicalContext.ts   # MCP tool handler
├── build/                          # Compiled output (after npm run build)
└── .trimcp/                        # Cache directory (auto-created)
```

## Known Limitations

- **TypeScript projects only** for structural (AST) analysis — the keyword signal works for any language
- **ripgrep must be installed separately** — it is not bundled
- Semantic (embedding) search is implemented but not yet wired into the active query pipeline
- Best results on projects with a `src/` directory layout

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run directly
node build/index.js
```

To test with the MCP Inspector, run the server and connect via stdio transport pointing to `build/index.js`.

## License

MIT
