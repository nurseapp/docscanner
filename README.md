# DocScanner

A powerful AI-powered document scanner mobile app built with React Native + Expo SDK 54. Features advanced OCR capabilities using OpenAI's GPT-4 Vision model with smart document detection and formatting.

## 🚀 Features

### AI-Powered Document Scanning
- **GPT-4 Vision OCR** - Advanced text recognition powered by OpenAI
- **Smart Document Detection** - Automatically identifies document types:
  - Passports & ID Cards
  - Driver's Licenses
  - Invoices & Receipts
  - Business Cards & Credit Cards
  - Contracts & Letters
  - Certificates & Forms
  - Bank Statements & Medical Records
  - QR Codes & Barcodes

### Multi-Language Support
- **18+ Languages** supported including:
  - English, Spanish, French, German, Italian, Portuguese
  - Chinese, Japanese, Korean
  - Arabic, Russian, Hindi
  - Dutch, Polish, Turkish, Swedish, Danish, Norwegian
- **Auto-detection** - Automatically detects document language

### Smart Document Formatting
Each document type gets a custom formatted output:
- **Passport** - Displays all fields (MRZ, names, dates, nationality)
- **Invoice** - Shows vendor, customer, line items, totals
- **Receipt** - Merchant info, items, payment details
- **Business Card** - Contact info, social media, company details
- **ID Card** - Personal info, document numbers, validity dates
- **Credit Card** - Masked card details for security

### Document Editor
- **Rich Text Editing** - Edit extracted text with full formatting
- **Bold, Italic, Underline** - Text styling options
- **Font Size & Color** - Customize appearance
- **Text Alignment** - Left, center, right, justify
- **Undo/Redo** - Full history management
- **Field-Based Editing** - Edit structured document fields

### Export Options
- **PDF** - Print or download
- **Microsoft Word** - DOC/RTF format
- **Images** - JPG, PNG formats
- **Text Formats** - HTML, JSON, TXT
- **Platform Optimized** - Web and mobile specific exports

### Security & Privacy
- **PIN Protection** - Lock sensitive documents
- **Local Storage** - Documents stored on device
- **Credit Card Masking** - Secure sensitive data
- **No Cloud Storage** - Your data stays on your device

### Additional Features
- **Camera scanning** with flash control
- **Import from gallery** - Single or multiple images
- **Batch scanning** - Scan multiple documents in sequence
- **QR Code scanner** - Built-in QR/barcode reader
- **Document history** with search and filters
- **Preview before saving**
- **Raw text view** toggle
- **Tags and categorization**
- **Processing time display**

## 📁 Project Structure

```
DocScanner/
├── app/
│   ├── _layout.tsx              # Root layout
│   └── (tabs)/
│       ├── _layout.tsx          # Tab navigation
│       ├── index.tsx            # Dashboard with scan functionality
│       └── history.tsx          # Document history & management
├── components/
│   ├── CameraScanner.tsx        # Full-screen camera
│   ├── DocumentPreview.tsx      # OCR results & formatting
│   ├── DocumentEditor.tsx       # Rich text editor
│   ├── ExportModal.tsx          # Export functionality
│   ├── QRScanner.tsx            # QR code scanner
│   ├── BatchScanner.tsx         # Batch scanning
│   └── PinModal.tsx             # PIN protection
├── services/
│   ├── documentAnalyzer.ts      # OpenAI Vision API service
│   ├── documentStorage.ts       # Persistent storage
│   ├── documentExporter.ts      # Multi-format export
│   └── documentSecurity.ts      # PIN protection
├── config/
│   ├── api.ts                   # API configuration (gitignored)
│   └── api.template.ts          # API config template
├── app.json                     # Expo configuration
├── eas.json                     # EAS Build configuration
├── package.json
├── tsconfig.json
├── DEPLOYMENT.md                # Deployment guide
├── DEPLOYMENT_CHECKLIST.md      # Pre-launch checklist
└── PRIVACY_POLICY.md            # Privacy policy
```

## 🛠️ Tech Stack

- **Framework**: React Native + Expo SDK 54
- **AI/OCR**: OpenAI GPT-4 Vision API
- **Navigation**: Expo Router v6
- **Camera**: expo-camera
- **Image Picker**: expo-image-picker
- **File System**: expo-file-system
- **Storage**: @react-native-async-storage/async-storage
- **Barcode**: expo-barcode-scanner
- **Printing**: expo-print
- **Icons**: @expo/vector-icons

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd DocScanner

