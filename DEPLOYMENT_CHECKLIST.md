# Google Play Store Deployment Checklist

## Pre-Deployment (Do These First)

### 1. API Key Security ⚠️ CRITICAL
- [ ] Create `config/api.ts` from `config/api.template.ts`
- [ ] Add your OpenAI API key to `config/api.ts`
- [ ] Verify `config/api.ts` is in `.gitignore`
- [ ] Never commit your actual API key to version control
- [ ] Consider moving to environment variables for production

### 2. Account Setup
- [ ] Create Expo account at https://expo.dev
- [ ] Create Google Play Console account ($25 one-time fee)
- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Login to Expo: `eas login`

### 3. Project Configuration
- [ ] Run `eas init` to get your project ID
- [ ] Update `projectId` in `app.json` (replace `YOUR_PROJECT_ID_HERE`)
- [ ] Verify package name: `com.docscanner.app` (or change to your preference)
- [ ] Update app name if desired (currently "DocScanner")

### 4. Assets Preparation
- [ ] Verify app icon exists: `assets/icon.png` (512x512)
- [ ] Verify adaptive icon exists: `assets/adaptive-icon.png` (1024x1024)
- [ ] Verify splash screen exists: `assets/splash-icon.png`
- [ ] Create feature graphic: 1024x500 PNG
- [ ] Take 3-8 screenshots of your app (1080x1920 recommended)

### 5. Legal & Compliance
- [ ] Review and customize `PRIVACY_POLICY.md`
- [ ] Host privacy policy online (GitHub Pages, website, etc.)
- [ ] Add privacy policy URL to app.json
- [ ] Add privacy policy URL to Google Play listing
- [ ] Prepare app description (see DEPLOYMENT.md)
- [ ] Add support email address

## Build Process

### 6. Test Build (Optional but Recommended)
- [ ] Run: `eas build --platform android --profile preview`
- [ ] Download and install APK on test device
- [ ] Test all features:
  - [ ] Document scanning
  - [ ] Image import (single and multiple)
  - [ ] OCR with OpenAI
  - [ ] Document editing
  - [ ] Export functionality (PDF, DOC, etc.)
  - [ ] QR code scanning
  - [ ] History view
  - [ ] PIN protection
- [ ] Fix any bugs found

### 7. Production Build
- [ ] Run: `eas build --platform android --profile production`
- [ ] Wait for build to complete (10-20 minutes)
- [ ] Download the `.aab` file from the provided link
- [ ] Save the `.aab` file in a secure location

## Google Play Console Setup

### 8. Create App Listing
- [ ] Go to https://play.google.com/console
- [ ] Click "Create app"
- [ ] Fill in basic information:
  - App name: DocScanner (or your choice)
  - Default language: English (United States)
  - App or game: App
  - Free or paid: Free
- [ ] Declare app access (if applicable)
- [ ] Fill out ads declaration
- [ ] Complete content rating questionnaire

### 9. Store Listing
- [ ] Upload app icon (512x512)
- [ ] Upload feature graphic (1024x500)
- [ ] Upload screenshots (at least 2, recommended 3-8)
- [ ] Write short description (80 characters max)
- [ ] Write full description (see DEPLOYMENT.md for template)
- [ ] Add app category: Business or Productivity
- [ ] Add contact email
- [ ] Add privacy policy URL

### 10. App Content
- [ ] Complete privacy policy declaration
- [ ] Complete data safety section:
  - Collect: Camera images, stored documents
  - Share: Data sent to OpenAI for processing
  - Security: Encryption in transit, optional PIN protection
- [ ] Complete target audience and content
- [ ] Complete news apps section (if applicable)
- [ ] Complete COVID-19 contact tracing and status apps (N/A)

### 11. Upload and Release
- [ ] Go to "Production" → "Create new release"
- [ ] Upload the `.aab` file
- [ ] Review and add release notes
- [ ] Set rollout percentage (start with 20% for safety)
- [ ] Review all information
- [ ] Submit for review

## Post-Submission

### 12. While Waiting for Review
- [ ] Monitor email for Google Play updates
- [ ] Prepare marketing materials
- [ ] Set up app website (optional)
- [ ] Prepare social media announcements
- [ ] Create app support documentation

### 13. After Approval
- [ ] Test download from Play Store
- [ ] Monitor reviews and ratings
- [ ] Respond to user feedback
- [ ] Monitor crash reports in Play Console
- [ ] Plan for updates and improvements

## Future Updates

### 14. Releasing Updates
- [ ] Update version in `app.json`:
  - Increment `version` (e.g., "1.0.1")
  - Increment `android.versionCode` (e.g., 2)
- [ ] Build new version: `eas build --platform android --profile production`
- [ ] Upload to Google Play Console as new release
- [ ] Write clear release notes
- [ ] Submit for review

## Important URLs

- **Expo Dashboard**: https://expo.dev
- **Google Play Console**: https://play.google.com/console
- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **Play Store Help**: https://support.google.com/googleplay/android-developer

## Estimated Timeline

- **Setup & Configuration**: 1-2 hours
- **First Build**: 10-20 minutes
- **Play Console Setup**: 1-2 hours
- **Google Review**: 1-7 days (usually 1-3 days)
- **Total Time to Live**: 1-2 weeks

## Cost Breakdown

- **Google Play Console**: $25 (one-time fee)
- **Expo Account**: Free for personal projects
- **OpenAI API**: Variable (pay-per-use, monitor usage)
- **Total Initial Cost**: $25 + API usage

## Support Resources

- Read `DEPLOYMENT.md` for detailed instructions
- Review `PRIVACY_POLICY.md` and customize
- Check Expo forums: https://forums.expo.dev
- Google Play Help: https://support.google.com/googleplay/android-developer

## Notes

- First build may take longer due to dependency installation
- Google Play review typically takes 1-3 days
- Keep your signing keys secure (EAS manages this automatically)
- Test thoroughly before submitting
- Respond to user reviews to improve ratings
- Monitor API usage to control costs

---

**Good luck with your app launch! 🚀**

Once you complete this checklist, your app will be live on the Google Play Store!
