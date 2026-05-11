# TrimCP — Surgical Context MCP Server

TrimCP is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that gives AI assistants precise, relevant code snippets from your project instead of dumping entire files into context. It uses three signals — keyword search, semantic embeddings, and AST structure — to triangulate the exact lines most relevant to a query, then reranks them with a cross-encoder for maximum precision.

## How It Works

When you ask your AI assistant something like *"How does authentication work?"*, TrimCP runs three signals in parallel:

1. **Keyword Signal** — [ripgrep](https://github.com/BurntSushi/ripgrep) searches your source files for matching terms using word-boundary matching. Comments, docs, and `node_modules` are excluded. An AND-filter ensures only files containing *all* query keywords are surfaced.

2. **Semantic Signal** — Your project is indexed using [jina-embeddings-v2-base-code](https://huggingface.co/jinaai/jina-embeddings-v2-base-code), a model trained specifically on code with an 8192-token context window. TypeScript files are chunked by function/class boundaries (via ts-morph AST) rather than arbitrary line slices. Queries are expanded with a synonym map before embedding — "auth middleware" also searches for jwt, token, session, handler, etc.

3. **Structural Signal** — ts-morph parses your TypeScript AST to find function and class declarations whose identifiers match the query keywords.

Results from all three signals are **triangulated** with weighted scoring (structural: +2, semantic: up to +1.5, keyword: +1), then passed through a **cross-encoder reranker** (`ms-marco-MiniLM-L-6-v2`) that scores query-document pairs directly for final ordering.

The result is a tight, surgical slice of your codebase — not a firehose.

## Models Used

| Model | Purpose | Size |
|-------|---------|------|
| [jinaai/jina-embeddings-v2-base-code](https://huggingface.co/jinaai/jina-embeddings-v2-base-code) | Code-aware semantic embeddings (primary) | ~500MB |
| [Xenova/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) | General embeddings (fallback if Jina fails) | ~90MB |
| [Xenova/ms-marco-MiniLM-L-6-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L-6-v2) | Cross-encoder reranker | ~85MB |

All models run **locally** via [@xenova/transformers](https://github.com/xenova/transformers.js) — no API keys, no data sent to external servers. Models are downloaded on first use and cached automatically.

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- [ripgrep](https://github.com/BurntSushi/ripgrep#installation) (`rg`) on your PATH

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

> **First run note:** On the first query, embedding models (~500MB + ~85MB) will be downloaded and cached locally. Subsequent queries are fast. The server will log download progress to stderr.

## Connecting to Your AI Client

TrimCP runs as a stdio MCP server. Add it to your client's MCP configuration using the **absolute path** to `build/index.js`.

### Kiro / VS Code (`.kiro/settings/mcp.json`)

```json
{
  "mcpServers": {
    "trimcp": {
      "command": "node",
      "args": ["C:/absolute/path/to/trimcp/build/index.js"],
      "disabled": false,
      "autoApprove": ["get_surgical_context"]
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

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

> On Windows use forward slashes or escaped backslashes in the path.

## Usage

TrimCP exposes a single tool: **`get_surgical_context`**

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | ✅ | Natural language description of what you're looking for |
| `projectPath` | string | ✅ | Absolute path to the project root to search |

### Example Queries

In your AI chat:

> "Use get_surgical_context to find how user authentication is handled in `C:\projects\myapp`"

> "Search for the database connection setup in `/home/user/projects/api`"

> "Find the payment processing logic in my project at `C:\projects\ecommerce`"

### Example Response

```json
[
  {
    "file": "C:\\projects\\myapp\\src\\middleware\\auth.ts",
    "line": 12,
    "snippet": "export function requireAuth(req: Request, res: Response, next: NextFunction) {\n  const token = req.headers.authorization?.split(' ')[1];\n  if (!token) return res.status(401).json({ error: 'Unauthorized' });\n  ...",
    "score": 0.94
  },
  {
    "file": "C:\\projects\\myapp\\src\\services\\authService.ts",
    "line": 34,
    "snippet": "export async function verifyToken(token: string): Promise<User> {\n  const payload = jwt.verify(token, process.env.JWT_SECRET!);\n  ...",
    "score": 0.87
  }
]
```

If nothing relevant is found:
```
No results found for the given query in this project.
```

## What Gets Searched

TrimCP searches **source code only**. Automatically excluded:

- `node_modules/`, `build/`, `dist/`, `.git/`
- `*.d.ts` type declaration files
- `*.md`, `*.json`, `*.txt`, `*.lock`
- Pure comment lines (`//`, `/* */`, `#`)

Supported languages for keyword + semantic search: TypeScript, JavaScript, Python, Go, Rust, Java, C#, C/C++, Ruby.

Enhanced structural (AST) analysis is available for **TypeScript** projects.

## Project Structure

```
trimcp/
├── src/
│   ├── index.ts                      # MCP server entry point + startup checks
│   ├── triangulate.ts                # Weighted score intersection logic
│   ├── cache/
│   │   └── embeddingCache.ts         # Persistent embedding cache (mtime-aware)
│   ├── indexer/
│   │   ├── astChunker.ts             # AST-based chunking for TypeScript
│   │   ├── vectorIndex.ts            # Vector indexing, search, project registry
│   │   └── watcher.ts                # File system watcher for re-indexing
│   ├── signals/
│   │   ├── keyword.ts                # ripgrep keyword search
│   │   ├── semantic.ts               # Jina/MiniLM embeddings
│   │   ├── structure.ts              # ts-morph AST structural analysis
│   │   ├── reranker.ts               # Cross-encoder reranker
│   │   └── queryExpander.ts          # Synonym-based query expansion
│   └── tools/
│       └── getSurgicalContext.ts     # MCP tool handler
├── build/                            # Compiled output (after npm run build)
└── .trimcp/                          # Local embedding cache (auto-created, gitignored)
```

## Scoring & Ranking

```
Signal          Weight
─────────────────────────────────────────
Structural hit  +2.0   (AST identifier match — highest signal)
Semantic hit    +0–1.5 (proportional to cosine similarity)
Keyword hit     +1.0   (ripgrep word-boundary match)

Final ordering: cross-encoder reranker (ms-marco-MiniLM-L-6-v2)
```

## Known Limitations

- Structural AST analysis only works for TypeScript projects with a `src/` directory
- First query is slow while models download (~500MB total on first run)
- Large projects (10k+ files) will have a longer initial indexing time; subsequent queries use the cache
- `ripgrep` must be installed separately — it is not bundled

## Development

```bash
npm install
npm run build
node build/index.js   # test directly
```

## License

MIT
