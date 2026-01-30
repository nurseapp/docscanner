import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const STORAGE_KEY = '@DocScanner:protectedDocs';
const SALT = 'DocScanner_PIN_Salt_2024';

// Interface for protected document info
export interface ProtectedDocument {
  documentId: string;
  pinHash: string;
  createdAt: number;
  lastAccessed?: number;
  failedAttempts: number;
  lockedUntil?: number;
}

// Hash a PIN with salt
async function hashPin(pin: string): Promise<string> {
  const saltedPin = `${SALT}:${pin}:${SALT}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    saltedPin
  );
  return hash;
}

// Get all protected documents
export async function getProtectedDocuments(): Promise<Record<string, ProtectedDocument>> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error getting protected documents:', error);
    return {};
  }
}

// Save protected documents
async function saveProtectedDocuments(docs: Record<string, ProtectedDocument>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch (error) {
    console.error('Error saving protected documents:', error);
    throw error;
  }
}

// Check if a document is protected
export async function isDocumentProtected(documentId: string): Promise<boolean> {
  const docs = await getProtectedDocuments();
  return !!docs[documentId];
}

// Set PIN for a document
export async function setDocumentPin(documentId: string, pin: string): Promise<boolean> {
  try {
    const docs = await getProtectedDocuments();
    const pinHash = await hashPin(pin);
    
    docs[documentId] = {
      documentId,
      pinHash,
      createdAt: Date.now(),
      failedAttempts: 0,
    };
    
    await saveProtectedDocuments(docs);
    return true;
  } catch (error) {
    console.error('Error setting document PIN:', error);
    return false;
  }
}

// Remove PIN from a document
export async function removeDocumentPin(documentId: string, pin: string): Promise<boolean> {
  try {
    const isValid = await verifyDocumentPin(documentId, pin);
    if (!isValid) {
      return false;
    }
    
    const docs = await getProtectedDocuments();
    delete docs[documentId];
    await saveProtectedDocuments(docs);
    return true;
  } catch (error) {
    console.error('Error removing document PIN:', error);
    return false;
  }
}

// Force remove PIN (for admin/recovery scenarios)
export async function forceRemoveDocumentPin(documentId: string): Promise<boolean> {
  try {
    const docs = await getProtectedDocuments();
    delete docs[documentId];
    await saveProtectedDocuments(docs);
    return true;
  } catch (error) {
    console.error('Error force removing document PIN:', error);
    return false;
  }
}

// Verify PIN for a document
export async function verifyDocumentPin(documentId: string, pin: string): Promise<boolean> {
  try {
    const docs = await getProtectedDocuments();
    const doc = docs[documentId];
    
    if (!doc) {
      return true; // Document not protected
    }
    
    // Check if locked due to too many attempts
    if (doc.lockedUntil && Date.now() < doc.lockedUntil) {
      const remainingTime = Math.ceil((doc.lockedUntil - Date.now()) / 1000);
      throw new Error(`Too many attempts. Try again in ${remainingTime} seconds.`);
    }
    
    const pinHash = await hashPin(pin);
    const isValid = pinHash === doc.pinHash;
    
    if (isValid) {
      // Reset failed attempts on success
      doc.failedAttempts = 0;
      doc.lastAccessed = Date.now();
      doc.lockedUntil = undefined;
    } else {
      // Increment failed attempts
      doc.failedAttempts += 1;
      
      // Lock after 5 failed attempts for 30 seconds
      if (doc.failedAttempts >= 5) {
        doc.lockedUntil = Date.now() + 30000; // 30 seconds
      }
    }
    
    await saveProtectedDocuments(docs);
    return isValid;
  } catch (error) {
    console.error('Error verifying document PIN:', error);
    throw error;
  }
}

// Change PIN for a document
export async function changeDocumentPin(
  documentId: string, 
  currentPin: string, 
  newPin: string
): Promise<boolean> {
  try {
    const isValid = await verifyDocumentPin(documentId, currentPin);
    if (!isValid) {
      return false;
    }
    
    return await setDocumentPin(documentId, newPin);
  } catch (error) {
    console.error('Error changing document PIN:', error);
    return false;
  }
}

// Get protection status for multiple documents
export async function getProtectionStatus(documentIds: string[]): Promise<Record<string, boolean>> {
  const docs = await getProtectedDocuments();
  const status: Record<string, boolean> = {};
  
  for (const id of documentIds) {
    status[id] = !!docs[id];
  }
  
  return status;
}

// Get failed attempts count
export async function getFailedAttempts(documentId: string): Promise<number> {
  const docs = await getProtectedDocuments();
  return docs[documentId]?.failedAttempts || 0;
}

// Check if document is temporarily locked
export async function isDocumentLocked(documentId: string): Promise<{ locked: boolean; remainingTime?: number }> {
  const docs = await getProtectedDocuments();
  const doc = docs[documentId];
  
  if (!doc || !doc.lockedUntil) {
    return { locked: false };
  }
  
  const remainingTime = doc.lockedUntil - Date.now();
  if (remainingTime > 0) {
    return { locked: true, remainingTime: Math.ceil(remainingTime / 1000) };
  }
  
  return { locked: false };
}

// Bulk protect multiple documents with same PIN
export async function bulkProtectDocuments(documentIds: string[], pin: string): Promise<boolean> {
  try {
    const docs = await getProtectedDocuments();
    const pinHash = await hashPin(pin);
    
    for (const documentId of documentIds) {
      docs[documentId] = {
        documentId,
        pinHash,
        createdAt: Date.now(),
        failedAttempts: 0,
      };
    }
    
    await saveProtectedDocuments(docs);
    return true;
  } catch (error) {
    console.error('Error bulk protecting documents:', error);
    return false;
  }
}

// Bulk unprotect multiple documents (requires same PIN for all)
export async function bulkUnprotectDocuments(documentIds: string[], pin: string): Promise<boolean> {
  try {
    // First verify all documents have the same PIN
    for (const documentId of documentIds) {
      const isValid = await verifyDocumentPin(documentId, pin);
      if (!isValid) {
        return false;
      }
    }
    
    const docs = await getProtectedDocuments();
    for (const documentId of documentIds) {
      delete docs[documentId];
    }
    
    await saveProtectedDocuments(docs);
    return true;
  } catch (error) {
    console.error('Error bulk unprotecting documents:', error);
    return false;
  }
}
