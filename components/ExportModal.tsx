import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInput,
  Switch,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  exportDocument,
  shareDocument,
  saveToGallery,
  ExportFormat,
  ExportSettings,
  FORMAT_INFO,
} from '../services/documentExporter';
import { AnalysisResult } from '../services/documentAnalyzer';

const { width } = Dimensions.get('window');

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  analysisResult: AnalysisResult;
  editedData: any;
  imageUri: string;
}

type ExportTheme = 'light' | 'dark' | 'professional';
type PaperSize = 'a4' | 'letter' | 'legal';

const FORMATS: ExportFormat[] = ['pdf', 'doc', 'txt', 'html', 'jpg', 'png', 'json'];

const THEMES: { value: ExportTheme; label: string; colors: string[] }[] = [
  { value: 'professional', label: 'Professional', colors: ['#0D9488', '#F3F4F6'] },
  { value: 'light', label: 'Light', colors: ['#3B82F6', '#FFFFFF'] },
  { value: 'dark', label: 'Dark', colors: ['#60A5FA', '#1F2937'] },
];

const PAPER_SIZES: { value: PaperSize; label: string }[] = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
];

export function ExportModal({
  visible,
  onClose,
  analysisResult,
  editedData,
  imageUri,
}: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [fileName, setFileName] = useState(
    `DocScanner_${analysisResult?.documentType || 'document'}_${Date.now()}`
  );
  const [includeImage, setIncludeImage] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<ExportTheme>('professional');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportedFilePath(null);

    const settings: Partial<ExportSettings> = {
      format: selectedFormat,
      fileName,
      includeImage,
      includeMetadata,
      theme: selectedTheme,
      paperSize,
      quality: 'high',
    };

    const result = await exportDocument(
      editedData,
      analysisResult,
      imageUri,
      settings
    );

    setIsExporting(false);

    if (result.success && result.filePath) {
      setExportedFilePath(result.filePath);
      
      // Check if it's a web export
      const isWebDownload = result.filePath.startsWith('web-download://');
      const isWebPrint = result.filePath.startsWith('web-print://') || result.filePath.startsWith('web-temp://');
      
      if (isWebPrint) {
        // For web PDF exports via print dialog
        Alert.alert(
          'Print to PDF',
          'A print-ready page has been opened.\n\n📄 In the print dialog:\n1. Select "Save as PDF" as destination\n2. Adjust settings if needed\n3. Click "Save"\n\nYour PDF will be downloaded to your Downloads folder.',
          [{ text: 'Got it' }]
        );
      } else if (isWebDownload) {
        // For web file downloads
        const formatName = FORMAT_INFO[selectedFormat].name;
        const extension = selectedFormat === 'doc' ? 'rtf' : selectedFormat.toLowerCase();
        Alert.alert(
          'Download Complete! ✓',
          `Your ${formatName} file has been downloaded.\n\nFile: ${fileName}.${extension}\nLocation: Downloads folder`,
          [{ text: 'OK' }]
        );
      } else {
        // For mobile exports
        Alert.alert(
          'Export Successful',
          `Document exported as ${FORMAT_INFO[selectedFormat].name}`,
          [
            { text: 'Share', onPress: () => handleShare(result.filePath!) },
            { text: 'OK' },
          ]
        );
      }
    } else {
      Alert.alert('Export Failed', result.error || 'Unknown error occurred');
    }
  };

  const handleShare = async (filePath: string) => {
    await shareDocument(filePath);
  };

  const handleSaveToGallery = async () => {
    if (exportedFilePath && (selectedFormat === 'jpg' || selectedFormat === 'png')) {
      const success = await saveToGallery(exportedFilePath);
      if (success) {
        Alert.alert('Saved', 'Image saved to gallery');
      }
    }
  };

  const isImageFormat = selectedFormat === 'jpg' || selectedFormat === 'png';
  const isDocumentFormat = ['pdf', 'doc', 'html'].includes(selectedFormat);

  // Safety check for analysisResult
  if (!analysisResult) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Export Document</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Format Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Export Format</Text>
            <View style={styles.formatGrid}>
              {FORMATS.map((format) => (
                <TouchableOpacity
                  key={format}
                  style={[
                    styles.formatCard,
                    selectedFormat === format && styles.formatCardSelected,
                  ]}
                  onPress={() => setSelectedFormat(format)}
                >
                  <View style={[
                    styles.formatIconContainer,
                    selectedFormat === format && styles.formatIconContainerSelected,
                  ]}>
                    <Ionicons
                      name={FORMAT_INFO[format].icon as any}
                      size={24}
                      color={selectedFormat === format ? '#00D9FF' : '#6B7280'}
                    />
                  </View>
                  <Text style={[
                    styles.formatName,
                    selectedFormat === format && styles.formatNameSelected,
                  ]}>
                    {FORMAT_INFO[format].name}
                  </Text>
                  <Text style={styles.formatDescription} numberOfLines={2}>
                    {FORMAT_INFO[format].description}
                  </Text>
                  {selectedFormat === format && (
                    <View style={styles.formatCheckmark}>
                      <Ionicons name="checkmark-circle" size={20} color="#00D9FF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* File Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>File Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="document-outline" size={20} color="#6B7280" />
              <TextInput
                style={styles.input}
                value={fileName}
                onChangeText={setFileName}
                placeholder="Enter file name..."
                placeholderTextColor="#4B5563"
              />
              <Text style={styles.inputSuffix}>
                .{FORMAT_INFO[selectedFormat].name.toLowerCase()}
              </Text>
            </View>
          </View>

          {/* Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Options</Text>
            
            {isDocumentFormat && (
              <>
                <View style={styles.optionRow}>
                  <View style={styles.optionInfo}>
                    <Ionicons name="image-outline" size={20} color="#6B7280" />
                    <Text style={styles.optionLabel}>Include Original Image</Text>
                  </View>
                  <Switch
                    value={includeImage}
                    onValueChange={setIncludeImage}
                    trackColor={{ false: '#30363D', true: 'rgba(0, 217, 255, 0.3)' }}
                    thumbColor={includeImage ? '#00D9FF' : '#6B7280'}
                  />
                </View>
                
                <View style={styles.optionRow}>
                  <View style={styles.optionInfo}>
                    <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
                    <Text style={styles.optionLabel}>Include Metadata</Text>
                  </View>
                  <Switch
                    value={includeMetadata}
                    onValueChange={setIncludeMetadata}
                    trackColor={{ false: '#30363D', true: 'rgba(0, 217, 255, 0.3)' }}
                    thumbColor={includeMetadata ? '#00D9FF' : '#6B7280'}
                  />
                </View>
              </>
            )}
          </View>

          {/* Advanced Settings */}
          {isDocumentFormat && (
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.advancedToggle}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <Text style={styles.sectionTitle}>Advanced Settings</Text>
                <Ionicons 
                  name={showAdvanced ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#6B7280" 
                />
              </TouchableOpacity>
              
              {showAdvanced && (
                <View style={styles.advancedContent}>
                  {/* Theme Selection */}
                  <Text style={styles.subLabel}>Document Theme</Text>
                  <View style={styles.themeGrid}>
                    {THEMES.map((theme) => (
                      <TouchableOpacity
                        key={theme.value}
                        style={[
                          styles.themeCard,
                          selectedTheme === theme.value && styles.themeCardSelected,
                        ]}
                        onPress={() => setSelectedTheme(theme.value)}
                      >
                        <View style={styles.themePreview}>
                          <View style={[styles.themeColorTop, { backgroundColor: theme.colors[1] }]} />
                          <View style={[styles.themeColorBottom, { backgroundColor: theme.colors[0] }]} />
                        </View>
                        <Text style={[
                          styles.themeLabel,
                          selectedTheme === theme.value && styles.themeLabelSelected,
                        ]}>
                          {theme.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Paper Size */}
                  <Text style={styles.subLabel}>Paper Size</Text>
                  <View style={styles.paperSizeGrid}>
                    {PAPER_SIZES.map((size) => (
                      <TouchableOpacity
                        key={size.value}
                        style={[
                          styles.paperSizeCard,
                          paperSize === size.value && styles.paperSizeCardSelected,
                        ]}
                        onPress={() => setPaperSize(size.value)}
                      >
                        <Text style={[
                          styles.paperSizeLabel,
                          paperSize === size.value && styles.paperSizeLabelSelected,
                        ]}>
                          {size.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Preview Info */}
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Ionicons name="eye-outline" size={20} color="#00D9FF" />
              <Text style={styles.previewTitle}>Export Preview</Text>
            </View>
            <View style={styles.previewInfo}>
              <View style={styles.previewItem}>
                <Text style={styles.previewLabel}>Format</Text>
                <Text style={styles.previewValue}>{FORMAT_INFO[selectedFormat].name}</Text>
              </View>
              <View style={styles.previewItem}>
                <Text style={styles.previewLabel}>Document Type</Text>
                <Text style={styles.previewValue}>
                  {(analysisResult?.documentType || 'document').replace('_', ' ')}
                </Text>
              </View>
              {editedData?.sections && (
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Sections</Text>
                  <Text style={styles.previewValue}>{editedData.sections.length}</Text>
                </View>
              )}
              <View style={styles.previewItem}>
                <Text style={styles.previewLabel}>Language</Text>
                <Text style={styles.previewValue}>
                  {analysisResult.language?.detected?.toUpperCase() || 
                   analysisResult.language?.name?.toUpperCase() || 
                   (typeof analysisResult.language === 'string' ? analysisResult.language.toUpperCase() : 'Auto')}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Export Button */}
        <View style={styles.footer}>
          {exportedFilePath && (
            <View style={styles.exportedActions}>
              <TouchableOpacity 
                style={styles.shareButton}
                onPress={() => handleShare(exportedFilePath)}
              >
                <Ionicons name="share-outline" size={20} color="#00D9FF" />
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
              
              {isImageFormat && (
                <TouchableOpacity 
                  style={styles.shareButton}
                  onPress={handleSaveToGallery}
                >
                  <Ionicons name="download-outline" size={20} color="#00D9FF" />
                  <Text style={styles.shareButtonText}>Save to Gallery</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#0D1117" size="small" />
            ) : (
              <>
                <Ionicons name="download" size={20} color="#0D1117" />
                <Text style={styles.exportButtonText}>
                  Export as {FORMAT_INFO[selectedFormat].name}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  formatCard: {
    width: (width - 56) / 3,
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  formatCardSelected: {
    borderColor: '#00D9FF',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  formatIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#21262D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  formatIconContainerSelected: {
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
  },
  formatName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E6EDF3',
    marginBottom: 4,
  },
  formatNameSelected: {
    color: '#00D9FF',
  },
  formatDescription: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 14,
  },
  formatCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputSuffix: {
    fontSize: 14,
    color: '#6B7280',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: 15,
    color: '#E6EDF3',
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  advancedContent: {
    marginTop: 16,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginTop: 12,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  themeCard: {
    flex: 1,
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeCardSelected: {
    borderColor: '#00D9FF',
  },
  themePreview: {
    width: 48,
    height: 32,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  themeColorTop: {
    flex: 1,
  },
  themeColorBottom: {
    height: 8,
  },
  themeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  themeLabelSelected: {
    color: '#00D9FF',
  },
  paperSizeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  paperSizeCard: {
    flex: 1,
    backgroundColor: '#161B22',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paperSizeCardSelected: {
    borderColor: '#00D9FF',
  },
  paperSizeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  paperSizeLabelSelected: {
    color: '#00D9FF',
  },
  previewCard: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D9FF',
  },
  previewInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  previewItem: {
    width: '45%',
  },
  previewLabel: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 14,
    color: '#E6EDF3',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    gap: 12,
  },
  exportedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D9FF',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9FF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D1117',
  },
});
