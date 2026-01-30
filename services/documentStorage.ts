import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { AnalysisResult } from './documentAnalyzer';

const DOCUMENTS_KEY = '@DocScanner:savedDocuments';
const DOCUMENTS_DIR = FileSystem.documentDirectory + 'documents/';

// Saved document structure
export interface SavedDocument {
  id: string;
  name: string;
  originalName?: string;
  imageUri: string;
  thumbnailUri?: string;
  analysisResult: AnalysisResult;
  editedData?: any;
  hasEdits: boolean;
  createdAt: number;
  updatedAt: number;
  size: string;
  pages: number;
  type: 'pdf' | 'image';
  color: string;
}

// Document metadata for list display
export interface DocumentMetadata {
  id: string;
  name: string;
  date: string;
  pages: number;
  size: string;
  type: 'pdf' | 'image';
  color: string;
  hasEdits: boolean;
  createdAt: number;
}

// Ensure documents directory exists
async function ensureDirectoryExists(): Promise<void> {
  try {
    // Skip directory creation on web (no file system)
    if (!FileSystem.documentDirectory) {
      console.log('[DocumentStorage] Web platform - skipping directory creation');
      return;
    }
    
    const dirInfo = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
    if (!dirInfo.exists) {
      console.log('[DocumentStorage] Creating documents directory:', DOCUMENTS_DIR);
      await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.warn('[DocumentStorage] Could not create directory (may be on web):', error);
    // Don't throw - web platform doesn't need this
  }
}

// Generate unique ID
function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate document name from analysis
function generateDocumentName(analysisResult: AnalysisResult): string {
  const typeNames: Record<string, string> = {
    passport: 'Passport',
    id_card: 'ID_Card',
    drivers_license: 'Drivers_License',
    invoice: 'Invoice',
    receipt: 'Receipt',
    business_card: 'Business_Card',
    contract: 'Contract',
    letter: 'Letter',
    form: 'Form',
    certificate: 'Certificate',
    bank_statement: 'Bank_Statement',
    medical_record: 'Medical_Record',
    ticket: 'Ticket',
    menu: 'Menu',
    unknown: 'Document',
  };
  
  const typeName = typeNames[analysisResult.documentType] || 'Document';
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  
  return `${typeName}_${date}_${random}`;
}

// Get color based on document type
function getDocumentColor(documentType: string): string {
  const colors: Record<string, string> = {
    passport: '#EF4444',
    id_card: '#F59E0B',
    drivers_license: '#10B981',
    invoice: '#00D9FF',
    receipt: '#EC4899',
    business_card: '#8B5CF6',
    contract: '#6366F1',
    letter: '#3B82F6',
    form: '#14B8A6',
    certificate: '#F97316',
    bank_statement: '#22C55E',
    medical_record: '#E11D48',
    ticket: '#A855F7',
    menu: '#84CC16',
    unknown: '#6B7280',
  };
  return colors[documentType] || '#00D9FF';
}

// Calculate file size string
async function getFileSizeString(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info) {
      const bytes = info.size || 0;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return '0 KB';
  } catch {
    return '0 KB';
  }
}

