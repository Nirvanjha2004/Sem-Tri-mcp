/**
 * Query expansion: enriches a query with related programming terms
 * so that "auth middleware" also finds "jwt", "token", "verify", etc.
 *
 * This is a static synonym map — no LLM call needed, zero latency.
 * The expanded terms are appended to the original query before embedding,
 * giving the semantic signal a broader surface to match against.
 */

const SYNONYM_MAP: Record<string, string[]> = {
  // Auth / security
  auth: ["authentication", "authorization", "jwt", "token", "session", "login", "verify", "passport", "oauth"],
  authentication: ["auth", "login", "jwt", "token", "session", "verify", "credentials"],
  authorization: ["auth", "permission", "role", "access", "guard", "policy", "acl"],
  login: ["auth", "signin", "authenticate", "credentials", "session"],
  password: ["hash", "bcrypt", "salt", "encrypt", "credentials", "secret"],
  token: ["jwt", "bearer", "refresh", "access", "session", "cookie"],

  // Database
  database: ["db", "query", "connection", "pool", "orm", "schema", "migration"],
  query: ["sql", "select", "insert", "update", "delete", "fetch", "find"],
  connection: ["connect", "pool", "client", "driver", "datasource"],
  migration: ["schema", "alter", "table", "column", "seed", "rollback"],
  prisma: ["orm", "database", "schema", "query", "model", "client"],
  mongoose: ["mongodb", "schema", "model", "document", "collection"],

  // API / HTTP
  route: ["endpoint", "handler", "controller", "path", "middleware"],
  middleware: ["handler", "interceptor", "guard", "filter", "pipe"],
  endpoint: ["route", "path", "handler", "controller", "api"],
  request: ["req", "http", "fetch", "axios", "body", "params", "headers"],
  response: ["res", "reply", "send", "json", "status", "return"],

  // Error handling
  error: ["exception", "catch", "throw", "try", "fail", "reject", "handle"],
  exception: ["error", "catch", "throw", "try", "fail"],

  // Async patterns
  async: ["await", "promise", "callback", "then", "resolve", "reject"],
  fetch: ["request", "http", "axios", "call", "api", "get", "post"],

  // Testing
  test: ["spec", "describe", "it", "expect", "mock", "stub", "assert"],
  mock: ["stub", "spy", "fake", "jest", "sinon", "test"],

  // State management
  state: ["store", "redux", "context", "reducer", "action", "dispatch"],
  store: ["state", "redux", "zustand", "context", "cache"],

  // File / IO
  file: ["read", "write", "stream", "path", "fs", "upload", "download"],
  upload: ["file", "multipart", "stream", "storage", "s3", "blob"],

  // Config
  config: ["env", "settings", "options", "configuration", "dotenv"],
  environment: ["env", "config", "dotenv", "process", "variable"],
};

/**
 * Expands a query by appending synonyms for recognized terms.
 * Returns the expanded query string for use in semantic embedding.
 */
export function expandQuery(query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  const expansions = new Set<string>();

  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, "");
    const synonyms = SYNONYM_MAP[clean];
    if (synonyms) {
      synonyms.forEach(s => expansions.add(s));
    }
  }

  if (expansions.size === 0) return query;

  const expanded = `${query} ${Array.from(expansions).join(" ")}`;
  console.error(`[TrimCP] Query expanded: "${query}" → "${expanded}"`);
  return expanded;
}
