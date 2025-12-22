# AI Knowledge Assistant

A personal knowledge base that lets you chat with your documents. Upload PDFs, text files, or markdown files and ask questions about them.

## What it does

This is a RAG (Retrieval Augmented Generation) system that combines keyword search with semantic search to find relevant information in your documents. When you ask a question, it:

1. Searches your documents using both BM25 (keyword matching) and vector embeddings (semantic similarity)
2. Pulls out the most relevant chunks
3. Sends them to GPT-4 along with your question
4. Shows you which documents it used and how confident it was

The hybrid search approach means it can handle both specific keyword queries ("what's the deadline?") and conceptual questions ("what are the main risks?").

## Getting started

Clone the repo and install dependencies:

```bash
npm install
```

You'll need an OpenAI API key. Create a `.env.local` file:

```
OPENAI_API_KEY=your_key_here
```

Then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start uploading documents.

## How it works

**Document processing:**
- Files get parsed and split into ~500 character chunks
- Each chunk gets converted to a vector embedding using OpenAI's text-embedding-3-small model
- Everything is stored in memory (so yeah, data doesn't persist between restarts)

**Search:**
- BM25 handles keyword matching - finds exact terms and phrases
- Vector similarity handles semantic search - understands meaning and context
- Results from both are combined and ranked
- Top 3 chunks get sent to GPT-4o-mini as context

**UI features:**
- Multi-conversation support
- Citation badges showing which documents were used
- Confidence scores for each source
- Retrieval analysis view showing the scoring breakdown
- Cancel button for long-running queries

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- OpenAI API (GPT-4o-mini + text-embedding-3-small)
- Tailwind CSS
- Custom BM25 implementation
- In-memory document store

## File support

Currently supports:
- PDF files
- Plain text (.txt)
- Markdown (.md)

Max file size is 10MB. Files that generate more than 1000 chunks will be rejected.

## Limitations

This is a prototype, so there are some rough edges:

- No database - everything lives in memory and disappears on restart
- No authentication - it's single-user only
- No document management - can't delete or update uploaded files
- Basic error handling
- No persistence for uploaded documents

If you're looking to use this for anything serious, you'll want to add a proper database (Postgres with pgvector would work well) and implement user auth.

## Project structure

```
app/
├── api/
│   ├── chat/route.ts       # Streaming chat endpoint
│   └── upload/route.ts     # Document upload handler
├── lib/
│   ├── bm25.ts            # BM25 keyword search
│   ├── embeddings.ts      # OpenAI embeddings + cosine similarity
│   ├── documentStore.ts   # In-memory storage + hybrid search
│   ├── fileParser.ts      # PDF/text parsing
│   └── textChunker.ts     # Content chunking logic
└── page.tsx               # Main UI
```

## Running in production

The app uses in-memory storage, so you'll lose all uploaded documents when the process restarts. For production use, you'd want to:

1. Add a real database (Postgres with pgvector extension)
2. Store file uploads in object storage (S3, etc)
3. Add authentication
4. Implement proper error handling and logging
5. Add document management features
6. Maybe add some tests

But for playing around and understanding how RAG systems work, this does the job.

## License

MIT - do whatever you want with it
