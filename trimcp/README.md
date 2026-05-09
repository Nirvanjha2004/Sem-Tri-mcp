# TrimCP - Surgical Triangulation MCP Server

A **Model Context Protocol (MCP)** server that provides intelligent, surgical code context retrieval by combining three complementary search signals: **keyword matching**, **semantic embeddings**, and **structural analysis**. This enables AI-powered tools and agents to pinpoint the most relevant code snippets with precision.

## 🎯 Overview

TrimCP solves the problem of retrieving relevant code context in large codebases. Instead of relying on a single search strategy, it triangulates across:

1. **Keyword Search** - Fast pattern matching using ripgrep for exact term matches
2. **Semantic Search** - Deep learning embeddings that capture meaning and intent
3. **Structural Analysis** - AST-based detection of function/class declarations

By combining these three signals, TrimCP identifies intersections where multiple search methods agree, resulting in highly accurate, surgical code context extraction.

## ✨ Key Features

- **Triangulation-Based Ranking** - Combines multiple search signals with intelligent weighting
- **Semantic Understanding** - Uses transformers for meaning-based code search
- **Fast Keyword Matching** - Leverages ripgrep for instant pattern matching
- **Structural Awareness** - Parses TypeScript AST to understand code organization
- **Intelligent Caching** - Embedding cache with mtime-based invalidation
- **MCP Integration** - Standard Model Context Protocol interface for LLM integration
- **Chunked Processing** - Handles large files with overlapping chunks for continuity

