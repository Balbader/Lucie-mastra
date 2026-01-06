# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Lucie**, a Slack bot for the Pioneers accelerator program built on the Mastra framework. Lucie is an AI agent that answers questions about the accelerator by querying structured JSON data files and streaming responses to Slack with animated status indicators.

**Key Technologies:**
- **Mastra** (@mastra/core): Agent framework with streaming, tools, workflows, and memory
- **Slack Web API** (@slack/web-api): Slack bot integration
- **LibSQL**: SQLite-based storage for agent state
- **OpenAI GPT-4o Mini**: LLM model for agent intelligence
- **TypeScript + ES Modules**: Modern TypeScript with `type: "module"`

## Commands

### Development
```bash
# Install dependencies
pnpm install

# Run in dev mode (starts Mastra server on port 4111)
pnpm dev

# Run CLI interface for local testing (interactive terminal chat)
pnpm dev:cli
# Or with agent selection:
tsx src/mastra/terminal/cli.ts --agent=lucie
```

### Building and Production
```bash
# Build for production (compiles to .mastra/output/)
pnpm build

# Start production server
pnpm start
```

### Testing Slack Integration
When developing Slack features, you need a public webhook URL:
```bash
# In one terminal: expose local server via ngrok
ngrok http 4111

# In another terminal: run dev server
pnpm dev

# Update Slack app Event Subscription URL to:
# https://your-ngrok-url.ngrok.io/slack/{agentName}/events
```

## Architecture

### High-Level Flow
```
User Question (Slack) → Slack Webhook → Mastra Agent → Query Tool → Data File
                                                              ↓
User ← Streaming Response (animated) ← Agent Response ← Tool Result
```

### Core Components

#### 1. Mastra Instance (`src/mastra/index.ts`)
- Central configuration that registers agents, storage, and API routes
- Uses LibSQLStore with local SQLite database (`./mastra.db`)
- Exposes Slack webhook routes via `server.apiRoutes`
- Bundles with `externals: ['supports-color']` to handle color output dependencies

#### 2. Agent System (`src/mastra/agents/`)
- **Single-agent architecture**: Only one agent (Lucie) handles all queries
- Each agent has:
  - **Instructions**: Detailed system prompt with response guidelines
  - **Model**: OpenAI GPT-4o Mini for intelligence
  - **Tools**: Query tools for data access
  - **Memory**: Conversation context (last 20 messages)
- Agent makes intelligent decisions about which tool to use and how to interpret results

#### 3. Query Tools (`src/mastra/tools/`)
Three specialized tools query pre-loaded JSON data:
- **`general-questions-query`**: FAQ-style knowledge base (general-questions.json)
- **`session-event-grid-query`**: Events, sessions, schedules (session_event_grid_view.json)
- **`pioneer-profile-book-query`**: Pioneer profiles, skills, roles (pioneers_profile_book_su2025.json)

**Critical Design Pattern**: Tools use **broad, simple queries** and return raw data. The LLM analyzes and filters results intelligently. Never craft overly specific search terms.

#### 4. Data Loading (`src/mastra/tools/data-helpers.ts`)
- **Pre-loaded on module initialization**: All JSON files load once at startup
- **Path resolution**: Tries multiple paths to find data files (handles both dev and built environments)
- **Caching**: Data stays in memory; call `clearDataCache()` to reload
- **Search helpers**: `searchInText()` and `searchInObject()` for fuzzy matching

#### 5. Slack Integration (`src/mastra/slack/`)

