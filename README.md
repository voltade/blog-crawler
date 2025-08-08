# TypeScript Blog Scraper & Generator

A TypeScript-based blog scraping and generation system with Cloudflare KV integration.

## Features

✅ **TypeScript-first** - Full type safety  
✅ **Cloudflare KV integration** - URL deduplication  
✅ **In-memory processing** - No local file storage for scraped data  
✅ **Direct AI handoff** - Scraper → Generator workflow  
✅ **OpenAI integration** - AI-powered content generation  
✅ **File system output** - Generated blogs saved locally

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

```bash
cp .env.example .env
# Edit .env with your OpenAI API key
```

### 3. Run the Workflow

```bash
# Development mode (with watch)
npm run dev

# Build and run
npm run build
npm start

# Direct execution
npm run scrape
```

## Workflow

1. **🔍 URL Discovery** - Find recent blog posts by category
2. **🔐 KV Check** - Check if URL already scraped (Cloudflare KV)
3. **📄 Scraping** - Extract content from blog posts
4. **🤖 AI Generation** - Generate new content with OpenAI
5. **💾 Save Output** - Write generated blogs to `generated_blogs/`

## Directory Structure

```
src/
├── types.ts      # TypeScript interfaces
├── scraper.ts    # Blog scraping logic
├── generator.ts  # AI content generation
└── main.ts       # Main workflow orchestration

generated_blogs/
├── sales-and-marketing/
├── crm/
├── product-update/
├── grant/
└── product-support/
```

## Configuration

### Categories

-   `sales-and-marketing`
-   `crm`
-   `product-update`
-   `grant`
-   `product-support`

### Environment Variables

-   `OPENAI_API_KEY` - Required for content generation
-   `CLOUDFLARE_*` - Optional, for KV integration

## Development vs Production

### Development (Current)

-   Uses MockKV for URL tracking
-   Processes all categories
-   Saves to local `generated_blogs/` directory

### Production (Cloudflare Workers)

-   Real Cloudflare KV for URL deduplication
-   Can be deployed as Worker/Cron job
-   Integrates with your existing infrastructure
# blog-crawler
