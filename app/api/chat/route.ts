import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { documentStore, SearchResult } from '../../lib/documentStore'
import { generateEmbedding } from '../../lib/embeddings'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Store for abort controllers (to cancel requests)
const activeRequests = new Map<string, AbortController>()

export async function POST(req: NextRequest) {
  try {
    const { message, requestId } = await req.json()

    // Create abort controller for this request
    const controller = new AbortController()
    if (requestId) {
      activeRequests.set(requestId, controller)
    }

    // Check if we have any documents
    const allDocuments = documentStore.getAll()
    const allChunks = documentStore.getAllChunks()
    const hasDocuments = allChunks.length > 0

    console.log(`📊 Document store status:`)
    console.log(`  - Documents: ${allDocuments.length}`)
    console.log(`  - Total chunks: ${allChunks.length}`)

    let relevantResults: SearchResult[] = []
    let retrievalInfo = ''

    // If we have documents, perform HYBRID SEARCH (BM25 + Embeddings)
    if (hasDocuments) {
      console.log(`🔍 Hybrid search through ${allChunks.length} chunks...`)
      
      // Generate embedding for the user's question
      const queryEmbedding = await generateEmbedding(message)
      
      // Perform hybrid search (combines keyword + semantic)
      relevantResults = documentStore.hybridSearch(message, queryEmbedding, 3)
      
      if (relevantResults.length > 0) {
        console.log(`✅ Found ${relevantResults.length} relevant chunks`)
        
        // Build retrieval transparency section
        retrievalInfo = '\n🔍 **Retrieval Analysis:**\n\n'
        relevantResults.forEach((result, idx) => {
          const vectorPercent = (result.vectorScore * 100).toFixed(0)
          const keywordPercent = (result.keywordScore * 100).toFixed(0)
          retrievalInfo += `**Source ${idx + 1}:** ${result.chunk.documentTitle}\n`
          retrievalInfo += `├─ Semantic: ${vectorPercent}% | Keywords: ${keywordPercent}%\n`
          retrievalInfo += `└─ ${result.explanation}\n\n`
        })
      }
    }

    // Build context from relevant chunks
    const relevantContext = relevantResults.length > 0
      ? relevantResults
          .map((result, idx) => 
            `[Source ${idx + 1}: ${result.chunk.documentTitle} - Confidence: ${(result.score * 100).toFixed(0)}%]\n${result.chunk.content}`
          )
          .join('\n\n---\n\n')
      : ''

    // Build citations for response header
    const citations = relevantResults.map((result, idx) => ({
      index: idx + 1,
      title: result.chunk.documentTitle,
      chunkId: result.chunk.id,
      confidence: result.score,
      vectorScore: result.vectorScore,
      keywordScore: result.keywordScore,
      explanation: result.explanation
    }))

    // DEBUG: Log what we're sending to the AI
    console.log('\n🔍 DEBUG INFO:')
    console.log('Has documents:', hasDocuments)
    console.log('Relevant results count:', relevantResults.length)
    console.log('Relevant context length:', relevantContext.length)
    console.log('First 500 chars of context:', relevantContext.substring(0, 500))
    console.log('---\n')

    // Build the system prompt with or without context
    const systemPrompt = hasDocuments && relevantResults.length > 0
      ? `You are a helpful AI assistant with access to the user's personal documents.

Your task is to answer the user's question based on the relevant excerpts from their documents provided below.

INSTRUCTIONS:
1. Use the context below to answer the question thoroughly
2. You can synthesize, summarize, and explain information from the context
3. If asked for key points or summaries, extract the most important information
4. Always cite your sources using [Source N] notation for specific claims
5. If the context seems incomplete or doesn't fully answer the question, do your best with what's available and note the limitation
6. Be helpful and informative - interpret the user's intent charitably

RELEVANT EXCERPTS FROM USER'S DOCUMENTS:
${relevantContext}

Use the above excerpts to answer the user's question. Cite sources for key points.`
      : `You are a helpful AI assistant in a personal knowledge management system.
The user hasn't uploaded any documents yet, so you're in general assistant mode.
Be helpful, concise, and encourage them to upload documents to unlock the full knowledge base features.`

    // Create a streaming completion from OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      stream: true,
      temperature: 0.7,
    }, {
      signal: controller.signal // Allow cancellation
    })

    // Create a custom readable stream
    const encoder = new TextEncoder()
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata header with citations and retrieval info
          if (citations.length > 0) {
            const metadata = {
              type: 'metadata',
              citations,
              retrievalInfo
            }
            controller.enqueue(encoder.encode(`__META__${JSON.stringify(metadata)}__META__\n\n`))
          }

          // Stream the AI response
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          }
          controller.close()
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log('Request cancelled by user')
            controller.close()
          } else {
            controller.error(error)
          }
        } finally {
          // Clean up
          if (requestId) {
            activeRequests.delete(requestId)
          }
        }
      },
      cancel() {
        console.log('Stream cancelled by client')
        if (requestId) {
          activeRequests.delete(requestId)
        }
      }
    })

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error: any) {
    console.error('OpenAI API error:', error)
    
    if (error.name === 'AbortError') {
      return new Response('Request cancelled', { status: 499 })
    }
    
    // Return helpful error messages
    if (error?.status === 401) {
      return new Response('Invalid API key. Please check your OPENAI_API_KEY environment variable.', { 
        status: 401 
      })
    }
    
    return new Response('Failed to get AI response. Please try again.', { 
      status: 500 
    })
  }
}

// Cancel endpoint
export async function DELETE(req: NextRequest) {
  const { requestId } = await req.json()
  
  const controller = activeRequests.get(requestId)
  if (controller) {
    controller.abort()
    activeRequests.delete(requestId)
    return new Response('Request cancelled', { status: 200 })
  }
  
  return new Response('Request not found', { status: 404 })
}