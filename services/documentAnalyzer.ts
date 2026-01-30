import * as FileSystem from 'expo-file-system';
import { API_CONFIG, DocumentType, LanguageCode } from '../config/api';

// Document field definitions for different document types
export interface PassportData {
  type: 'passport';
  documentNumber: string;
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  placeOfBirth: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  issuingAuthority: string;
  mrz?: string;
}

export interface IDCardData {
  type: 'id_card';
  documentNumber: string;
  fullName: string;
  dateOfBirth: string;
  address: string;
  nationality: string;
  sex: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  issuingAuthority: string;
}

export interface DriversLicenseData {
  type: 'drivers_license';
  licenseNumber: string;
  fullName: string;
  dateOfBirth: string;
  address: string;
  licenseClass: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  restrictions?: string;
  endorsements?: string;
}

export interface InvoiceData {
  type: 'invoice';
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  vendor: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
    taxId?: string;
  };
  customer: {
    name: string;
    address: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  paymentTerms?: string;
}

export interface ReceiptData {
  type: 'receipt';
  merchantName: string;
  merchantAddress?: string;
  date: string;
  time?: string;
  items: Array<{
    name: string;
    quantity?: number;
    price: number;
  }>;
  subtotal?: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
  transactionId?: string;
  currency: string;
}

export interface BusinessCardData {
  type: 'business_card';
  name: string;
  title?: string;
  company?: string;
  phone?: string[];
  email?: string[];
  website?: string;
  address?: string;
  socialMedia?: { platform: string; handle: string }[];
}

export interface CreditCardData {
  type: 'credit_card';
  cardNumber: string; // Masked for security (e.g., **** **** **** 1234)
  cardholderName: string;
  expiryDate: string;
  cardType: string; // Visa, Mastercard, Amex, Discover, etc.
  bank?: string;
  lastFourDigits: string;
  cvvVisible?: boolean; // Don't store CVV, just note if visible
}

export interface QRCodeData {
  type: 'qr_code';
  content: string;
  format: string; // URL, text, contact, email, wifi, etc.
  parsedData?: any;
}

export interface ContractData {
  type: 'contract';
  title: string;
  parties: string[];
  effectiveDate?: string;
  terms: string[];
  signatures?: string[];
  summary: string;
}

export interface GenericDocumentData {
  type: 'letter' | 'form' | 'certificate' | 'bank_statement' | 'medical_record' | 'ticket' | 'menu' | 'unknown';
  title?: string;
  content: string;
  keyFields: { label: string; value: string }[];
  summary: string;
}

export type DocumentData =
  | PassportData
  | IDCardData
  | DriversLicenseData
  | CreditCardData
  | BusinessCardData
  | InvoiceData
  | ReceiptData
  | QRCodeData
  | ContractData
  | GenericDocumentData;

export interface AnalysisResult {
  success: boolean;
  documentType: DocumentType;
  confidence: number;
  language: {
    detected: string;
    name: string;
    confidence: number;
  };
  data: DocumentData;
  rawText: string;
  tags: string[];
  warnings?: string[];
  processingTime: number;
}

// OpenAI API base URL
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Check if running on web
const isWeb = typeof document !== 'undefined';

