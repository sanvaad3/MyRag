import { NextRequest, NextResponse } from "next/server";
import { parseFile, getFileType } from "../../lib/fileParser";
import { chunkText } from "../../lib/textChunker";
import { documentStore, DocumentChunk } from "../../lib/documentStore";
import { generateEmbeddings } from "../../lib/embeddings";

// Route segment config for Next.js App Router
export const runtime = "nodejs";
export const maxDuration = 60; // Maximum execution time in seconds

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Parse the file
    console.log(`Processing file: ${file.name} (${file.size} bytes)`);
    const content = await parseFile(file);

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "File appears to be empty or could not be parsed" },
        { status: 400 }
      );
    }

    console.log(`Parsed content length: ${content.length} characters`);

    // Chunk the content for better RAG performance
    const textChunks = chunkText(content);
    console.log(`Created ${textChunks.length} chunks`);

    // Validate chunk count to avoid array length issues
    if (textChunks.length > 1000) {
      return NextResponse.json(
        {
          error: `File too large: generated ${textChunks.length} chunks (max 1000). Please upload a smaller file.`,
        },
        { status: 400 }
      );
    }

    // Generate document ID
    const documentId = `doc_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    // Generate embeddings for all chunks
    console.log(`Generating embeddings for ${textChunks.length} chunks...`);
    const embeddings = await generateEmbeddings(textChunks);
    console.log(`Generated ${embeddings.length} embeddings`);

    // Create document chunks with embeddings
    const chunks: DocumentChunk[] = textChunks.map((text, index) => ({
      id: `${documentId}_chunk_${index}`,
      documentId: documentId,
      documentTitle: file.name,
      content: text,
      embedding: embeddings[index],
      chunkIndex: index,
    }));

    // Create document record
    const document = {
      id: documentId,
      title: file.name,
      content: content,
      fileType: getFileType(file),
      uploadedAt: new Date(),
      chunks: chunks,
    };

    // Store document (in-memory for now, database later)
    documentStore.add(document);

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        fileType: document.fileType,
        uploadedAt: document.uploadedAt,
        chunkCount: chunks.length,
        contentLength: content.length,
      },
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process file" },
      { status: 500 }
    );
  }
}

// Get all uploaded documents
export async function GET() {
  try {
    const documents = documentStore.getAll();
    const allChunks = documentStore.getAllChunks();
    return NextResponse.json({
      documents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        fileType: doc.fileType,
        uploadedAt: doc.uploadedAt,
        chunkCount: doc.chunks.length,
        contentLength: doc.content.length,
      })),
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
