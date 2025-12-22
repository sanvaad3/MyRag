/**
 * In-memory document store for RAG system with file-based persistence
 * Documents are saved to disk and loaded on startup
 */

import { cosineSimilarity } from './embeddings'
import { saveDocuments, loadDocuments } from './persistence'

export interface DocumentChunk {
  id: string
  documentId: string
  documentTitle: string
  content: string
  embedding: number[]
  chunkIndex: number
}

export interface Document {
  id: string
  title: string
  content: string
  fileType: string
  uploadedAt: Date
  chunks: DocumentChunk[]
}

export interface SearchResult {
  chunk: DocumentChunk
  score: number
  vectorScore: number
  keywordScore: number
  explanation: string
}

class DocumentStore {
  private documents: Map<string, Document> = new Map()

  /**
   * Initialize store by loading from disk
   */
  private initialize(): void {
    if (this.documents.size === 0) {
      const docs = loadDocuments()
      for (const doc of docs) {
        this.documents.set(doc.id, doc)
      }
    }
  }

  /**
   * Save current state to disk
   */
  private persist(): void {
    saveDocuments(Array.from(this.documents.values()))
  }

  add(document: Document): void {
    this.documents.set(document.id, document)
    this.persist()
  }

  get(id: string): Document | undefined {
    return this.documents.get(id)
  }

  getAll(): Document[] {
    return Array.from(this.documents.values())
  }

  getAllChunks(): DocumentChunk[] {
    const allChunks: DocumentChunk[] = []
    for (const doc of this.documents.values()) {
      allChunks.push(...doc.chunks)
    }
    return allChunks
  }

  delete(id: string): boolean {
    const result = this.documents.delete(id)
    if (result) {
      this.persist()
    }
    return result
  }

  clear(): void {
    this.documents.clear()
    this.persist()
  }

  count(): number {
    return this.documents.size
  }

  /**
   * Hybrid search: combines semantic (vector) and keyword (BM25-like) search
   */
  hybridSearch(query: string, queryEmbedding: number[], topK: number = 3): SearchResult[] {
    const allChunks = this.getAllChunks()

    if (allChunks.length === 0) {
      return []
    }

    const results: SearchResult[] = []

    // Calculate scores for each chunk
    for (const chunk of allChunks) {
      // 1. Vector similarity (semantic search)
      const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding)

      // 2. Keyword matching (simple BM25-like scoring)
      const keywordScore = this.calculateKeywordScore(query, chunk.content)

      // 3. Combine scores (weighted hybrid)
      const combinedScore = 0.6 * vectorScore + 0.4 * keywordScore

      // Generate explanation
      const explanation = this.generateExplanation(vectorScore, keywordScore, query, chunk.content)

      results.push({
        chunk,
        score: combinedScore,
        vectorScore,
        keywordScore,
        explanation
      })
    }

    // Sort by combined score and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  /**
   * Simple keyword scoring (BM25-inspired)
   */
  private calculateKeywordScore(query: string, text: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/)
    const textLower = text.toLowerCase()

    let score = 0
    let matchedTerms = 0

    for (const term of queryTerms) {
      if (term.length < 3) continue // Skip very short terms

      // Count occurrences
      const regex = new RegExp(term, 'gi')
      const matches = textLower.match(regex)
      const termFreq = matches ? matches.length : 0

      if (termFreq > 0) {
        matchedTerms++
        // TF-IDF inspired: log(1 + freq) to reduce diminishing returns
        score += Math.log(1 + termFreq)
      }
    }

    // Normalize by query length and apply matched term bonus
    const coverage = queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0
    return Math.min(1, (score / Math.max(1, queryTerms.length)) * 0.5 + coverage * 0.5)
  }

  /**
   * Generate explanation for why this chunk was retrieved
   */
  private generateExplanation(vectorScore: number, keywordScore: number, query: string, content: string): string {
    const reasons: string[] = []

    // Semantic relevance
    if (vectorScore > 0.8) {
      reasons.push('Very high semantic match')
    } else if (vectorScore > 0.6) {
      reasons.push('Good semantic relevance')
    } else if (vectorScore > 0.4) {
      reasons.push('Moderate semantic relevance')
    }

    // Keyword matching
    if (keywordScore > 0.5) {
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 3)
      const matchedTerms = queryTerms.filter(term =>
        content.toLowerCase().includes(term)
      )
      if (matchedTerms.length > 0) {
        reasons.push(`Contains: "${matchedTerms.slice(0, 2).join('", "')}"`)
      }
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Related content'
  }
}

// Use globalThis to ensure singleton persists across Next.js hot reloads in development
const getDocumentStore = () => {
  if (!(globalThis as any).__documentStore) {
    const store = new DocumentStore()
    // Load persisted documents on initialization
    store['initialize']()
    ;(globalThis as any).__documentStore = store
  }
  return (globalThis as any).__documentStore as DocumentStore
}

// Export singleton instance
export const documentStore = getDocumentStore()