// Convert image URI to base64 (handles both web and native)
async function imageToBase64(imageUri: string): Promise<string> {
  try {
    // Handle web platform
    if (isWeb) {
      // For blob URLs or data URLs on web
      if (imageUri.startsWith('blob:') || imageUri.startsWith('data:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64 = base64String.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      
      // For regular URLs on web
      const response = await fetch(imageUri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64 = base64String.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    
    // Handle native platform (iOS/Android)
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to process image');
  }
}

// Get MIME type from URI
function getMimeType(uri: string): string {
  // Handle data URLs
  if (uri.startsWith('data:')) {
    const match = uri.match(/data:([^;]+);/);
    return match ? match[1] : 'image/jpeg';
  }
  
  // Handle blob URLs (default to jpeg)
  if (uri.startsWith('blob:')) {
    return 'image/jpeg';
  }
  
  // Handle file extensions
  const extension = uri.split('.').pop()?.toLowerCase().split('?')[0];
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

// Call OpenAI API
async function callOpenAI(messages: any[], maxTokens: number = 4000): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_CONFIG.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: maxTokens,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Main analysis function
export async function analyzeDocument(
  imageUri: string,
  preferredLanguage: LanguageCode = 'auto'
): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    // Convert image to base64
    const base64Image = await imageToBase64(imageUri);
    const mimeType = getMimeType(imageUri);

    // Build the language instruction
    const languageInstruction = preferredLanguage === 'auto'
      ? 'Detect the language of the document automatically.'
      : `The document is expected to be in ${API_CONFIG.SUPPORTED_LANGUAGES.find(l => l.code === preferredLanguage)?.name || preferredLanguage}. Extract text in that language.`;

    // First pass: Identify document type and language
    const identificationResponse = await callOpenAI([
      {
        role: 'system',
        content: `You are an advanced document analysis AI. Your task is to:
1. Identify the type of document in the image
2. Detect the primary language
3. Assess image quality and readability

Respond ONLY with a JSON object in this exact format:
{
  "documentType": "passport|id_card|drivers_license|credit_card|business_card|invoice|receipt|qr_code|contract|letter|form|certificate|bank_statement|medical_record|ticket|menu|unknown",
  "confidence": 0.0-1.0,
  "language": {
    "code": "ISO 639-1 code",
    "name": "Language name",
    "confidence": 0.0-1.0
  },
  "quality": {
    "readable": true/false,
    "issues": ["list of any quality issues"]
  }
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: `Analyze this document image. ${languageInstruction}`
          }
        ]
      }
    ], 500);

    let identification;
    try {
      const jsonMatch = identificationResponse.match(/\{[\s\S]*\}/);
      identification = JSON.parse(jsonMatch?.[0] || identificationResponse);
    } catch {
      identification = {
        documentType: 'unknown',
        confidence: 0.5,
        language: { code: 'en', name: 'English', confidence: 0.5 },
        quality: { readable: true, issues: [] }
      };
    }

    // Second pass: Extract detailed data based on document type
    const extractionPrompt = getExtractionPrompt(identification.documentType);

    const extractionResponse = await callOpenAI([
      {
        role: 'system',
        content: extractionPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: `Extract all information from this ${identification.documentType.replace('_', ' ')} document. The document language is ${identification.language.name}. Provide complete and accurate data extraction.`
          }
        ]
      }
    ], 4000);

    let extractedData: DocumentData;
    let rawText = '';
    let tags: string[] = [];

    try {
      const jsonMatch = extractionResponse.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || extractionResponse);
      
      // Handle different response structures from OpenAI
      // Sometimes data is nested in 'data' field, sometimes it's at root level
      const dataFields = parsed.data || parsed;
      
      // Build extracted data with type and all fields
      extractedData = { 
        type: identification.documentType,
        ...dataFields
      };
      
      // Get raw text from various possible locations
      rawText = parsed.rawText || parsed.raw_text || dataFields.rawText || extractionResponse;
      
      // Get tags
      tags = parsed.tags || dataFields.tags || generateTags(identification.documentType, extractedData);
      
      console.log('Parsed document data:', extractedData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw extraction response:', extractionResponse);
      
      extractedData = {
        type: 'unknown',
        content: extractionResponse,
        keyFields: [],
        summary: 'Unable to parse document structure'
      };
      rawText = extractionResponse;
      tags = ['unstructured', 'text'];
    }

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      documentType: identification.documentType,
      confidence: identification.confidence,
      language: identification.language,
      data: extractedData,
      rawText,
      tags,
      warnings: identification.quality?.issues,
      processingTime,
    };

  } catch (error: any) {
    console.error('Document analysis error:', error);
    return {
      success: false,
      documentType: 'unknown',
      confidence: 0,
      language: { detected: 'unknown', name: 'Unknown', confidence: 0 },
      data: { type: 'unknown', content: '', keyFields: [], summary: 'Analysis failed' },
      rawText: '',
      tags: ['error'],
      warnings: [error.message || 'Unknown error occurred'],
      processingTime: Date.now() - startTime,
    };
  }
}

// Generate extraction prompt based on document type
function getExtractionPrompt(documentType: DocumentType): string {
  const baseInstruction = `You are a precise document data extraction AI. Extract ALL text and structured data from the document image. Be thorough and accurate.

Respond ONLY with a JSON object containing:
- "data": The structured document data
- "rawText": All visible text in the document
- "tags": Array of relevant tags/categories

`;

  const typeSpecificInstructions: Record<DocumentType, string> = {
    passport: `For PASSPORT documents, extract:
{
  "data": {
    "documentNumber": "passport number",
    "surname": "family name",
    "givenNames": "first and middle names",
    "nationality": "country of citizenship",
    "dateOfBirth": "YYYY-MM-DD format",
    "sex": "M/F",
    "placeOfBirth": "city/country",
    "dateOfIssue": "YYYY-MM-DD",
    "dateOfExpiry": "YYYY-MM-DD",
    "issuingAuthority": "issuing country/authority",
    "mrz": "machine readable zone if visible (both lines)"
  },
  "rawText": "all visible text",
  "tags": ["passport", "travel_document", "identification", "country_name"]
}`,

    id_card: `For ID CARD documents, extract:
{
  "data": {
    "documentNumber": "ID number",
    "fullName": "complete name",
    "dateOfBirth": "YYYY-MM-DD",
    "address": "full address",
    "nationality": "nationality",
    "sex": "M/F",
    "dateOfIssue": "YYYY-MM-DD",
    "dateOfExpiry": "YYYY-MM-DD",
    "issuingAuthority": "issuing authority"
  },
  "rawText": "all visible text",
  "tags": ["id_card", "identification", "government_issued"]
}`,

    drivers_license: `For DRIVER'S LICENSE documents, extract:
{
  "data": {
    "licenseNumber": "license number",
    "fullName": "complete name",
    "dateOfBirth": "YYYY-MM-DD",
    "address": "full address",
    "licenseClass": "vehicle class/type",
    "dateOfIssue": "YYYY-MM-DD",
    "dateOfExpiry": "YYYY-MM-DD",
    "restrictions": "any restrictions",
    "endorsements": "any endorsements"
  },
  "rawText": "all visible text",
  "tags": ["drivers_license", "identification", "vehicle"]
}`,

    invoice: `For INVOICE documents, extract:
{
  "data": {
    "invoiceNumber": "invoice/reference number",
    "date": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD if present",
    "vendor": {
      "name": "company name",
      "address": "full address",
      "phone": "phone number",
      "email": "email address",
      "taxId": "tax/VAT ID"
    },
    "customer": {
      "name": "customer name",
      "address": "customer address"
    },
    "items": [
      {
        "description": "item description",
        "quantity": 1,
        "unitPrice": 0.00,
        "total": 0.00
      }
    ],
    "subtotal": 0.00,
    "tax": 0.00,
    "total": 0.00,
    "currency": "USD/EUR/etc",
    "paymentTerms": "payment terms"
  },
  "rawText": "all visible text",
  "tags": ["invoice", "financial", "business"]
}`,

    receipt: `For RECEIPT documents, extract:
{
  "data": {
    "merchantName": "store/business name",
    "merchantAddress": "address if shown",
    "date": "YYYY-MM-DD",
    "time": "HH:MM if shown",
    "items": [
      {
        "name": "item name",
        "quantity": 1,
        "price": 0.00
      }
    ],
    "subtotal": 0.00,
    "tax": 0.00,
    "total": 0.00,
    "paymentMethod": "cash/card/etc",
    "transactionId": "transaction reference",
    "currency": "USD/EUR/etc"
  },
  "rawText": "all visible text",
  "tags": ["receipt", "purchase", "transaction"]
}`,

    credit_card: `For CREDIT CARD documents, extract (SECURITY NOTE: Mask sensitive data):
{
  "data": {
    "cardNumber": "**** **** **** 1234 (MASK most digits, show only last 4)",
    "cardholderName": "name on card",
    "expiryDate": "MM/YY",
    "cardType": "Visa/Mastercard/Amex/Discover/etc (identify from card design/logo)",
    "bank": "issuing bank if visible",
    "lastFourDigits": "1234 (last 4 digits only)",
    "cvvVisible": true/false (DO NOT store CVV value, only note if visible)
  },
  "rawText": "all visible non-sensitive text",
  "tags": ["credit_card", "payment", "financial", "card_type"]
}
IMPORTANT: For security, always mask the full card number except last 4 digits.`,

    business_card: `For BUSINESS CARD documents, extract:
{
  "data": {
    "name": "person's name",
    "title": "job title",
    "company": "company name",
    "phone": ["phone numbers"],
    "email": ["email addresses"],
    "website": "website URL",
    "address": "address if shown",
    "socialMedia": [{"platform": "LinkedIn", "handle": "@handle"}]
  },
  "rawText": "all visible text",
  "tags": ["business_card", "contact", "professional"]
}`,

    qr_code: `For QR CODE content, extract:
{
  "data": {
    "content": "full QR code content/data",
    "format": "URL/text/contact/email/wifi/phone/sms/location/etc",
    "parsedData": {
      "url": "if URL format",
      "email": "if email format",
      "phone": "if phone format",
      "wifi": {"ssid": "name", "password": "pass", "security": "WPA"} (if wifi),
      "contact": {"name": "", "phone": "", "email": ""} (if vCard)
    }
  },
  "rawText": "QR code content as text",
  "tags": ["qr_code", "barcode", "format_type"]
}
Parse the QR content and identify its format/purpose.`,

    contract: `For CONTRACT documents, extract:
{
  "data": {
    "title": "contract title",
    "parties": ["party names"],
    "effectiveDate": "YYYY-MM-DD",
    "terms": ["key terms and conditions"],
    "signatures": ["signatory names"],
    "summary": "brief summary of the contract"
  },
  "rawText": "all visible text",
  "tags": ["contract", "legal", "agreement"]
}`,

    letter: `Extract all text and identify sender, recipient, date, subject, and main content.`,
    form: `Extract all form fields with their labels and filled values.`,
    certificate: `Extract certificate type, recipient name, issuing organization, date, and any certification numbers.`,
    bank_statement: `Extract account info, statement period, transactions, and balances.`,
    medical_record: `Extract patient info, dates, diagnoses, treatments, and provider information.`,
    ticket: `Extract event/travel details, dates, times, seat info, and booking references.`,
    menu: `Extract item names, descriptions, prices, and categories.`,
    unknown: `Extract all visible text and identify any structured data patterns.`,
  };

  return baseInstruction + (typeSpecificInstructions[documentType] || typeSpecificInstructions.unknown);
}

// Generate tags based on document type and data
function generateTags(documentType: DocumentType, data: any): string[] {
  const baseTags = [documentType.replace('_', ' ')];

  switch (documentType) {
    case 'passport':
      if (data.nationality) baseTags.push(data.nationality.toLowerCase());
      baseTags.push('travel', 'identification', 'government');
      break;
    case 'id_card':
      baseTags.push('identification', 'government');
      break;
    case 'drivers_license':
      baseTags.push('identification', 'driving', 'government');
      break;
    case 'credit_card':
      baseTags.push('payment', 'financial', 'banking');
      if (data.cardType) baseTags.push(data.cardType.toLowerCase());
      if (data.bank) baseTags.push(data.bank.toLowerCase());
      break;
    case 'business_card':
      baseTags.push('contact', 'networking', 'professional');
      if (data.company) baseTags.push(data.company.toLowerCase());
      break;
    case 'invoice':
      baseTags.push('financial', 'business', 'payment');
      if (data.vendor?.name) baseTags.push(data.vendor.name.toLowerCase());
      break;
    case 'receipt':
      baseTags.push('purchase', 'expense', 'transaction');
      if (data.merchantName) baseTags.push(data.merchantName.toLowerCase());
      break;
    case 'qr_code':
      baseTags.push('barcode', 'data', 'scan');
      if (data.format) baseTags.push(data.format.toLowerCase());
      break;
    case 'contract':
      baseTags.push('legal', 'agreement', 'business');
      break;
    default:
      baseTags.push('document');
  }

  return [...new Set(baseTags)].slice(0, 10);
}

// Quick text extraction without full analysis
export async function quickTextExtract(
  imageUri: string,
  language: LanguageCode = 'auto'
): Promise<{ text: string; language: string }> {
  try {
    const base64Image = await imageToBase64(imageUri);
    const mimeType = getMimeType(imageUri);

    const languageName = API_CONFIG.SUPPORTED_LANGUAGES.find(l => l.code === language)?.name || 'any language';

    const response = await callOpenAI([
      {
        role: 'system',
        content: `Extract ALL text from the image. Maintain the original layout and formatting as much as possible. ${language === 'auto' ? 'Detect and preserve the original language.' : `Extract text in ${languageName}.`}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: 'Extract all text from this image.'
          }
        ]
      }
    ], 4000);

    return {
      text: response,
      language: language === 'auto' ? 'detected' : language,
    };
  } catch (error: any) {
    console.error('Quick text extract error:', error);
    throw new Error(error.message || 'Failed to extract text');
  }
}

// Translate extracted text
export async function translateText(
  text: string,
  targetLanguage: LanguageCode
): Promise<string> {
  if (targetLanguage === 'auto') return text;

  const targetLangName = API_CONFIG.SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;

  try {
    const response = await callOpenAI([
      {
        role: 'system',
        content: `Translate the following text to ${targetLangName}. Preserve formatting and structure.`
      },
      {
        role: 'user',
        content: text
      }
    ], 4000);

    return response;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}
