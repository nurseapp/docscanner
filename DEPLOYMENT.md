# DocScanner - Google Play Store Deployment Guide

## Prerequisites

Before deploying to the Google Play Store, ensure you have:

1. **Expo Account**: Sign up at https://expo.dev
2. **Google Play Console Account**: $25 one-time fee at https://play.google.com/console
3. **EAS CLI**: Install globally with `npm install -g eas-cli`

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

## Step 3: Configure Your Project

1. Create an Expo project if you haven't:
```bash
eas init
```

2. Update the `projectId` in `app.json`:
   - After running `eas init`, copy the project ID
   - Replace `YOUR_PROJECT_ID_HERE` in `app.json` with your actual project ID

## Step 4: Configure Android Build

The app is already configured with:
- ✅ Package name: `com.docscanner.app`
- ✅ Version: `1.0.0`
- ✅ Version code: `1`
- ✅ Permissions properly set
- ✅ Icons and splash screen configured

## Step 5: Build the Android App Bundle (AAB)

For Google Play Store, you need an AAB file:

```bash
eas build --platform android --profile production
```

This will:
- Build an Android App Bundle (.aab)
- Sign it with credentials managed by Expo
- Upload it to Expo's servers
- Provide a download link

**Build Options:**
- Select "Yes" when asked to generate a new Android Keystore
- Expo will manage your signing credentials securely

## Step 6: Download the AAB File

Once the build completes:
1. Download the `.aab` file from the provided link
2. Or download it from https://expo.dev/accounts/[your-account]/projects/docscanner/builds

## Step 7: Prepare Store Listing

Before uploading, prepare these assets:

### App Information
- **App Name**: DocScanner
- **Short Description**: AI-powered document scanner with smart OCR
- **Full Description**: See below
- **Category**: Business / Productivity

### Graphics Assets Needed
- **App Icon**: 512x512 PNG (already have: `assets/icon.png`)
- **Feature Graphic**: 1024x500 PNG
- **Screenshots**: At least 2 screenshots (recommended: 3-8)
  - Phone: 1080x1920 or similar
  - Tablet (optional): 1800x2560 or similar

### Privacy Policy
- Required for apps requesting permissions
- Host it online (e.g., GitHub Pages, your website)

## Step 8: Upload to Google Play Console

1. Go to https://play.google.com/console
2. Create a new app
3. Fill in app details:
   - **App name**: DocScanner
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free

4. Complete the store listing:
   - Upload app icon, feature graphic, and screenshots
   - Add app description
   - Set category to "Business" or "Productivity"

5. Upload the AAB file:
   - Go to "Production" → "Create new release"
   - Upload the `.aab` file downloaded from EAS
   - Add release notes

6. Complete content rating questionnaire
7. Set up pricing & distribution
8. Submit for review

## Full App Description (for Google Play)

### Short Description (80 characters max)
```
AI-powered document scanner with OCR, smart formatting & multi-language support
```

### Full Description
```
📄 DocScanner - AI-Powered Document Scanner

Transform your phone into a professional document scanner with AI-powered OCR and smart formatting.

✨ KEY FEATURES

🤖 AI-Powered OCR
• Powered by GPT-4 Vision for accurate text extraction
• Supports 18+ languages with auto-detection
• Smart document type recognition

📋 Document Types Supported
• Passports & ID Cards
• Business Cards & Credit Cards
• Invoices & Receipts
• Contracts & Letters
• Certificates & Forms
• Bank Statements & Medical Records
• QR Codes & Barcodes

📝 Advanced Editor
• Rich text editing with formatting options
• Bold, italic, underline, strikethrough
• Font size and color customization
• Text alignment (left, center, right, justify)
• Undo/redo functionality
• Field-based editing for structured documents

🔒 Security & Privacy
• PIN protection for sensitive documents
• Secure local storage
• Credit card data masking
• No data sent to third parties

📤 Export Options
• PDF (print or download)
• Microsoft Word (DOC/RTF)
• Images (JPG, PNG)
• HTML, JSON, TXT formats
• Platform-optimized exports

⚡ Productivity Features
• Batch scanning for multiple documents
• Import multiple images at once
• QR code & barcode scanner
• Document history with search
• Organized by type with color coding
• Quick actions for common tasks

🎨 Beautiful Design
• Modern dark theme interface
• Intuitive user experience
• Fast and responsive
• Clean, professional look

Perfect for:
• Students scanning notes and textbooks
• Business professionals digitizing documents
• Travelers scanning IDs and tickets
• Anyone needing to convert paper to digital

Download DocScanner today and experience the future of document scanning!

📧 Support: [Your support email]
🔗 Privacy Policy: [Your privacy policy URL]
```

## Step 9: Testing Before Release

Build a preview version for testing:

```bash
eas build --platform android --profile preview
```

This creates an APK file you can install directly on test devices.

## Step 10: Update the App (Future Releases)

When you need to update the app:

1. Update version in `app.json`:
```json
{
  "expo": {
    "version": "1.0.1",  // Increment version
    "android": {
      "versionCode": 2   // Increment version code
    }
  }
}
```

2. Build new release:
```bash
eas build --platform android --profile production
```

3. Upload to Google Play Console as a new release

## Important Notes

### API Key Security
⚠️ **IMPORTANT**: Your OpenAI API key is currently hardcoded in `config/api.ts`. Before deploying:

1. Move the API key to environment variables:
   - Use `expo-constants` or `react-native-dotenv`
   - Store it in `eas.json` secrets
   - Never commit API keys to version control

2. Add to `.gitignore`:
```
config/api.ts
.env
.env.local
```

3. Use environment variables:
```javascript
import Constants from 'expo-constants';
const API_KEY = Constants.expoConfig.extra.openaiApiKey;
```

### Google Play Requirements

- ✅ Target API Level: 34 (Android 14) - Already configured
- ✅ 64-bit native libraries support - Handled by Expo
- ✅ App Bundle format (.aab) - Configured in eas.json
- ✅ Privacy policy - You need to create and host this
- ✅ Content rating - Complete in Play Console
- ✅ Data safety section - Complete in Play Console

### Cost Breakdown

1. **Google Play Console**: $25 (one-time)
2. **Expo Account**: Free (for personal projects)
3. **OpenAI API**: Pay-per-use (you need to monitor usage)

### Build Times

- Initial build: 10-20 minutes
- Subsequent builds: 5-15 minutes
- Review by Google: 1-7 days (usually 1-3 days)

## Useful Commands

```bash
# Build for production (AAB)
eas build --platform android --profile production

# Build for testing (APK)
eas build --platform android --profile preview

# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]

# Submit to Play Store (if configured)
eas submit --platform android

# Update credentials
eas credentials
```

## Troubleshooting

### Build Fails
- Check the build logs in EAS dashboard
- Ensure all dependencies are compatible
- Run `npm install` to update packages

### App Crashes on Launch
- Check Android version compatibility
- Test with preview APK first
- Review device logs with `adb logcat`

### Permissions Not Working
- Verify permissions in `app.json`
- Check Android manifest after build
- Test on different Android versions

## Additional Resources

- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Expo Application Services](https://expo.dev/eas)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)

## Support

If you encounter any issues:
1. Check Expo documentation
2. Review EAS build logs
3. Post in Expo forums: https://forums.expo.dev
4. Check GitHub issues for similar problems

---

**Last Updated**: January 2026
**App Version**: 1.0.0
**Target Android Version**: 14 (API 34)