## 📋 Architecture

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
│       └── getSurgicalContext.ts   # Main MCP tool definition
├── build/                          # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **MCP SDK**: `@modelcontextprotocol/sdk` - Protocol integration
- **Embeddings**: `@xenova/transformers` - Semantic search with Xenova/all-MiniLM-L6-v2
- **Search**: ripgrep (external) - Fast keyword matching
- **AST Parsing**: `ts-morph` - TypeScript syntax tree analysis
- **File Watching**: chokidar - Reactive cache invalidation

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 16.0.0
- **ripgrep** (`rg`) - [Install ripgrep](https://github.com/BurntSushi/ripgrep#installation)
- TypeScript knowledge recommended but not required

### Installation

```bash
# Clone the repository
git clone https://github.com/Nirvanjha2004/Sem-Tri-mcp.git
cd trimcp

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Configuration

Before running, ensure ripgrep is available in your PATH:

```bash
# Verify ripgrep installation
rg --version
```

If not installed:
- **macOS**: `brew install ripgrep`
- **Windows**: `choco install ripgrep` or download from [GitHub releases](https://github.com/BurntSushi/ripgrep#installation)
- **Linux**: `sudo apt-get install ripgrep` (Ubuntu/Debian)

## 📖 Usage

### As an MCP Server

Start the server:

```bash
npm start
```

The server listens on stdio and exposes the `get_surgical_context` tool.

### Tool: `get_surgical_context`

**Purpose**: Retrieve relevant code context using triangulation.

**Input Parameters**:
```typescript
{
  query: string           // Search query (e.g., "authentication handler")
  projectPath: string     // Absolute path to the project root
}
```

**Response**:
```typescript
{
  content: [
    {
      type: "text",
      text: JSON.stringify([
        {
          file: "/path/to/file.ts",
          snippet: "... code context with 5 lines before and 10 after match ..."
        },
        // Up to 10 most relevant results
      ])
    }
  ]
}
```

### Example Usage (Programmatic)

```typescript
import { getSurgicalContextTool } from "./tools/getSurgicalContext.js";

const results = await getSurgicalContextTool.handler({
  query: "JWT verification",
  projectPath: "/path/to/project"
});

console.log(results);
```

## 🧠 How Triangulation Works

### Signal Processing

1. **Keyword Signal** - `keyword.ts`
   - Uses ripgrep to find all lines matching search terms
   - Returns file paths and line numbers

2. **Semantic Signal** - `semantic.ts`
   - Embeds query using Xenova/all-MiniLM-L6-v2
   - Caches embeddings for efficiency
   - Computes cosine similarity between query and code chunks

3. **Structural Signal** - `structure.ts`
   - Parses all TypeScript files via ts-morph
   - Finds function/class declarations matching keywords
   - Returns high-signal structural matches

### Scoring & Ranking

The `triangulate()` function in `triangulate.ts` combines signals:

```
- Each keyword hit: +1 point
- Each structural hit: +2 points (higher signal)
- Results ranked by total score
- Top 10 results returned
```

Intersections (matches from multiple signals) receive higher scores, ensuring precision.

## 💾 Caching Strategy

The embedding cache (`cache/`) stores:

```typescript
{
  "file/path.ts": {
    mtime: 1234567890,      // File modification time
    chunks: [
      { text: "...", embedding: [...] },
      { text: "...", embedding: [...] }
    ]
  }
}
```

**Cache Invalidation**:
- Automatic when file's mtime changes
- Located at `.trimcp/cache.json` in project root
- Prevents recomputing embeddings for unchanged files

## 🔍 Signal Weights & Tuning

Current weights (in `triangulate.ts`):
- Keyword match: **1 point**
- Structural match: **2 points**

To adjust relevance, modify the weights in `triangulate()`:

```typescript
keywordHits.forEach(h => {
  scores.set(key, (scores.get(key) || 0) + 1);  // ← Adjust this
});

structuralHits.forEach(h => {
  scores.set(key, (scores.get(key) || 0) + 2);  // ← Or this
});
```

## 🧪 Development

### Build

```bash
npm run build
```

Compiles TypeScript from `src/` to `build/`.

### Environment Variables

Create a `.env` file for configuration (optional):

```env
LOG_LEVEL=debug
CACHE_DIR=.trimcp
MAX_RESULTS=10
```

Currently unused but ready for expansion.

### Project Structure Best Practices

- Keep search queries between 2-5 words for best results
- Use specific domain terminology for semantic search
- Structural search works best with exact function/class names
- Large codebases benefit from embedding caching

## 🤝 Integration with LLM Tools

TrimCP is designed for integration with Claude, GPT-4, or other LLMs via MCP:

1. **Configure MCP Client**: Point your LLM client to this server's stdio
2. **Use `get_surgical_context`**: Call the tool with user queries
3. **Inject Context**: Feed returned snippets into LLM prompts
4. **Iterative Refinement**: Refine queries based on LLM feedback

Example integration pattern:
```
User Query 
  ↓
LLM receives query via `get_surgical_context`
  ↓
TrimCP returns surgical code snippets
  ↓
LLM analyzes + responds with code-aware answer
```

## 📊 Performance Notes

- **Keyword Search**: O(n) with ripgrep (typically <100ms)
- **Semantic Search**: O(n·m) where n=files, m=chunks (first run cached after)
- **Structural Analysis**: O(n) with ts-morph for all TypeScript files
- **Embedding Cache**: Reduces semantic search time from ~5s to <500ms on cached projects

For large codebases (10k+ files), consider:
- Limiting project scope in queries
- Pre-warming the cache on startup
- Using ripgrep filters to exclude directories

## 🐛 Troubleshooting

### "rg: command not found"
Ensure ripgrep is installed and in your PATH. See [Prerequisites](#prerequisites).

### Embedding cache growing large
Delete `.trimcp/cache.json` to start fresh:
```bash
rm -rf .trimcp/cache.json
```

### Slow semantic searches on first run
The embeddings model (~130MB) downloads on first use. Subsequent searches use cache.

### No results returned
- Verify `projectPath` exists and is absolute
- Check that the project contains TypeScript files
- Try broadening your search query

## 📝 License

[Specify your license here]

## 🙋 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with description

## 📞 Support

For issues, questions, or feature requests, please open a GitHub issue.

---

**Built with precision for surgical code retrieval** 🔬
