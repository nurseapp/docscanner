// API Configuration Template
// Copy this file to config/api.ts and add your actual API key

export const API_CONFIG = {
  // Get your OpenAI API key from: https://platform.openai.com/api-keys
  OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY_HERE',
  
  // Supported languages for document analysis
  SUPPORTED_LANGUAGES: [
    { code: 'auto', name: 'Auto-detect', flag: '🌐' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
    { code: 'da', name: 'Danish', flag: '🇩🇰' },
    { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  ] as const,
  
  // Document types that can be recognized
  DOCUMENT_TYPES: [
    'passport',
    'id_card',
    'drivers_license',
    'invoice',
    'receipt',
    'business_card',
    'contract',
    'letter',
    'form',
    'certificate',
    'bank_statement',
    'medical_record',
    'ticket',
    'menu',
    'credit_card',
    'qr_code',
    'unknown'
  ] as const,
} as const;

export type DocumentType = typeof API_CONFIG.DOCUMENT_TYPES[number];
export type LanguageCode = typeof API_CONFIG.SUPPORTED_LANGUAGES[number]['code'];