// Format relative date
function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return '1 week ago';
  if (weeks < 4) return `${weeks} weeks ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

// Get all saved documents
export async function getSavedDocuments(): Promise<SavedDocument[]> {
  try {
    const data = await AsyncStorage.getItem(DOCUMENTS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error getting saved documents:', error);
    return [];
  }
}

// Get document metadata for list display
export async function getDocumentMetadataList(): Promise<DocumentMetadata[]> {
  try {
    console.log('[DocumentStorage] Loading document metadata...');
    const documents = await getSavedDocuments();
    console.log('[DocumentStorage] Found', documents.length, 'documents');
    
    const metadata = documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      date: formatRelativeDate(doc.updatedAt || doc.createdAt),
      pages: doc.pages,
      size: doc.size,
      type: doc.type,
      color: doc.color,
      hasEdits: doc.hasEdits,
      createdAt: doc.createdAt,
    })).sort((a, b) => b.createdAt - a.createdAt);
    
    console.log('[DocumentStorage] Returning', metadata.length, 'metadata items');
    return metadata;
  } catch (error) {
    console.error('[DocumentStorage] Error loading metadata:', error);
    return [];
  }
}

// Save a new document
export async function saveDocument(
  imageUri: string,
  analysisResult: AnalysisResult,
  editedData?: any
): Promise<SavedDocument> {
  try {
    console.log('[DocumentStorage] Saving document...', { imageUri: imageUri.substring(0, 50) });
    
    await ensureDirectoryExists();
    
    const id = generateId();
    const name = editedData?.title || generateDocumentName(analysisResult);
    
    // Determine storage URI based on platform
    let finalImageUri = imageUri;
    let size = '0 KB';
    
    // Copy image to documents directory (native platforms only)
    if (FileSystem.documentDirectory) {
      const imageExtension = imageUri.includes('.png') ? 'png' : 'jpg';
      const savedImageUri = `${DOCUMENTS_DIR}${id}.${imageExtension}`;
      
      // Handle different URI types
      if (imageUri.startsWith('file://') || imageUri.startsWith(FileSystem.documentDirectory)) {
        try {
          await FileSystem.copyAsync({
            from: imageUri,
            to: savedImageUri,
          });
          finalImageUri = savedImageUri;
          size = await getFileSizeString(savedImageUri);
          console.log('[DocumentStorage] File copied to:', savedImageUri);
        } catch (error) {
          console.warn('[DocumentStorage] Failed to copy file:', error);
          // Keep original URI if copy fails
        }
      } else {
        // For web/blob/data URIs, keep the original URI
        console.log('[DocumentStorage] Using original URI (web/blob)');
        finalImageUri = imageUri;
        
        // Estimate size for web images (data URIs)
        if (imageUri.startsWith('data:')) {
          const base64Length = imageUri.split(',')[1]?.length || 0;
          const bytes = (base64Length * 3) / 4;
          if (bytes < 1024) size = `${bytes.toFixed(0)} B`;
          else if (bytes < 1024 * 1024) size = `${(bytes / 1024).toFixed(1)} KB`;
          else size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
      }
    } else {
      // Web platform - store data URI directly
      console.log('[DocumentStorage] Web platform - storing data URI');
      finalImageUri = imageUri;
      
      // Estimate size for web images
      if (imageUri.startsWith('data:')) {
        const base64Length = imageUri.split(',')[1]?.length || 0;
        const bytes = (base64Length * 3) / 4;
        if (bytes < 1024) size = `${bytes.toFixed(0)} B`;
        else if (bytes < 1024 * 1024) size = `${(bytes / 1024).toFixed(1)} KB`;
        else size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    }
    
    const document: SavedDocument = {
      id,
      name,
      originalName: name,
      imageUri: finalImageUri,
      analysisResult,
      editedData,
      hasEdits: !!editedData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      size,
      pages: 1,
      type: 'image',
      color: getDocumentColor(analysisResult.documentType || 'unknown'),
    };
    
    // Get existing documents and add new one
    const documents = await getSavedDocuments();
    documents.unshift(document);
    
    await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    
    console.log('[DocumentStorage] Document saved successfully:', { id, name, size });
    console.log('[DocumentStorage] Total documents:', documents.length);
    
    return document;
  } catch (error) {
    console.error('[DocumentStorage] Error saving document:', error);
    throw error;
  }
}

// Update an existing document
export async function updateDocument(
  id: string,
  updates: Partial<SavedDocument>
): Promise<SavedDocument | null> {
  try {
    const documents = await getSavedDocuments();
    const index = documents.findIndex(doc => doc.id === id);
    
    if (index === -1) return null;
    
    documents[index] = {
      ...documents[index],
      ...updates,
      updatedAt: Date.now(),
    };
    
    await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    
    return documents[index];
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
}

// Get a single document by ID
export async function getDocument(id: string): Promise<SavedDocument | null> {
  const documents = await getSavedDocuments();
  return documents.find(doc => doc.id === id) || null;
}

// Delete a document
export async function deleteDocument(id: string): Promise<boolean> {
  try {
    const documents = await getSavedDocuments();
    const doc = documents.find(d => d.id === id);
    
    if (doc) {
      // Delete the image file
      try {
        const fileInfo = await FileSystem.getInfoAsync(doc.imageUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(doc.imageUri);
        }
      } catch (e) {
        console.warn('Could not delete image file:', e);
      }
    }
    
    const filtered = documents.filter(d => d.id !== id);
    await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(filtered));
    
    return true;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

// Delete multiple documents
export async function deleteDocuments(ids: string[]): Promise<boolean> {
  try {
    const documents = await getSavedDocuments();
    
    // Delete image files
    for (const id of ids) {
      const doc = documents.find(d => d.id === id);
      if (doc) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(doc.imageUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(doc.imageUri);
          }
        } catch (e) {
          console.warn('Could not delete image file:', e);
        }
      }
    }
    
    const filtered = documents.filter(d => !ids.includes(d.id));
    await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(filtered));
    
    return true;
  } catch (error) {
    console.error('Error deleting documents:', error);
    return false;
  }
}

// Search documents
export async function searchDocuments(query: string): Promise<DocumentMetadata[]> {
  const documents = await getDocumentMetadataList();
  const lowerQuery = query.toLowerCase();
  
  return documents.filter(doc => 
    doc.name.toLowerCase().includes(lowerQuery)
  );
}

// Get document count
export async function getDocumentCount(): Promise<number> {
  const documents = await getSavedDocuments();
  return documents.length;
}

// Clear all documents (for testing/reset)
export async function clearAllDocuments(): Promise<void> {
  try {
    // Delete all files in documents directory
    const dirInfo = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(DOCUMENTS_DIR, { idempotent: true });
    }
    
    await AsyncStorage.removeItem(DOCUMENTS_KEY);
  } catch (error) {
    console.error('Error clearing documents:', error);
  }
}
