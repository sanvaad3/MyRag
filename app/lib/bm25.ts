/**
 * BM25 (Best Matching 25) - Keyword-based ranking algorithm
 * Used alongside embeddings for hybrid search
 */

export interface BM25Document {
  id: string
  content: string
  tokens: string[]
}

export class BM25 {
  private documents: BM25Document[] = []
  private avgDocLength: number = 0
  private docFrequencies: Map<string, number> = new Map()
  private k1: number = 1.5 // Term frequency saturation parameter
  private b: number = 0.75 // Length normalization parameter

  constructor(documents: Array<{ id: string; content: string }>) {
    // Tokenize all documents
    this.documents = documents.map(doc => ({
      id: doc.id,
      content: doc.content,
      tokens: this.tokenize(doc.content)
    }))

    // Calculate average document length
    const totalLength = this.documents.reduce((sum, doc) => sum + doc.tokens.length, 0)
    this.avgDocLength = totalLength / this.documents.length

    // Calculate document frequencies for each term
    this.calculateDocFrequencies()
  }

  /**
   * Tokenize text into lowercase words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(token => token.length > 2) // Filter short words
  }

  /**
   * Calculate how many documents contain each term
   */
  private calculateDocFrequencies(): void {
    const termDocCount = new Map<string, Set<string>>()

    for (const doc of this.documents) {
      const uniqueTerms = new Set(doc.tokens)
      for (const term of uniqueTerms) {
        if (!termDocCount.has(term)) {
          termDocCount.set(term, new Set())
        }
        termDocCount.get(term)!.add(doc.id)
      }
    }

    for (const [term, docSet] of termDocCount) {
      this.docFrequencies.set(term, docSet.size)
    }
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for a term
   */
  private idf(term: string): number {
    const docFreq = this.docFrequencies.get(term) || 0
    const N = this.documents.length
    return Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1)
  }

  /**
   * Calculate BM25 score for a document given a query
   */
  private score(docTokens: string[], queryTokens: string[], docLength: number): number {
    let score = 0

    for (const queryTerm of queryTokens) {
      // Count occurrences of query term in document
      const termFreq = docTokens.filter(t => t === queryTerm).length

      if (termFreq === 0) continue

      const idfScore = this.idf(queryTerm)
      const lengthNorm = docLength / this.avgDocLength

      // BM25 formula
      const numerator = termFreq * (this.k1 + 1)
      const denominator = termFreq + this.k1 * (1 - this.b + this.b * lengthNorm)

      score += idfScore * (numerator / denominator)
    }

    return score
  }

  /**
   * Search for documents matching the query
   */
  search(query: string, topK: number = 10): Array<{ id: string; score: number }> {
    const queryTokens = this.tokenize(query)

    const scores = this.documents.map(doc => ({
      id: doc.id,
      score: this.score(doc.tokens, queryTokens, doc.tokens.length)
    }))

    // Sort by score descending and return top K
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(result => result.score > 0) // Only return matches
  }
}