**Routes (`routes.ts`):**
- Factory function creates webhook endpoints: `/slack/{appName}/events`
- Each Slack app maps to a Mastra agent via `SlackAppConfig`
- Handles URL verification, signature validation, and message events
- Processes messages asynchronously (non-blocking for Slack's 3s timeout)

**Streaming (`streaming.ts`):**
- Streams agent responses to Slack with animated spinners
- Updates message in real-time as agent thinks/uses tools
- Shows status indicators: thinking → tool calls → final response
- Retry logic for final message delivery

**Status Display (`status.ts`):**
- Formats animated status text with spinners (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
- Shows context-aware messages:
  - "Thinking..." (default)
  - "Using {toolName}..." (during tool calls)
  - "Running workflow: {workflowName}..." (during workflows)

**Verification (`verify.ts`):**
- Validates Slack request signatures using HMAC-SHA256
- Prevents unauthorized webhook calls

**Constants (`constants.ts`):**
- `ANIMATION_INTERVAL`: 80ms (spinner frame rate)
- `TOOL_DISPLAY_DELAY`: 500ms (how long to show tool names)
- `STEP_DISPLAY_DELAY`: 300ms (workflow step display time)

#### 6. Terminal CLI (`src/mastra/terminal/`)
- Interactive terminal interface for local testing
- Same streaming functionality as Slack
- Select agent interactively or via `--agent` flag
- Type `exit` or `quit` to end conversation

### Data Architecture

**Storage Locations:**
- JSON data files: `data/` directory at project root
- SQLite database: `mastra.db` (agent memory/state)
- Build output: `.mastra/output/` (generated by Mastra CLI)

**Data Files:**
- `general-questions.json`: Structured Q&A knowledge base with categories
- `session_event_grid_view.json`: Array of session/event objects with dates, speakers, etc.
- `pioneers_profile_book_su2025.json`: Array of pioneer profiles with skills, roles, industries

**Important**: Data files are NOT in `.gitignore` and should be committed for deployment.

## Key Design Patterns

### 1. Streaming Architecture
All agent responses stream via async generators:
```typescript
const stream = await agent.stream(message, { resourceId, threadId });
for await (const chunk of stream.fullStream) {
  // Process chunks: text-delta, tool-call, tool-output, etc.
}
```

### 2. Memory Scoping
- **Slack**: Thread-scoped via `threadId = slack-${channelId}-${threadTs}`
- **Terminal**: Session-scoped via `threadId = terminal-${timestamp}`
- **Resource ID**: User-scoped (`slack-${teamId}-${userId}` or `terminal-${pid}-${timestamp}`)

### 3. Tool Query Strategy
Tools accept simple keywords or "all". LLM filters results:
- ❌ Bad: `query: "top 3 CTOs with most experience in ML"`
- ✅ Good: `query: "all pioneers"` → LLM filters for CTOs, ranks by experience

### 4. Slack Response Formatting
Keep responses **concise and scannable**:
- Use `*bold*` for key info (names, dates)
- Bullet points `•` for lists (limit 3-5 items)
- Emoji sparingly (✨ 🚀 💡 👥 📅)
- 2-4 sentences max when possible
- No markdown headers, code blocks, or tables

### 5. Environment Configuration
Required `.env` variables:
```bash
OPENAI_API_KEY=sk-...

# Per-agent Slack credentials (one set per agent)
SLACK_REVERSE_BOT_TOKEN=xoxb-...
SLACK_REVERSE_SIGNING_SECRET=...

SLACK_CAPS_BOT_TOKEN=xoxb-...
SLACK_CAPS_SIGNING_SECRET=...
```

## Adding New Agents

1. **Create agent file** in `src/mastra/agents/your-agent.ts`
2. **Register in Mastra** at `src/mastra/index.ts`: `agents: { yourAgent }`
3. **Add Slack route** in `src/mastra/slack/routes.ts`:
   ```typescript
   {
     name: 'your-agent',  // Route: /slack/your-agent/events
     botToken: process.env.SLACK_YOUR_AGENT_BOT_TOKEN!,
     signingSecret: process.env.SLACK_YOUR_AGENT_SIGNING_SECRET!,
     agentName: 'yourAgent',  // Must match key in mastra.agents
   }
   ```
4. **Add to CLI** in `src/mastra/terminal/cli.ts`: Update `availableAgents` array
5. **Create Slack app** and add credentials to `.env`

## Adding New Tools

1. **Create tool file** in `src/mastra/tools/your-tool.ts`
2. **Use `createTool()`** from `@mastra/core/tools` with Zod schemas
3. **Register with agent** in agent file: `tools: { yourTool }`
4. **Update agent instructions** to explain when/how to use the tool

## Important Notes

- **Node version**: Requires Node.js >=22.13.0 (specified in package.json)
- **ES Modules**: All files use `import/export`, no CommonJS
- **File extensions**: Use `.js` in imports even for `.ts` files (ES modules requirement)
- **Pre-loading data**: Tools load data at module initialization, not per-request
- **Slack timeout**: 3s limit for webhook responses; process messages asynchronously
- **Memory persistence**: LibSQL stores conversation history in `mastra.db`
- **Build artifacts**: `.mastra/` directory is gitignored; rebuild on deployment
- **Date handling**: Tools return raw date strings; agent parses and compares to current date
- **Concise responses**: Agent is instructed to be brief; don't add unnecessary verbosity

## Troubleshooting

**Data not loading in production:**
- Check `data-helpers.ts` path resolution
- Verify `data/` directory is deployed
- Check console logs for file loading errors

**Slack webhook failing:**
- Verify signature validation in Slack app settings
- Check bot token scopes: `app_mentions:read`, `channels:history`, `chat:write`, `im:history`
- Enable "Agents & AI Apps" in Slack app settings
- Ensure Request URL matches: `https://your-domain/slack/{agentName}/events`

**Agent not streaming:**
- Verify agent is registered in `src/mastra/index.ts`
- Check `agentName` matches key in `mastra.agents` object
- Ensure OpenAI API key is set in `.env`

**Build errors:**
- Run `pnpm install` to ensure all dependencies are installed
- Check TypeScript errors: `tsc --noEmit`
- Verify `supports-color` is in `bundler.externals` if color-related errors occur
