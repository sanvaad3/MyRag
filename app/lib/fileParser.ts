import pdf from 'pdf-parse'

/**
 * Parse different file types and extract text content
 */

export async function parseFile(file: File): Promise<string> {
  const fileType = file.type
  const fileName = file.name.toLowerCase()

  // PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return await parsePDF(file)
  }

  // Text files
  if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    return await parseText(file)
  }

  // Markdown files
  if (fileType === 'text/markdown' || fileName.endsWith('.md')) {
    return await parseText(file)
  }

  throw new Error(`Unsupported file type: ${fileType || fileName}`)
}

/**
 * Parse PDF files using pdf-parse
 */
async function parsePDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const data = await pdf(buffer)
    return data.text
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error('Failed to parse PDF file')
  }
}

/**
 * Parse text files (TXT, MD)
 */
async function parseText(file: File): Promise<string> {
  try {
    return await file.text()
  } catch (error) {
    console.error('Text parsing error:', error)
    throw new Error('Failed to parse text file')
  }
}

/**
 * Get file type from File object
 */
export function getFileType(file: File): string {
  const fileName = file.name.toLowerCase()
  
  if (fileName.endsWith('.pdf')) return 'PDF'
  if (fileName.endsWith('.txt')) return 'TXT'
  if (fileName.endsWith('.md')) return 'Markdown'
  
  return 'Unknown'
}