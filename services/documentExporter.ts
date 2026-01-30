import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Platform, Alert } from 'react-native';
import { AnalysisResult } from './documentAnalyzer';
import { DocumentType } from '../config/api';

// Check if running on web
const isWeb = Platform.OS === 'web';

// Helper function to download text files on web
function downloadTextFile(content: string, filename: string, mimeType: string) {
  if (typeof document === 'undefined') {
    throw new Error('Download function is only available in web browsers');
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

// Export format types
export type ExportFormat = 'pdf' | 'jpg' | 'png' | 'doc' | 'txt' | 'html' | 'json';

// Export settings
export interface ExportSettings {
  format: ExportFormat;
  quality?: 'low' | 'medium' | 'high';
  includeImage?: boolean;
  includeMetadata?: boolean;
  paperSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  theme?: 'light' | 'dark' | 'professional';
  fileName?: string;
}

// Export result
export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  shareUrl?: string;
}

// Default settings
const DEFAULT_SETTINGS: ExportSettings = {
  format: 'pdf',
  quality: 'high',
  includeImage: true,
  includeMetadata: true,
  paperSize: 'a4',
  orientation: 'portrait',
  theme: 'professional',
};

// Theme styles
const THEMES = {
  light: {
    background: '#FFFFFF',
    text: '#1F2937',
    accent: '#3B82F6',
    secondary: '#6B7280',
    border: '#E5E7EB',
    headerBg: '#F9FAFB',
  },
  dark: {
    background: '#1F2937',
    text: '#F9FAFB',
    accent: '#60A5FA',
    secondary: '#9CA3AF',
    border: '#374151',
    headerBg: '#111827',
  },
  professional: {
    background: '#FFFFFF',
    text: '#111827',
    accent: '#0D9488',
    secondary: '#4B5563',
    border: '#D1D5DB',
    headerBg: '#F3F4F6',
  },
};

// Helper to get language string from analysisResult
function getLanguageString(language: any): string {
  if (!language) return 'auto';
  if (typeof language === 'string') return language;
  if (typeof language === 'object' && language.detected) return language.detected;
  if (typeof language === 'object' && language.name) return language.name;
  return 'auto';
}

// Helper to recursively extract all fields from an object
function extractAllFields(obj: any, prefix: string = ''): { label: string; value: string; id: string }[] {
  const fields: { label: string; value: string; id: string }[] = [];
  
  // Keys to skip
  const skipKeys = ['type', 'keyFields', 'summary', 'rawText', 'raw_text', 'tags'];
  
  if (!obj || typeof obj !== 'object') return fields;
  
  Object.entries(obj).forEach(([key, value]) => {
    // Skip metadata keys
    if (skipKeys.includes(key)) return;
    
    // Skip null/undefined/empty values
    if (value === null || value === undefined || value === '') return;
    
    // Convert key to readable label
    const label = key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    
    const fullLabel = prefix ? `${prefix} - ${label}` : label;
    const id = prefix ? `${prefix}_${key}` : key;
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively extract nested object fields
      const nestedFields = extractAllFields(value, fullLabel);
      fields.push(...nestedFields);
    } else if (Array.isArray(value)) {
      // Join array values
      if (value.length > 0) {
        const stringValue = value.map(v => 
          typeof v === 'object' ? JSON.stringify(v) : String(v)
        ).join(', ');
        fields.push({ id, label: fullLabel, value: stringValue });
      }
    } else {
      fields.push({ id, label: fullLabel, value: String(value) });
    }
  });
  
  return fields;
}

