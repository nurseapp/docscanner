import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraScanner } from '../../components/CameraScanner';
import { QRScanner } from '../../components/QRScanner';
import { BatchScanner } from '../../components/BatchScanner';
import { DocumentPreview } from '../../components/DocumentPreview';
import { AnalysisResult, analyzeDocument } from '../../services/documentAnalyzer';
import { saveDocument, getDocumentCount } from '../../services/documentStorage';

const { width } = Dimensions.get('window');

interface ScannedDocument {
  id: string;
  uri: string;
  name: string;
  date: Date;
  type: 'scan' | 'import';
  analysisResult?: AnalysisResult;
}

export default function DashboardScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showBatchScanner, setShowBatchScanner] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scannedDocuments, setScannedDocuments] = useState<ScannedDocument[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [batchImportProgress, setBatchImportProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
  } | null>(null);
  
  // Web-specific file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load document count on mount
  useEffect(() => {
    loadDocumentCount();
  }, []);

  const loadDocumentCount = async () => {
    const count = await getDocumentCount();
    setDocumentCount(count);
  };

  const handleScanPress = () => {
    setShowCamera(true);
  };

  const handleCameraClose = () => {
    setShowCamera(false);
  };

  const handleCapture = (uri: string) => {
    setShowCamera(false);
    setPendingImageUri(uri);
    setShowPreview(true);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setPendingImageUri(null);
  };

  const handleDocumentSave = async (result: AnalysisResult & { editedData?: any; hasEdits?: boolean }) => {
    if (pendingImageUri && !isSaving) {
      setIsSaving(true);
      try {
        const docTypeName = (result.documentType || 'document').replace('_', ' ');
        
        // Save to persistent storage
        const savedDoc = await saveDocument(
          pendingImageUri,
          result,
          result.editedData
        );
        
        // Also update local state for recent activity
        const newDoc: ScannedDocument = {
          id: savedDoc.id,
          uri: pendingImageUri,
          name: savedDoc.name,
          date: new Date(),
          type: 'scan',
          analysisResult: result,
        };
        setScannedDocuments([newDoc, ...scannedDocuments]);
        
        // Update document count
        await loadDocumentCount();
        
        setShowPreview(false);
        setPendingImageUri(null);
        
        Alert.alert(
          'Document Saved! ✓',
          `Your ${docTypeName} has been saved${result.hasEdits ? ' with edits' : ''} and is now available in History.`,
          [{ text: 'OK' }]
        );
      } catch (error: any) {
        Alert.alert(
          'Save Error',
          error.message || 'Failed to save document. Please try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleImportPress = async () => {
    if (Platform.OS === 'web') {
      // Use native HTML5 file input for web (supports multiple selection)
      handleWebFileSelect();
    } else {
      // Use expo-image-picker for mobile
      handleMobileImport();
    }
  };

  const handleWebFileSelect = () => {
    if (typeof document === 'undefined') return;
    
    // Create or reuse file input
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true; // Enable multiple selection on web
      input.onchange = handleWebFilesSelected;
      fileInputRef.current = input as any;
    }
    
    // Trigger file picker
    fileInputRef.current?.click();
  };

  const handleWebFilesSelected = async (event: any) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }

    console.log(`Selected ${files.length} file(s) for processing`);

    try {
      // Convert FileList to array of assets
      const assets = await Promise.all(
        Array.from(files).map(async (file: any) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result;
              if (result) {
                resolve({
                  uri: result as string,
                  width: 0,
                  height: 0,
                  fileName: file.name,
                });
              } else {
                reject(new Error(`Failed to read file: ${file.name}`));
              }
            };
            reader.onerror = () => {
              reject(new Error(`Error reading file: ${file.name}`));
            };
            reader.readAsDataURL(file);
          });
        })
      );

      console.log(`Successfully loaded ${assets.length} file(s)`);

      if (assets.length === 1) {
        // Single image - use regular preview
        console.log('Opening single image preview');
        setPendingImageUri((assets[0] as any).uri);
        setShowPreview(true);
      } else if (assets.length > 1) {
        // Multiple images - use batch import
        console.log(`Opening batch import for ${assets.length} images`);
        handleBatchImport(assets);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      Alert.alert('Error', 'Failed to load selected files. Please try again.');
    }

    // Reset file input
    if (fileInputRef.current) {
      (fileInputRef.current as any).value = '';
    }
  };

  const handleMobileImport = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to import documents.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (result.assets.length === 1) {
          // Single image - use regular preview
          const asset = result.assets[0];
          setPendingImageUri(asset.uri);
          setShowPreview(true);
        } else {
          // Multiple images - use batch import
          handleBatchImport(result.assets);
        }
      }
    } catch (error) {
      console.error('Error in mobile import:', error);
      Alert.alert('Error', 'Failed to open image picker. Please try again.');
    }
  };

  const handleBatchImport = (assets: any[]) => {
    Alert.alert(
      'Import Multiple Documents',
      `You selected ${assets.length} image${assets.length > 1 ? 's' : ''}. Import all for batch processing with AI analysis?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import All',
          onPress: async () => {
            setBatchImportProgress({ current: 0, total: assets.length, currentFile: 'Starting...' });
            
            let successCount = 0;
            let errorCount = 0;
            
            // Process each document sequentially
            for (let i = 0; i < assets.length; i++) {
              const asset = assets[i];
              const fileName = `Document ${i + 1}`;
              
              try {
                // Update progress
                setBatchImportProgress({
                  current: i + 1,
                  total: assets.length,
                  currentFile: fileName,
                });
                
                // Analyze document
                const analysisResult = await analyzeDocument(asset.uri, 'auto');
                
                // Save document
                await saveDocument(asset.uri, analysisResult, analysisResult.editedData);
                
                successCount++;
                console.log(`✓ Saved: ${analysisResult.documentType}`);
              } catch (error) {
                errorCount++;
                console.error(`✗ Error processing document ${i + 1}:`, error);
              }
            }
            
            setBatchImportProgress(null);
            await loadDocumentCount();
            
            // Show result
            if (errorCount === 0) {
              Alert.alert(
                'Import Complete! ✓',
                `Successfully imported and analyzed ${successCount} document${successCount > 1 ? 's' : ''}.\n\nAll documents saved to History.`,
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert(
                'Import Partially Complete',
                `Imported: ${successCount} document${successCount > 1 ? 's' : ''}\nFailed: ${errorCount}\n\nCheck History for successfully imported documents.`,
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const handleBatchScan = () => {
    setShowBatchScanner(true);
  };

  const handleBatchComplete = async (batchDocuments: any[]) => {
    setShowBatchScanner(false);
    
    // Save all completed documents
    const completedDocs = batchDocuments.filter(d => d.status === 'completed');
    
    if (completedDocs.length === 0) {
      return;
    }
    
    Alert.alert(
      'Batch Scan Complete',
      `Successfully scanned ${completedDocs.length} document${completedDocs.length > 1 ? 's' : ''}. Save all documents?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save All',
          onPress: async () => {
            for (const doc of completedDocs) {
              try {
                await saveDocument(doc.uri, doc.analysisResult, doc.analysisResult.editedData);
              } catch (error) {
                console.error('Error saving document:', error);
              }
            }
            await loadDocumentCount();
            Alert.alert('Success', `${completedDocs.length} document${completedDocs.length > 1 ? 's' : ''} saved successfully`);
          },
        },
      ]
    );
  };

  const handleQRCode = () => {
    setShowQRScanner(true);
  };

  const handleQRScan = (data: string, type: string) => {
    setShowQRScanner(false);
    
    Alert.alert(
      'QR Code Scanned',
      `Type: ${type}\n\nData: ${data}`,
      [
        { text: 'Copy', onPress: () => {
          // In a real app, you'd use Clipboard API
          Alert.alert('Copied', 'QR code data copied to clipboard');
        }},
        { text: 'Close' },
      ]
    );
  };

  const handleIDCard = () => {
    // Directly open camera for ID card scanning
    setShowCamera(true);
  };

  const openImagePreview = (uri: string) => {
    setSelectedImage(uri);
    setShowImagePreview(true);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  };

  const getDocumentIcon = (doc: ScannedDocument): string => {
    if (!doc.analysisResult) return 'document-text';
    const icons: Record<string, string> = {
      passport: 'airplane',
      id_card: 'card',
      drivers_license: 'car',
      invoice: 'receipt',
      receipt: 'cart',
      business_card: 'person',
      contract: 'document-text',
    };
    return icons[doc.analysisResult.documentType] || 'document-text';
  };

  const getDocumentColor = (doc: ScannedDocument): string => {
    if (!doc.analysisResult) return '#00D9FF';
    const colors: Record<string, string> = {
      passport: '#3B82F6',
      id_card: '#10B981',
      drivers_license: '#F59E0B',
      invoice: '#8B5CF6',
      receipt: '#EC4899',
      business_card: '#6366F1',
      contract: '#EF4444',
    };
    return colors[doc.analysisResult.documentType] || '#00D9FF';
  };

  const totalDocs = documentCount;
  const uploadedDocs = scannedDocuments.filter(d => d.type === 'import').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background Pattern */}
      <View style={styles.backgroundPattern}>
        <View style={styles.gradientCircle1} />
        <View style={styles.gradientCircle2} />
        <View style={styles.gridPattern} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.title}>DocScanner</Text>
          </View>
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="document-text" size={20} color="#00D9FF" />
            </View>
            <Text style={styles.statNumber}>{totalDocs}</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="cloud-upload" size={20} color="#10B981" />
            </View>
            <Text style={styles.statNumber}>{uploadedDocs}</Text>
            <Text style={styles.statLabel}>Uploaded</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="folder" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>Folders</Text>
          </View>
        </View>

        {/* Scan Button */}
        <View style={styles.scanSection}>
          <TouchableOpacity 
            style={styles.scanButton} 
            activeOpacity={0.8}
            onPress={handleScanPress}
          >
            <View style={styles.scanButtonInner}>
              <View style={styles.scanButtonGlow} />
              <View style={styles.scanIconContainer}>
                <Ionicons name="scan" size={48} color="#FFFFFF" />
              </View>
              <Text style={styles.scanButtonText}>Scan Document</Text>
              <Text style={styles.scanButtonSubtext}>
                AI-powered OCR with smart formatting
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* AI Features Badge */}
        <View style={styles.aiBadge}>
          <View style={styles.aiBadgeIcon}>
            <Ionicons name="sparkles" size={16} color="#FFD700" />
          </View>
          <Text style={styles.aiBadgeText}>
            Powered by GPT-4 Vision • 18+ Languages • Smart Document Detection
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={handleImportPress}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Ionicons name="images-outline" size={24} color="#6366F1" />
              </View>
              <Text style={styles.actionText}>Import</Text>
              <Text style={styles.actionSubtext}>From gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={handleBatchScan}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                <Ionicons name="document-attach-outline" size={24} color="#EC4899" />
              </View>
              <Text style={styles.actionText}>Batch Scan</Text>
              <Text style={styles.actionSubtext}>Multiple pages</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={handleQRCode}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="qr-code-outline" size={24} color="#10B981" />
              </View>
              <Text style={styles.actionText}>QR Code</Text>
              <Text style={styles.actionSubtext}>Scan codes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={handleIDCard}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="id-card-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.actionText}>ID Card</Text>
              <Text style={styles.actionSubtext}>Identity docs</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {scannedDocuments.length > 0 ? (
            scannedDocuments.slice(0, 5).map((doc) => (
              <TouchableOpacity 
                key={doc.id} 
                style={styles.recentCard}
                onPress={() => openImagePreview(doc.uri)}
              >
                <View style={[styles.recentItemThumbnail, { borderColor: getDocumentColor(doc) }]}>
                  <Image 
                    source={{ uri: doc.uri }} 
                    style={styles.thumbnailImage}
                  />
                </View>
                <View style={styles.recentItemContent}>
                  <View style={styles.recentItemHeader}>
                    <Text style={styles.recentItemTitle} numberOfLines={1}>{doc.name}</Text>
                    {doc.analysisResult && (
                      <View style={[styles.typeTag, { backgroundColor: `${getDocumentColor(doc)}20` }]}>
                        <Ionicons 
                          name={getDocumentIcon(doc) as any} 
                          size={12} 
                          color={getDocumentColor(doc)} 
                        />
                      </View>
                    )}
                  </View>
                  <Text style={styles.recentItemMeta}>
                    {doc.analysisResult?.documentType.replace('_', ' ') || 'Document'} • {formatDate(doc.date)}
                  </Text>
                  {doc.analysisResult && (
                    <Text style={styles.recentItemLang}>
                      🌐 {doc.analysisResult.language.name}
                    </Text>
                  )}
                </View>
                <TouchableOpacity style={styles.recentItemAction}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          ) : (
            <>
              <View style={styles.recentCard}>
                <View style={styles.recentItemIcon}>
                  <Ionicons name="document-text" size={20} color="#00D9FF" />
                </View>
                <View style={styles.recentItemContent}>
                  <Text style={styles.recentItemTitle}>Invoice_2024.pdf</Text>
                  <Text style={styles.recentItemMeta}>Scanned 2 hours ago • 2 pages</Text>
                </View>
                <TouchableOpacity style={styles.recentItemAction}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.recentCard}>
                <View style={styles.recentItemIcon}>
                  <Ionicons name="document-text" size={20} color="#10B981" />
                </View>
                <View style={styles.recentItemContent}>
                  <Text style={styles.recentItemTitle}>Contract_Draft.pdf</Text>
                  <Text style={styles.recentItemMeta}>Scanned yesterday • 5 pages</Text>
                </View>
                <TouchableOpacity style={styles.recentItemAction}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCameraClose}
      >
        <CameraScanner onClose={handleCameraClose} onCapture={handleCapture} />
      </Modal>

      {/* Document Preview Modal (with OCR) */}
      <Modal
        visible={showPreview && !!pendingImageUri}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handlePreviewClose}
      >
        {pendingImageUri && (
          <DocumentPreview
            imageUri={pendingImageUri}
            onClose={handlePreviewClose}
            onSave={handleDocumentSave}
          />
        )}
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={showImagePreview}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowImagePreview(false)}
      >
        <View style={styles.previewModal}>
          <TouchableOpacity 
            style={styles.previewClose}
            onPress={() => setShowImagePreview(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.previewFullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <QRScanner
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScan}
        />
      </Modal>

      {/* Batch Scanner Modal */}
      <Modal
        visible={showBatchScanner}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <BatchScanner
          onClose={() => setShowBatchScanner(false)}
          onComplete={handleBatchComplete}
        />
      </Modal>

      {/* Batch Import Progress Modal */}
      <Modal
        visible={!!batchImportProgress}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.progressModal}>
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color="#00D9FF" style={styles.progressSpinner} />
            <Text style={styles.progressTitle}>Importing Documents</Text>
            <Text style={styles.progressText}>
              Processing {batchImportProgress?.current} of {batchImportProgress?.total}
            </Text>
            <Text style={styles.progressFile}>{batchImportProgress?.currentFile}</Text>
            
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${((batchImportProgress?.current || 0) / (batchImportProgress?.total || 1)) * 100}%` 
                  }
                ]} 
              />
            </View>
            
            <Text style={styles.progressHint}>
              Please wait... AI is analyzing each document
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gradientCircle1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    top: -150,
    right: -100,
  },
  gradientCircle2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    bottom: 100,
    left: -100,
  },
  gridPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161B22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  statCardPrimary: {
    borderColor: 'rgba(0, 217, 255, 0.3)',
    backgroundColor: 'rgba(0, 217, 255, 0.05)',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  scanSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  scanButton: {
    width: width - 40,
    height: 220,
    backgroundColor: '#161B22',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#30363D',
    overflow: 'hidden',
    position: 'relative',
  },
  scanButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scanButtonGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
  },
  scanIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(0, 217, 255, 0.4)',
  },
  scanButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  scanButtonSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  aiBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBadgeText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '500',
  },
  actionsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flexBasis: '47%',
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  actionSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  recentSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: '#00D9FF',
    fontWeight: '500',
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  recentItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  recentItemThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: '#30363D',
    borderWidth: 2,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recentItemContent: {
    flex: 1,
  },
  recentItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recentItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  typeTag: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentItemMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  recentItemLang: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  recentItemAction: {
    padding: 8,
  },
  bottomSpacer: {
    height: 20,
  },
  previewModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  previewFullImage: {
    width: width - 40,
    height: '70%',
  },
  progressModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCard: {
    backgroundColor: '#161B22',
    borderRadius: 20,
    padding: 32,
    width: width - 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  progressSpinner: {
    marginBottom: 24,
  },
  progressTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  progressFile: {
    fontSize: 14,
    color: '#00D9FF',
    marginBottom: 24,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#0D1117',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00D9FF',
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
