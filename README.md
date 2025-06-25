# SNURBO

A natural Discord bot powered by local AI models via Ollama.

## Quick Start

```bash
# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your Discord bot token

# Install and run Ollama with a model
ollama run llama3.1:8b

# Start the bot
bun run dev
```

## Configuration

Key settings in `.env`:

```bash
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
LLM=llama3.1:8b
RESPONSE_CHANCE=0.15
MAX_REQUESTS_PER_MINUTE=5
```

## Bot Behavior

- Responds to DMs and @mentions
- 15% random response chance in channels
- Natural conversation with personality
- Code help and explanations
- Rate limiting and context management

## Project Structure

```
src/
├── core/           # Bot initialization and types
├── services/       # AI, Discord, and conversation services
├── config/         # Configuration and prompts
└── utils/          # Helpers and utilities
```

## Development

```bash
bun run dev         # Development with hot reload
bun run setup       # Check configuration
bun run type-check  # TypeScript validation
```

## Models

Recommended Ollama models:
- `llama3.1:8b` - Well-rounded (default)
- `gemma2:2b` - Fast, lightweight
- `qwen2.5:7b` - Good alternative

Change model in `.env` with `LLM=model_name`

## TODO

### Core Features
- [ ] Implement local knowledge base retrieval for the bot to access and query stored data from.
- [ ] Add web search functionality for compatible LLM models.

