/**
 * File-based persistence for document store
 * Saves/loads documents to/from disk to survive server restarts
 */

import fs from 'fs'
import path from 'path'
import { Document } from './documentStore'

const STORAGE_DIR = path.join(process.cwd(), '.myrag-data')
const DOCUMENTS_FILE = path.join(STORAGE_DIR, 'documents.json')

/**
 * Ensure storage directory exists
 */
function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
    console.log('📁 Created storage directory:', STORAGE_DIR)
  }
}

/**
 * Save documents to disk
 */
export function saveDocuments(documents: Document[]): void {
  try {
    ensureStorageDir()

    // Convert dates to ISO strings for JSON serialization
    const serialized = documents.map(doc => ({
      ...doc,
      uploadedAt: doc.uploadedAt.toISOString(),
    }))

    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(serialized, null, 2), 'utf-8')
    console.log(`💾 Saved ${documents.length} documents to disk`)
  } catch (error) {
    console.error('Failed to save documents:', error)
  }
}

/**
 * Load documents from disk
 */
export function loadDocuments(): Document[] {
  try {
    if (!fs.existsSync(DOCUMENTS_FILE)) {
      console.log('📂 No existing documents file found')
      return []
    }

    const data = fs.readFileSync(DOCUMENTS_FILE, 'utf-8')
    const parsed = JSON.parse(data)

    // Convert ISO strings back to Date objects
    const documents: Document[] = parsed.map((doc: any) => ({
      ...doc,
      uploadedAt: new Date(doc.uploadedAt),
    }))

    console.log(`📥 Loaded ${documents.length} documents from disk`)
    return documents
  } catch (error) {
    console.error('Failed to load documents:', error)
    return []
  }
}

/**
 * Clear all stored documents
 */
export function clearStoredDocuments(): void {
  try {
    if (fs.existsSync(DOCUMENTS_FILE)) {
      fs.unlinkSync(DOCUMENTS_FILE)
      console.log('🗑️  Cleared stored documents')
    }
  } catch (error) {
    console.error('Failed to clear documents:', error)
  }
}