// Convert analysis result data to sections format for export
function convertAnalysisDataToSections(analysisResult: AnalysisResult): { title: string; sections: any[] } {
  const title = getDocumentTitle(analysisResult.documentType || 'unknown');
  const sections: any[] = [];
  
  console.log('=== Converting analysis data to sections ===');
  console.log('Document type:', analysisResult.documentType);
  console.log('Data:', JSON.stringify(analysisResult.data, null, 2));
  console.log('Raw text length:', analysisResult.rawText?.length || 0);
  
  // Check if there's extracted data
  if (analysisResult.data && typeof analysisResult.data === 'object') {
    const fields = extractAllFields(analysisResult.data);
    
    console.log('Extracted fields:', fields);
    
    if (fields.length > 0) {
      sections.push({
        id: 'extracted_data',
        title: 'Extracted Information',
        fields: fields.map(f => ({
          ...f,
          type: 'text',
        })),
      });
    }
    
    // Also check for content field (fallback)
    const data = analysisResult.data as any;
    if (data.content && typeof data.content === 'string' && data.content.trim()) {
      sections.push({
        id: 'content',
        title: 'Document Content',
        fields: [{
          id: 'content',
          label: 'Content',
          value: data.content,
          type: 'multiline',
        }],
      });
    }
    
    // Check for summary
    if (data.summary && typeof data.summary === 'string' && data.summary.trim()) {
      sections.push({
        id: 'summary',
        title: 'Summary',
        fields: [{
          id: 'summary',
          label: 'Document Summary',
          value: data.summary,
          type: 'text',
        }],
      });
    }
  }
  
  // Add raw text section if available and no other sections were generated
  if (analysisResult.rawText && analysisResult.rawText.trim().length > 0) {
    // Only add raw text if we don't already have content
    const hasContentSection = sections.some(s => s.id === 'content');
    if (!hasContentSection) {
      sections.push({
        id: 'raw_text',
        title: 'Full Text Content',
        fields: [{
          id: 'content',
          label: 'Extracted Text',
          value: analysisResult.rawText,
          type: 'multiline',
        }],
      });
    }
  }
  
  // If still no sections, create a fallback
  if (sections.length === 0) {
    console.log('No sections generated, creating fallback');
    sections.push({
      id: 'document_info',
      title: 'Document Information',
      fields: [{
        id: 'type',
        label: 'Document Type',
        value: (analysisResult.documentType || 'Unknown').replace('_', ' '),
        type: 'text',
      }, {
        id: 'confidence',
        label: 'Analysis Confidence',
        value: `${((analysisResult.confidence || 0) * 100).toFixed(0)}%`,
        type: 'text',
      }, {
        id: 'note',
        label: 'Note',
        value: 'No detailed data was extracted from this document.',
        type: 'text',
      }],
    });
  }
  
  console.log('Total sections generated:', sections.length);
  console.log('Sections:', JSON.stringify(sections, null, 2));
  
  return { title, sections };
}

