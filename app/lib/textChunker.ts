/**
 * Chunks text into smaller pieces for better RAG performance
 * Respects sentence boundaries when possible
 */

interface ChunkOptions {
  maxChunkSize?: number
  overlapSize?: number
}

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const {
    maxChunkSize = 1000, // characters per chunk
    overlapSize = 200,   // overlap between chunks for context
  } = options

  if (!text || text.trim().length === 0) {
    return []
  }

  // Normalize whitespace
  const normalizedText = text.replace(/\s+/g, ' ').trim()

  // If text is smaller than maxChunkSize, return as single chunk
  if (normalizedText.length <= maxChunkSize) {
    return [normalizedText]
  }

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < normalizedText.length) {
    // Determine end index for this chunk
    let endIndex = startIndex + maxChunkSize

    // If this is not the last chunk, try to break at sentence boundary
    if (endIndex < normalizedText.length) {
      // Look for sentence endings (., !, ?) near the end of the chunk
      const searchStart = Math.max(startIndex, endIndex - 200)
      const searchText = normalizedText.substring(searchStart, endIndex)

      // Find last sentence ending
      const lastPeriod = searchText.lastIndexOf('. ')
      const lastExclamation = searchText.lastIndexOf('! ')
      const lastQuestion = searchText.lastIndexOf('? ')

      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion)

      if (lastSentenceEnd > 0) {
        // Break at sentence boundary
        endIndex = searchStart + lastSentenceEnd + 2 // +2 to include the punctuation and space
      }
    } else {
      // Last chunk - take everything remaining
      endIndex = normalizedText.length
    }

    // Extract chunk
    const chunk = normalizedText.substring(startIndex, endIndex).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // Move start index, accounting for overlap
    const nextStart = endIndex - overlapSize

    // Ensure we make progress (avoid infinite loops)
    if (nextStart <= startIndex) {
      // If overlap would cause us to go backwards or stay in place, skip ahead
      startIndex = endIndex
    } else {
      startIndex = nextStart
    }
  }

  return chunks
}