# Install dependencies
npm install

# Copy API config template
cp config/api.template.ts config/api.ts

# Add your OpenAI API key to config/api.ts
# Edit config/api.ts and replace 'YOUR_OPENAI_API_KEY_HERE'

# Start the development server
npx expo start
```

### Configuration

Update the API key in `config/api.ts`:
```typescript
export const API_CONFIG = {
  OPENAI_API_KEY: 'sk-your-actual-api-key-here',
  // ...
};
```

> ⚠️ **Security Note**: Never commit `config/api.ts` to version control. It's already in `.gitignore`.

### Running the App

```bash
# Web (limited camera support)
npx expo start --web

# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android

# Physical device (scan QR with Expo Go)
npx expo start
```

> ⚠️ **Note**: Camera and full OCR functionality require a physical device or native build. Web browser has limited support.

## 📱 Usage Flow

1. **Scan Document** - Tap the main scan button to open camera
2. **Capture** - Position document and tap capture button
3. **AI Analysis** - Document is analyzed by GPT-4 Vision
4. **Preview** - Review formatted data, raw text, or original image
5. **Edit** - Use the rich text editor to modify extracted content
6. **Export** - Save as PDF, DOC, or other formats
7. **Manage** - View, search, and organize in History tab

## 📦 Deployment

Ready to deploy to Google Play Store? Follow these steps:

1. **Read the deployment guide**: See `DEPLOYMENT.md` for detailed instructions
2. **Complete the checklist**: Follow `DEPLOYMENT_CHECKLIST.md` step-by-step
3. **Install EAS CLI**: `npm install -g eas-cli`
4. **Login to Expo**: `eas login`
5. **Initialize EAS**: `eas init`
6. **Build for Android**: `eas build --platform android --profile production`
7. **Upload to Play Store**: Follow guide in `DEPLOYMENT.md`

### Quick Build Commands

```bash
# Production build (AAB for Play Store)
eas build --platform android --profile production

# Preview build (APK for testing)
eas build --platform android --profile preview

# Check build status
eas build:list
```

See `DEPLOYMENT.md` for complete deployment instructions.

## 🎨 Design

The app features a sophisticated dark theme:
- **Background**: #0D1117 (GitHub dark inspired)
- **Accent**: #00D9FF (Cyan)
- **Cards**: #161B22 with #30363D borders
- **Document Types**: Each type has a unique color

## 📝 Document Type Colors

| Document Type | Color |
|--------------|-------|
| Passport | 🔴 #EF4444 |
| ID Card | 🟡 #F59E0B |
| Driver's License | 🟢 #10B981 |
| Invoice | 🔵 #00D9FF |
| Receipt | 🩷 #EC4899 |
| Business Card | 🟣 #8B5CF6 |
| Contract | 🔵 #6366F1 |
| Credit Card | 🟡 #F59E0B |

## 🔐 Security

- API keys stored in `config/api.ts` (gitignored)
- PIN protection for sensitive documents
- Credit card data masking
- Local storage only (no cloud sync)
- Secure HTTPS/TLS for API calls
- Consider environment variables for production

## 📄 License

MIT License

## 🙏 Credits

- OpenAI for GPT-4 Vision API
- Expo team for the amazing SDK
- React Native community

## 📧 Support

For deployment help or issues:
- See `DEPLOYMENT.md` for detailed instructions
- Check `DEPLOYMENT_CHECKLIST.md` for step-by-step guide
- Review `PRIVACY_POLICY.md` for privacy information
- Visit [Expo Documentation](https://docs.expo.dev)
- Post in [Expo Forums](https://forums.expo.dev)

## 🚀 What's Next?

- [ ] Deploy to Google Play Store (See `DEPLOYMENT.md`)
- [ ] Add iOS support
- [ ] Implement cloud backup (optional)
- [ ] Add more export formats
- [ ] Multi-page document support
- [ ] OCR accuracy improvements
- [ ] Offline mode with local OCR

---

**Ready to deploy?** Start with `DEPLOYMENT_CHECKLIST.md`! 🎯