// Generate HTML from document data
function generateHTML(
  data: any,
  analysisResult: AnalysisResult,
  imageUri: string | null,
  settings: ExportSettings
): string {
  const theme = THEMES[settings.theme || 'professional'];
  
  // Use edited data if available, otherwise convert analysis result
  let title: string;
  let sections: any[];
  
  console.log('generateHTML: checking data', {
    hasData: !!data,
    hasSections: !!data?.sections,
    sectionsLength: data?.sections?.length || 0
  });
  
  if (data && data.sections && data.sections.length > 0) {
    console.log('generateHTML: using edited data sections');
    title = data.title || getDocumentTitle(analysisResult.documentType || 'unknown');
    sections = data.sections;
  } else {
    console.log('generateHTML: converting analysis result to sections');
    const converted = convertAnalysisDataToSections(analysisResult);
    title = converted.title;
    sections = converted.sections;
    console.log('generateHTML: converted sections count:', sections.length);
  }

  // Convert image to base64 for embedding (if available and requested)
  const imageSection = settings.includeImage && imageUri ? `
    <div class="image-section">
      <h3>Original Document</h3>
      <img src="${imageUri}" alt="Scanned Document" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid ${theme.border};" />
    </div>
  ` : '';

  const metadataSection = settings.includeMetadata ? `
    <div class="metadata-section">
      <h3>Document Information</h3>
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="label">Document Type</span>
          <span class="value">${(analysisResult.documentType || 'document').replace('_', ' ').toUpperCase()}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Language</span>
          <span class="value">${getLanguageString(analysisResult.language).toUpperCase()}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Confidence</span>
          <span class="value">${((analysisResult.confidence || 0) * 100).toFixed(0)}%</span>
        </div>
        <div class="metadata-item">
          <span class="label">Processed</span>
          <span class="value">${new Date().toLocaleDateString()}</span>
        </div>
      </div>
      ${analysisResult.tags && analysisResult.tags.length > 0 ? `
        <div class="tags">
          ${analysisResult.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  ` : '';

  console.log('Generating sections HTML for', sections.length, 'sections');
  
  const sectionsHTML = sections.length > 0 
    ? sections.map((section: any) => `
      <div class="section">
        <h2 class="section-title">${section.title || 'Section'}</h2>
        <div class="fields">
          ${(section.fields || []).map((field: any) => {
            if (field.type === 'divider') {
              return '<hr class="divider" />';
            }
            if (field.type === 'header') {
              return `<h3 class="field-header" style="
                font-weight: ${field.style?.bold ? 'bold' : 'normal'};
                font-style: ${field.style?.italic ? 'italic' : 'normal'};
                text-decoration: ${field.style?.underline ? 'underline' : field.style?.strikethrough ? 'line-through' : 'none'};
                text-align: ${field.style?.alignment || 'left'};
                color: ${field.style?.color || theme.text};
                font-size: ${(field.style?.fontSize || 16) + 4}px;
              ">${field.value || ''}</h3>`;
            }
            return `
              <div class="field">
                <span class="field-label">${field.label || 'Field'}</span>
                <span class="field-value" style="
                  font-weight: ${field.style?.bold ? 'bold' : 'normal'};
                  font-style: ${field.style?.italic ? 'italic' : 'normal'};
                  text-decoration: ${field.style?.underline ? 'underline' : field.style?.strikethrough ? 'line-through' : 'none'};
                  text-align: ${field.style?.alignment || 'left'};
                  color: ${field.style?.color || theme.text};
                  font-size: ${field.style?.fontSize || 14}px;
                ">${field.value || '—'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('')
    : `
      <div class="section">
        <h2 class="section-title">Document Information</h2>
        <div class="fields">
          <div class="field">
            <span class="field-label">Document Type</span>
            <span class="field-value">${(analysisResult.documentType || 'Unknown').replace('_', ' ')}</span>
          </div>
          <div class="field">
            <span class="field-label">Status</span>
            <span class="field-value">Document exported successfully</span>
          </div>
        </div>
      </div>
    `;
  
  console.log('Sections HTML length:', sectionsHTML.length);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: ${theme.background};
          color: ${theme.text};
          line-height: 1.6;
          padding: 40px;
        }
        
        .document {
          max-width: 800px;
          margin: 0 auto;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid ${theme.accent};
        }
        
        .header h1 {
          font-size: 28px;
          color: ${theme.text};
          margin-bottom: 8px;
        }
        
        .header .doc-type {
          display: inline-block;
          background: ${theme.accent}20;
          color: ${theme.accent};
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .section {
          margin-bottom: 32px;
        }
        
        .section-title {
          font-size: 18px;
          color: ${theme.text};
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid ${theme.border};
        }
        
        .fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .field-label {
          font-size: 11px;
          font-weight: 600;
          color: ${theme.secondary};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .field-value {
          font-size: 14px;
          color: ${theme.text};
        }
        
        .field-header {
          margin: 16px 0;
        }
        
        .divider {
          border: none;
          border-top: 1px solid ${theme.border};
          margin: 16px 0;
        }
        
        .metadata-section {
          background: ${theme.headerBg};
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 32px;
        }
        
        .metadata-section h3 {
          font-size: 14px;
          color: ${theme.secondary};
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .metadata-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        
        .metadata-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .metadata-item .label {
          font-size: 11px;
          color: ${theme.secondary};
          text-transform: uppercase;
        }
        
        .metadata-item .value {
          font-size: 14px;
          font-weight: 500;
          color: ${theme.text};
        }
        
        .tags {
          margin-top: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .tag {
          background: ${theme.accent}15;
          color: ${theme.accent};
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
        }
        
        .image-section {
          margin-bottom: 32px;
        }
        
        .image-section h3 {
          font-size: 14px;
          color: ${theme.secondary};
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid ${theme.border};
          text-align: center;
          font-size: 11px;
          color: ${theme.secondary};
        }
        
        @media print {
          body {
            padding: 20px;
          }
          .document {
            max-width: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="document">
        <div class="header">
          <h1>${title}</h1>
          <span class="doc-type">${(analysisResult.documentType || 'document').replace('_', ' ')}</span>
        </div>
        
        ${metadataSection}
        ${sectionsHTML}
        ${imageSection}
        
        <div class="footer">
          Generated by DocScanner • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate plain text from document
function generatePlainText(
  data: any,
  analysisResult: AnalysisResult,
  settings: ExportSettings
): string {
  // Use edited data if available, otherwise convert analysis result
  let title: string;
  let sections: any[];
  
  if (data && data.sections && data.sections.length > 0) {
    title = data.title || getDocumentTitle(analysisResult.documentType || 'unknown');
    sections = data.sections;
  } else {
    const converted = convertAnalysisDataToSections(analysisResult);
    title = converted.title;
    sections = converted.sections;
  }
  
  let text = `${title}\n${'='.repeat(title.length)}\n\n`;
  
  if (settings.includeMetadata) {
    text += `Document Type: ${(analysisResult.documentType || 'document').replace('_', ' ')}\n`;
    text += `Language: ${getLanguageString(analysisResult.language)}\n`;
    text += `Confidence: ${((analysisResult.confidence || 0) * 100).toFixed(0)}%\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n`;
    if (analysisResult.tags && analysisResult.tags.length > 0) {
      text += `Tags: ${analysisResult.tags.join(', ')}\n`;
    }
    text += '\n' + '-'.repeat(40) + '\n\n';
  }
  
  sections.forEach((section: any) => {
    text += `${section.title}\n${'-'.repeat(section.title.length)}\n`;
    section.fields.forEach((field: any) => {
      if (field.type === 'divider') {
        text += '\n---\n\n';
      } else if (field.type === 'header') {
        text += `\n${field.value}\n\n`;
      } else {
        text += `${field.label}: ${field.value || '—'}\n`;
      }
    });
    text += '\n';
  });
  
  text += `\n${'='.repeat(40)}\nGenerated by DocScanner - ${new Date().toISOString()}\n`;
  
  return text;
}

// Generate JSON from document
function generateJSON(
  data: any,
  analysisResult: AnalysisResult,
  settings: ExportSettings
): string {
  // Use edited data if available, otherwise convert analysis result
  let title: string;
  let sections: any[];
  
  if (data && data.sections && data.sections.length > 0) {
    title = data.title || getDocumentTitle(analysisResult.documentType || 'unknown');
    sections = data.sections;
  } else {
    const converted = convertAnalysisDataToSections(analysisResult);
    title = converted.title;
    sections = converted.sections;
  }
  
  const exportData = {
    title,
    documentType: analysisResult.documentType || 'unknown',
    language: getLanguageString(analysisResult.language),
    confidence: analysisResult.confidence || 0,
    exportDate: new Date().toISOString(),
    sections,
    extractedData: analysisResult.data,
    rawText: analysisResult.rawText,
    tags: analysisResult.tags,
    metadata: settings.includeMetadata ? {
      processingTime: analysisResult.processingTime,
      imageQuality: analysisResult.imageQuality,
    } : undefined,
  };
  
  return JSON.stringify(exportData, null, 2);
}

// Generate DOC (RTF) content
function generateRTF(
  data: any,
  analysisResult: AnalysisResult,
  settings: ExportSettings
): string {
  // Use edited data if available, otherwise convert analysis result
  let title: string;
  let sections: any[];
  
  if (data && data.sections && data.sections.length > 0) {
    title = data.title || getDocumentTitle(analysisResult.documentType || 'unknown');
    sections = data.sections;
  } else {
    const converted = convertAnalysisDataToSections(analysisResult);
    title = converted.title;
    sections = converted.sections;
  }
  
  let rtf = '{\\rtf1\\ansi\\deff0\n';
  rtf += '{\\fonttbl{\\f0 Arial;}}\n';
  rtf += '{\\colortbl;\\red0\\green0\\blue0;\\red100\\green100\\blue100;\\red0\\green150\\blue200;}\n';
  
  // Title
  rtf += `\\pard\\qc\\b\\fs36 ${escapeRTF(title)}\\b0\\par\\par\n`;
  
  // Document type badge
  rtf += `\\pard\\qc\\cf3\\fs20 ${escapeRTF((analysisResult.documentType || 'document').replace('_', ' ').toUpperCase())}\\cf1\\par\\par\n`;
  
  if (settings.includeMetadata) {
    rtf += `\\pard\\cf2\\fs18 Document Type: ${escapeRTF(analysisResult.documentType || 'document')}\\par\n`;
    rtf += `Language: ${escapeRTF(getLanguageString(analysisResult.language))}\\par\n`;
    rtf += `Confidence: ${((analysisResult.confidence || 0) * 100).toFixed(0)}%\\par\n`;
    rtf += `Date: ${escapeRTF(new Date().toLocaleDateString())}\\cf1\\par\\par\n`;
    rtf += '\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par\\par\n';
  }
  
  // Sections
  sections.forEach((section: any) => {
    rtf += `\\pard\\b\\fs28 ${escapeRTF(section.title)}\\b0\\par\n`;
    rtf += '\\pard\\brdrb\\brdrs\\brdrw5\\brsp10 \\par\n';
    
    section.fields.forEach((field: any) => {
      if (field.type === 'divider') {
        rtf += '\\pard\\brdrb\\brdrs\\brdrw5 \\par\\par\n';
      } else if (field.type === 'header') {
        const bold = field.style?.bold ? '\\b' : '';
        const boldEnd = field.style?.bold ? '\\b0' : '';
        const italic = field.style?.italic ? '\\i' : '';
        const italicEnd = field.style?.italic ? '\\i0' : '';
        rtf += `\\pard${bold}${italic}\\fs24 ${escapeRTF(field.value)}${italicEnd}${boldEnd}\\par\\par\n`;
      } else {
        const bold = field.style?.bold ? '\\b' : '';
        const boldEnd = field.style?.bold ? '\\b0' : '';
        const italic = field.style?.italic ? '\\i' : '';
        const italicEnd = field.style?.italic ? '\\i0' : '';
        rtf += `\\pard\\cf2\\fs16 ${escapeRTF(field.label.toUpperCase())}\\cf1\\par\n`;
        rtf += `\\pard${bold}${italic}\\fs22 ${escapeRTF(field.value || '—')}${italicEnd}${boldEnd}\\par\\par\n`;
      }
    });
    
    rtf += '\\par\n';
  });
  
  // Footer
  rtf += `\\pard\\qc\\cf2\\fs16 Generated by DocScanner - ${escapeRTF(new Date().toLocaleDateString())}\\cf1\\par\n`;
  
  rtf += '}';
  
  return rtf;
}

// Escape RTF special characters
function escapeRTF(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\par ')
    .replace(/[^\x00-\x7F]/g, char => `\\u${char.charCodeAt(0)}?`);
}

// Get document title
function getDocumentTitle(type: DocumentType): string {
  const titles: Record<DocumentType, string> = {
    passport: 'Passport Document',
    id_card: 'Identity Card',
    drivers_license: "Driver's License",
    invoice: 'Invoice',
    receipt: 'Receipt',
    business_card: 'Business Card',
    contract: 'Contract',
    letter: 'Letter',
    form: 'Form',
    certificate: 'Certificate',
    bank_statement: 'Bank Statement',
    medical_record: 'Medical Record',
    ticket: 'Ticket',
    menu: 'Menu',
    unknown: 'Document',
  };
  return titles[type] || 'Document';
}

// Get file extension for format
function getFileExtension(format: ExportFormat): string {
  const extensions: Record<ExportFormat, string> = {
    pdf: 'pdf',
    jpg: 'jpg',
    png: 'png',
    doc: 'rtf', // Using RTF for better compatibility
    txt: 'txt',
    html: 'html',
    json: 'json',
  };
  return extensions[format];
}

// Get MIME type for format
function getMimeType(format: ExportFormat): string {
  const mimeTypes: Record<ExportFormat, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    png: 'image/png',
    doc: 'application/rtf',
    txt: 'text/plain',
    html: 'text/html',
    json: 'application/json',
  };
  return mimeTypes[format];
}

// Main export function
export async function exportDocument(
  data: any,
  analysisResult: AnalysisResult,
  imageUri: string | null,
  settings: Partial<ExportSettings> = {}
): Promise<ExportResult> {
  const finalSettings: ExportSettings = { ...DEFAULT_SETTINGS, ...settings };
  const fileName = finalSettings.fileName || 
    `DocScanner_${analysisResult.documentType || 'document'}_${Date.now()}`;
  
  // Debug logging
  console.log('=== Export Document Debug ===');
  console.log('editedData:', data);
  console.log('editedData has sections:', data?.sections?.length || 0);
  console.log('analysisResult.data:', analysisResult.data);
  console.log('analysisResult.rawText length:', analysisResult.rawText?.length || 0);
  console.log('analysisResult.documentType:', analysisResult.documentType);
  console.log('imageUri:', imageUri ? 'present' : 'missing');
  console.log('============================');
  
  try {
    let filePath: string;
    
    switch (finalSettings.format) {
      case 'pdf': {
        const html = generateHTML(data, analysisResult, imageUri, finalSettings);
        console.log('Generated HTML length:', html.length);
        
        if (isWeb) {
          // On web, create a print-friendly page in new window
          console.log('Web platform detected, opening print-friendly page');
          
          try {
            // Open a new window
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            
            if (printWindow) {
              // Write HTML content to the new window
              printWindow.document.open();
              printWindow.document.write(html);
              printWindow.document.close();
              
              // Wait for images and styles to load, then trigger print
              printWindow.addEventListener('load', () => {
                setTimeout(() => {
                  printWindow.focus();
                  printWindow.print();
                  
                  // Optional: Close window after printing (commented out to let user decide)
                  // printWindow.addEventListener('afterprint', () => {
                  //   printWindow.close();
                  // });
                }, 500);
              });
              
              console.log('Print window opened successfully');
              filePath = `web-print://${fileName}.pdf`;
            } else {
              // Popup blocked - use iframe fallback
              console.warn('Popup blocked, using iframe fallback');
              
              const iframe = document.createElement('iframe');
              iframe.style.position = 'fixed';
              iframe.style.top = '-10000px';
              iframe.style.left = '-10000px';
              iframe.style.width = '1px';
              iframe.style.height = '1px';
              document.body.appendChild(iframe);
              
              const iframeDoc = iframe.contentWindow?.document;
              if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(html);
                iframeDoc.close();
                
                // Wait for content to load
                iframe.addEventListener('load', () => {
                  setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    
                    // Clean up after a delay
                    setTimeout(() => {
                      document.body.removeChild(iframe);
                    }, 2000);
                  }, 500);
                });
              }
              
              filePath = `web-print://${fileName}.pdf`;
            }
          } catch (error) {
            console.error('Error creating print window:', error);
            throw new Error('Failed to open print dialog. Please check your popup blocker settings.');
          }
        } else {
          // On mobile, use expo-print
          const result = await Print.printToFileAsync({
            html,
            base64: false,
          });
          
          if (!result || !result.uri) {
            throw new Error('Failed to generate PDF file');
          }
          
          console.log('PDF generated at:', result.uri);
          filePath = result.uri;
        }
        break;
      }
      
      case 'html': {
        const html = generateHTML(data, analysisResult, imageUri, finalSettings);
        
        if (isWeb) {
          // Web: Download HTML file
          downloadTextFile(html, `${fileName}.html`, 'text/html');
          filePath = `web-download://${fileName}.html`;
        } else {
          const fileUri = `${FileSystem.documentDirectory}${fileName}.html`;
          await FileSystem.writeAsStringAsync(fileUri, html, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          filePath = fileUri;
        }
        break;
      }
      
      case 'txt': {
        const text = generatePlainText(data, analysisResult, finalSettings);
        
        if (isWeb) {
          // Web: Download TXT file
          downloadTextFile(text, `${fileName}.txt`, 'text/plain');
          filePath = `web-download://${fileName}.txt`;
        } else {
          const fileUri = `${FileSystem.documentDirectory}${fileName}.txt`;
          await FileSystem.writeAsStringAsync(fileUri, text, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          filePath = fileUri;
        }
        break;
      }
      
      case 'json': {
        const json = generateJSON(data, analysisResult, finalSettings);
        
        if (isWeb) {
          // Web: Download JSON file
          downloadTextFile(json, `${fileName}.json`, 'application/json');
          filePath = `web-download://${fileName}.json`;
        } else {
          const fileUri = `${FileSystem.documentDirectory}${fileName}.json`;
          await FileSystem.writeAsStringAsync(fileUri, json, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          filePath = fileUri;
        }
        break;
      }
      
      case 'doc': {
        const rtf = generateRTF(data, analysisResult, finalSettings);
        
        if (isWeb) {
          // Web: Download RTF file
          downloadTextFile(rtf, `${fileName}.rtf`, 'application/rtf');
          filePath = `web-download://${fileName}.rtf`;
        } else {
          const fileUri = `${FileSystem.documentDirectory}${fileName}.rtf`;
          await FileSystem.writeAsStringAsync(fileUri, rtf, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          filePath = fileUri;
        }
        break;
      }
      
      case 'jpg':
      case 'png': {
        // For image export, we export the original scanned image
        if (!imageUri) {
          throw new Error('No image available for export');
        }
        
        const extension = finalSettings.format;
        
        if (isWeb) {
          // Web: Download image
          try {
            // For web blob URLs or data URLs, we can download directly
            if (imageUri.startsWith('blob:') || imageUri.startsWith('data:')) {
              const link = document.createElement('a');
              link.href = imageUri;
              link.download = `${fileName}.${extension}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } else {
              // For regular URLs, fetch and download
              const response = await fetch(imageUri);
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${fileName}.${extension}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }
            filePath = `web-download://${fileName}.${extension}`;
          } catch (error) {
            throw new Error('Failed to download image');
          }
        } else {
          const destUri = `${FileSystem.documentDirectory}${fileName}.${extension}`;
          
          // Copy the image to documents directory
          await FileSystem.copyAsync({
            from: imageUri,
            to: destUri,
          });
          
          filePath = destUri;
        }
        break;
      }
      
      default:
        throw new Error(`Unsupported format: ${finalSettings.format}`);
    }
    
    return {
      success: true,
      filePath,
    };
    
  } catch (error: any) {
    console.error('Export error:', error);
    return {
      success: false,
      error: error.message || 'Failed to export document',
    };
  }
}

// Share exported file
export async function shareDocument(filePath: string): Promise<boolean> {
  try {
    // Check if it's a web export path
    if (filePath.startsWith('web-download://') || filePath.startsWith('web-temp://') || filePath.startsWith('web-print://')) {
      Alert.alert(
        'File Exported',
        'Your file has been downloaded or printed. You can share it from your Downloads folder or local files.',
        [{ text: 'OK' }]
      );
      return true;
    }
    
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing not available', 'Sharing is not available on this device');
      return false;
    }
    
    await Sharing.shareAsync(filePath, {
      mimeType: getMimeTypeFromPath(filePath),
      dialogTitle: 'Share Document',
    });
    
    return true;
  } catch (error: any) {
    console.error('Share error:', error);
    Alert.alert('Share Error', error.message || 'Failed to share document');
    return false;
  }
}

// Save to media library (for images)
export async function saveToGallery(filePath: string): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant media library access to save images');
      return false;
    }
    
    await MediaLibrary.saveToLibraryAsync(filePath);
    return true;
  } catch (error: any) {
    console.error('Save to gallery error:', error);
    Alert.alert('Save Error', error.message || 'Failed to save to gallery');
    return false;
  }
}

// Get MIME type from file path
function getMimeTypeFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    rtf: 'application/rtf',
    doc: 'application/msword',
    txt: 'text/plain',
    html: 'text/html',
    json: 'application/json',
  };
  return mimeTypes[extension || ''] || 'application/octet-stream';
}

// Format descriptions for UI
export const FORMAT_INFO: Record<ExportFormat, { name: string; description: string; icon: string }> = {
  pdf: {
    name: 'PDF',
    description: 'Portable Document Format - Best for printing & sharing',
    icon: 'document-text',
  },
  doc: {
    name: 'DOC',
    description: 'Rich Text Format - Editable in Word & other editors',
    icon: 'document',
  },
  txt: {
    name: 'TXT',
    description: 'Plain Text - Universal compatibility',
    icon: 'text',
  },
  html: {
    name: 'HTML',
    description: 'Web Page - View in any browser',
    icon: 'code-slash',
  },
  jpg: {
    name: 'JPG',
    description: 'JPEG Image - Compressed image format',
    icon: 'image',
  },
  png: {
    name: 'PNG',
    description: 'PNG Image - Lossless image format',
    icon: 'image-outline',
  },
  json: {
    name: 'JSON',
    description: 'Data Format - For developers & integrations',
    icon: 'code',
  },
};
