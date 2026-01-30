import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraScanner } from './CameraScanner';
import { analyzeDocument, AnalysisResult } from '../services/documentAnalyzer';

const { width } = Dimensions.get('window');

interface BatchDocument {
  id: string;
  uri: string;
  name: string;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  analysisResult?: AnalysisResult;
  error?: string;
}

interface BatchScannerProps {
  onClose: () => void;
  onComplete: (documents: BatchDocument[]) => void;
}

export function BatchScanner({ onClose, onComplete }: BatchScannerProps) {
  const [documents, setDocuments] = useState<BatchDocument[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [currentlyAnalyzing, setCurrentlyAnalyzing] = useState(false);
  const documentIdCounter = useRef(1);

  const handleCapture = async (uri: string) => {
    setShowCamera(false);
    
    // Add document to batch
    const newDoc: BatchDocument = {
      id: `doc_${documentIdCounter.current++}`,
      uri,
      name: `Document ${documents.length + 1}`,
      status: 'analyzing',
    };
    
    setDocuments(prev => [...prev, newDoc]);
    
    // Analyze document
    analyzeNewDocument(newDoc);
  };

  const analyzeNewDocument = async (doc: BatchDocument) => {
    setCurrentlyAnalyzing(true);
    
    try {
      const result = await analyzeDocument(doc.uri, 'auto');
      
      setDocuments(prev =>
        prev.map(d =>
          d.id === doc.id
            ? {
                ...d,
                status: 'completed',
                analysisResult: result,
                name: result.documentType !== 'unknown'
                  ? `${result.documentType.replace('_', ' ')} ${d.id.split('_')[1]}`
                  : d.name,
              }
            : d
        )
      );
    } catch (error: any) {
      setDocuments(prev =>
        prev.map(d =>
          d.id === doc.id
            ? {
                ...d,
                status: 'error',
                error: error.message || 'Analysis failed',
              }
            : d
        )
      );
    } finally {
      setCurrentlyAnalyzing(false);
    }
  };

  const handleRetryDocument = (doc: BatchDocument) => {
    setDocuments(prev =>
      prev.map(d =>
        d.id === doc.id
          ? { ...d, status: 'analyzing', error: undefined }
          : d
      )
    );
    analyzeNewDocument(doc);
  };

  const handleDeleteDocument = (docId: string) => {
    Alert.alert(
      'Delete Document',
      'Remove this document from the batch?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDocuments(prev => prev.filter(d => d.id !== docId));
          },
        },
      ]
    );
  };

  const handleComplete = () => {
    const completedDocs = documents.filter(d => d.status === 'completed');
    
    if (completedDocs.length === 0) {
      Alert.alert('No Documents', 'Please scan at least one document to continue.');
      return;
    }
    
    onComplete(documents);
  };

  const handleCancelBatch = () => {
    Alert.alert(
      'Cancel Batch Scan',
      `You have ${documents.length} document(s) scanned. Are you sure you want to cancel?`,
      [
        { text: 'Keep Scanning', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: onClose,
        },
      ]
    );
  };

  const completedCount = documents.filter(d => d.status === 'completed').length;
  const analyzingCount = documents.filter(d => d.status === 'analyzing').length;
  const errorCount = documents.filter(d => d.status === 'error').length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={documents.length > 0 ? handleCancelBatch : onClose}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Batch Scan</Text>
          <Text style={styles.headerSubtitle}>
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerButton, completedCount === 0 && styles.headerButtonDisabled]}
          onPress={handleComplete}
          disabled={completedCount === 0}
        >
          <Ionicons name="checkmark" size={24} color={completedCount > 0 ? '#10B981' : '#6B7280'} />
        </TouchableOpacity>
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.statusText}>{completedCount} Completed</Text>
        </View>
        {analyzingCount > 0 && (
          <View style={styles.statusItem}>
            <ActivityIndicator size="small" color="#00D9FF" />
            <Text style={styles.statusText}>{analyzingCount} Analyzing</Text>
          </View>
        )}
        {errorCount > 0 && (
          <View style={styles.statusItem}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.statusText}>{errorCount} Error</Text>
          </View>
        )}
      </View>

      {/* Document List */}
      <ScrollView
        style={styles.documentList}
        contentContainerStyle={styles.documentListContent}
        showsVerticalScrollIndicator={false}
      >
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="documents" size={60} color="#6B7280" />
            <Text style={styles.emptyStateTitle}>No Documents Yet</Text>
            <Text style={styles.emptyStateText}>
              Tap the camera button below to start scanning
            </Text>
          </View>
        ) : (
          documents.map((doc, index) => (
            <View key={doc.id} style={styles.documentCard}>
              <View style={styles.documentCardHeader}>
                <View style={styles.documentNumber}>
                  <Text style={styles.documentNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>{doc.name}</Text>
                  {doc.analysisResult && (
                    <Text style={styles.documentType}>
                      {doc.analysisResult.documentType.replace('_', ' ')} • {
                        doc.analysisResult.language.name || 'Unknown'
                      }
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteDocument(doc.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.documentPreview}>
                <Image source={{ uri: doc.uri }} style={styles.previewImage} />
                
                {/* Status Overlay */}
                {doc.status === 'analyzing' && (
                  <View style={styles.statusOverlay}>
                    <ActivityIndicator size="large" color="#00D9FF" />
                    <Text style={styles.statusOverlayText}>Analyzing...</Text>
                  </View>
                )}
                
                {doc.status === 'completed' && (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  </View>
                )}
                
                {doc.status === 'error' && (
                  <View style={styles.errorOverlay}>
                    <Ionicons name="alert-circle" size={40} color="#EF4444" />
                    <Text style={styles.errorText}>{doc.error}</Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => handleRetryDocument(doc)}
                    >
                      <Ionicons name="reload" size={16} color="#FFFFFF" />
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Confidence Indicator */}
              {doc.analysisResult && doc.status === 'completed' && (
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      { width: `${doc.analysisResult.confidence * 100}%` },
                    ]}
                  />
                  <Text style={styles.confidenceText}>
                    {Math.round(doc.analysisResult.confidence * 100)}% confidence
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCamera(true)}
          disabled={currentlyAnalyzing}
        >
          <Ionicons name="camera" size={24} color="#0D1117" />
          <Text style={styles.addButtonText}>
            {documents.length === 0 ? 'Start Scanning' : 'Add Document'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide" presentationStyle="fullScreen">
        <CameraScanner
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    gap: 20,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  documentList: {
    flex: 1,
  },
  documentListContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  documentCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#30363D',
    overflow: 'hidden',
  },
  documentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  documentNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00D9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1117',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  documentType: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#0D1117',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statusOverlayText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  completedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderRadius: 20,
    padding: 8,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00D9FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1117',
  },
  confidenceBar: {
    height: 24,
    backgroundColor: '#0D1117',
    position: 'relative',
    overflow: 'hidden',
  },
  confidenceFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 217, 255, 0.3)',
  },
  confidenceText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    fontSize: 12,
    color: '#00D9FF',
    textAlign: 'center',
    lineHeight: 24,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#0D1117',
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#00D9FF',
    paddingVertical: 16,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D1117',
  },
});
