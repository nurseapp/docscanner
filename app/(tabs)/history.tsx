import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { PinModal } from '../../components/PinModal';
import { DocumentPreview } from '../../components/DocumentPreview';
import {
  isDocumentProtected,
  setDocumentPin,
  verifyDocumentPin,
  removeDocumentPin,
  getProtectionStatus,
  bulkProtectDocuments,
} from '../../services/documentSecurity';
import {
  getDocumentMetadataList,
  DocumentMetadata,
  deleteDocuments,
  getDocument,
  SavedDocument,
  updateDocument,
} from '../../services/documentStorage';
import { AnalysisResult } from '../../services/documentAnalyzer';

const { width } = Dimensions.get('window');

const FILTERS = ['All', 'PDF', 'Images', 'Protected', 'Recent', 'Edited'];

export default function HistoryScreen() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [protectedDocs, setProtectedDocs] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Document preview states
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SavedDocument | null>(null);
  
  // PIN Modal states
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState<'set' | 'verify' | 'change'>('set');
  const [pinError, setPinError] = useState('');
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'open' | 'unlock' | null>(null);

  // Load documents from storage
  const loadDocuments = useCallback(async () => {
    try {
      const docs = await getDocumentMetadataList();
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  }, []);

  // Load protection status
  const loadProtectionStatus = useCallback(async () => {
    if (documents.length === 0) return;
    const docIds = documents.map(d => d.id);
    const status = await getProtectionStatus(docIds);
    const protectedSet = new Set<string>();
    Object.entries(status).forEach(([id, isProtected]) => {
      if (isProtected) protectedSet.add(id);
    });
    setProtectedDocs(protectedSet);
  }, [documents]);

  // Load data on mount and when screen is focused
  useEffect(() => {
    loadDocuments().finally(() => setIsLoading(false));
  }, [loadDocuments]);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [loadDocuments])
  );

  useEffect(() => {
    loadProtectionStatus();
  }, [loadProtectionStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDocuments();
    await loadProtectionStatus();
    setRefreshing(false);
  }, [loadDocuments, loadProtectionStatus]);

  // Toggle document selection
  const toggleSelection = (docId: string) => {
    const newSelection = new Set(selectedDocs);
    if (newSelection.has(docId)) {
      newSelection.delete(docId);
    } else {
      newSelection.add(docId);
    }
    setSelectedDocs(newSelection);
  };

  // Handle document press
  const handleDocumentPress = async (docId: string) => {
    if (selectionMode) {
      toggleSelection(docId);
      return;
    }

    // Check if document is protected
    if (protectedDocs.has(docId)) {
      setCurrentDocId(docId);
      setPendingAction('open');
      setPinMode('verify');
      setPinError('');
      setShowPinModal(true);
    } else {
      // Open document normally
      openDocument(docId);
    }
  };

  // Handle long press to enter selection mode
  const handleLongPress = (docId: string) => {
    setSelectionMode(true);
    setSelectedDocs(new Set([docId]));
  };

  // Open document
  const openDocument = async (docId: string) => {
    try {
      const doc = await getDocument(docId);
      if (doc) {
        setSelectedDocument(doc);
        setShowDocumentPreview(true);
      } else {
        Alert.alert('Error', 'Document not found');
      }
    } catch (error) {
      console.error('Error opening document:', error);
      Alert.alert('Error', 'Failed to open document');
    }
  };
  
  // Handle document save (after editing)
  const handleDocumentSave = async (result: AnalysisResult & { editedData?: any; hasEdits?: boolean }) => {
    if (!selectedDocument) return;
    
    try {
      // Update the document in storage
      await updateDocument(selectedDocument.id, {
        analysisResult: result,
        editedData: result.editedData,
        hasEdits: result.hasEdits || false,
      });
      
      // Refresh the document list
      await loadDocuments();
      
      // Close the preview
      setShowDocumentPreview(false);
      setSelectedDocument(null);
      
      Alert.alert('Success', 'Document updated successfully');
    } catch (error) {
      console.error('Error saving document:', error);
      Alert.alert('Error', 'Failed to save document changes');
    }
  };

  // Handle lock action
  const handleLockSelected = () => {
    if (selectedDocs.size === 0) return;
    
    setPinMode('set');
    setPinError('');
    setShowPinModal(true);
  };

  // Handle unlock action
  const handleUnlockSelected = () => {
    if (selectedDocs.size === 0) return;
    
    // Check if all selected docs are protected
    const allProtected = Array.from(selectedDocs).every(id => protectedDocs.has(id));
    if (!allProtected) {
      Alert.alert('Error', 'Some selected documents are not protected');
      return;
    }
    
    setPinMode('verify');
    setPendingAction('unlock');
    setPinError('');
    setShowPinModal(true);
  };

  // Handle PIN submission
  const handlePinSubmit = async (pin: string) => {
    try {
      if (pinMode === 'set') {
        // Lock selected documents
        const docIds = Array.from(selectedDocs);
        const success = await bulkProtectDocuments(docIds, pin);
        
        if (success) {
          setShowPinModal(false);
          await loadProtectionStatus();
          setSelectionMode(false);
          setSelectedDocs(new Set());
          Alert.alert('Success', `${docIds.length} document(s) locked`);
        } else {
          setPinError('Failed to lock documents');
        }
      } else if (pinMode === 'verify') {
        if (pendingAction === 'open' && currentDocId) {
          // Verify PIN to open document
          const isValid = await verifyDocumentPin(currentDocId, pin);
          if (isValid) {
            setShowPinModal(false);
            openDocument(currentDocId);
          } else {
            setPinError('Incorrect PIN');
          }
        } else if (pendingAction === 'unlock') {
          // Verify PIN to unlock selected documents
          const docIds = Array.from(selectedDocs);
          let allValid = true;
          
          for (const docId of docIds) {
            const isValid = await verifyDocumentPin(docId, pin);
            if (!isValid) {
              allValid = false;
              break;
            }
          }
          
          if (allValid) {
            // Remove protection from all selected docs
            for (const docId of docIds) {
              await removeDocumentPin(docId, pin);
            }
            setShowPinModal(false);
            await loadProtectionStatus();
            setSelectionMode(false);
            setSelectedDocs(new Set());
            Alert.alert('Success', `${docIds.length} document(s) unlocked`);
          } else {
            setPinError('Incorrect PIN');
          }
        }
      }
    } catch (error: any) {
      setPinError(error.message || 'An error occurred');
    }
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedDocs(new Set());
  };

  // Select all documents
  const selectAll = () => {
    setSelectedDocs(new Set(documents.map(d => d.id)));
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    // Search filter
    if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Type filter
    if (activeFilter === 'PDF' && doc.type !== 'pdf') return false;
    if (activeFilter === 'Images' && doc.type !== 'image') return false;
    if (activeFilter === 'Protected' && !protectedDocs.has(doc.id)) return false;
    if (activeFilter === 'Edited' && !doc.hasEdits) return false;
    
    return true;
  });

  // Handle delete selected
  const handleDeleteSelected = async () => {
    if (selectedDocs.size === 0) return;
    
    Alert.alert(
      'Delete Documents',
      `Are you sure you want to delete ${selectedDocs.size} document(s)? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ids = Array.from(selectedDocs);
            const success = await deleteDocuments(ids);
            if (success) {
              await loadDocuments();
              setSelectionMode(false);
              setSelectedDocs(new Set());
              Alert.alert('Deleted', `${ids.length} document(s) deleted`);
            } else {
              Alert.alert('Error', 'Failed to delete documents');
            }
          },
        },
      ]
    );
  };

  // Count protected in selection
  const protectedInSelection = Array.from(selectedDocs).filter(id => protectedDocs.has(id)).length;
  const unprotectedInSelection = selectedDocs.size - protectedInSelection;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background */}
      <View style={styles.backgroundPattern}>
        <View style={styles.gradientCircle1} />
        <View style={styles.gradientCircle2} />
      </View>

      {/* Header */}
      {selectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity style={styles.selectionClose} onPress={exitSelectionMode}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.selectionCount}>{selectedDocs.size} selected</Text>
          <TouchableOpacity style={styles.selectAllButton} onPress={selectAll}>
            <Text style={styles.selectAllText}>Select All</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.viewToggle, viewMode === 'list' && styles.viewToggleActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons
                name="list"
                size={20}
                color={viewMode === 'list' ? '#00D9FF' : '#6B7280'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggle, viewMode === 'grid' && styles.viewToggleActive]}
              onPress={() => setViewMode('grid')}
            >
              <Ionicons
                name="grid"
                size={20}
                color={viewMode === 'grid' ? '#00D9FF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScrollView}
        contentContainerStyle={styles.filtersContainer}
      >
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterPill,
              activeFilter === filter && styles.filterPillActive,
              filter === 'Protected' && styles.filterPillProtected,
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            {filter === 'Protected' && (
              <Ionicons 
                name="lock-closed" 
                size={12} 
                color={activeFilter === filter ? '#F59E0B' : '#6B7280'} 
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[
                styles.filterPillText,
                activeFilter === filter && styles.filterPillTextActive,
                filter === 'Protected' && activeFilter === filter && styles.filterPillTextProtected,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Documents Count */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {filteredDocuments.length} documents
          {protectedDocs.size > 0 && (
            <Text style={styles.protectedCountText}> • {protectedDocs.size} protected</Text>
          )}
        </Text>
        <TouchableOpacity style={styles.sortButton}>
          <Text style={styles.sortText}>Date</Text>
          <Ionicons name="chevron-down" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Documents List/Grid */}
      <ScrollView
        style={styles.documentsScrollView}
        contentContainerStyle={[
          styles.documentsContainer,
          documents.length === 0 && styles.emptyContainer,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D9FF" />
        }
      >
        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00D9FF" />
            <Text style={styles.loadingText}>Loading documents...</Text>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && documents.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="document-text-outline" size={64} color="#30363D" />
            </View>
            <Text style={styles.emptyTitle}>No Documents Yet</Text>
            <Text style={styles.emptySubtitle}>
              Scan or import your first document from the Dashboard to see it here.
            </Text>
          </View>
        )}

        {/* No Results State */}
        {!isLoading && documents.length > 0 && filteredDocuments.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#30363D" />
            <Text style={styles.emptyTitle}>No Results</Text>
            <Text style={styles.emptySubtitle}>
              No documents match your current filters.
            </Text>
          </View>
        )}

        {!isLoading && filteredDocuments.length > 0 && (
          viewMode === 'list' ? (
            // List View
            filteredDocuments.map((doc) => {
            const isProtected = protectedDocs.has(doc.id);
            const isSelected = selectedDocs.has(doc.id);
            
            return (
              <TouchableOpacity 
                key={doc.id} 
                style={[
                  styles.documentCard,
                  isSelected && styles.documentCardSelected,
                ]}
                onPress={() => handleDocumentPress(doc.id)}
                onLongPress={() => handleLongPress(doc.id)}
                delayLongPress={300}
              >
                {/* Selection Checkbox */}
                {selectionMode && (
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#0D1117" />
                    )}
                  </View>
                )}
                
                <View style={[styles.documentIcon, { backgroundColor: `${doc.color}15` }]}>
                  <Ionicons
                    name={doc.type === 'pdf' ? 'document-text' : 'image'}
                    size={24}
                    color={doc.color}
                  />
                  {/* Lock Badge */}
                  {isProtected && (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.documentInfo}>
                  <View style={styles.documentNameRow}>
                    <Text style={styles.documentName} numberOfLines={1}>
                      {doc.name}
                    </Text>
                    {isProtected && (
                      <View style={styles.protectedTag}>
                        <Ionicons name="shield-checkmark" size={10} color="#F59E0B" />
                      </View>
                    )}
                  </View>
                  <View style={styles.documentMeta}>
                    <Text style={styles.documentMetaText}>{doc.date}</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.documentMetaText}>{doc.pages} pages</Text>
                    <View style={styles.metaDot} />
                    <Text style={styles.documentMetaText}>{doc.size}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.documentAction}
                  onPress={() => {
                    if (!selectionMode) {
                      handleLongPress(doc.id);
                    }
                  }}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        ) : (
          // Grid View
          <View style={styles.gridContainer}>
            {filteredDocuments.map((doc) => {
              const isProtected = protectedDocs.has(doc.id);
              const isSelected = selectedDocs.has(doc.id);
              
              return (
                <TouchableOpacity 
                  key={doc.id} 
                  style={[
                    styles.gridCard,
                    isSelected && styles.gridCardSelected,
                  ]}
                  onPress={() => handleDocumentPress(doc.id)}
                  onLongPress={() => handleLongPress(doc.id)}
                  delayLongPress={300}
                >
                  <View style={[styles.gridPreview, { backgroundColor: `${doc.color}10` }]}>
                    <Ionicons
                      name={doc.type === 'pdf' ? 'document-text' : 'image'}
                      size={40}
                      color={doc.color}
                    />
                    
                    {/* Lock Overlay */}
                    {isProtected && (
                      <View style={styles.gridLockOverlay}>
                        <View style={styles.gridLockIcon}>
                          <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
                        </View>
                      </View>
                    )}
                    
                    {/* Selection Checkbox */}
                    {selectionMode && (
                      <View style={[
                        styles.gridCheckbox,
                        isSelected && styles.gridCheckboxSelected,
                      ]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#0D1117" />
                        )}
                      </View>
                    )}
                    
                    <View style={styles.gridBadge}>
                      <Text style={styles.gridBadgeText}>{doc.pages}</Text>
                    </View>
                  </View>
                  <View style={styles.gridInfo}>
                    <View style={styles.gridNameRow}>
                      <Text style={styles.gridName} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      {isProtected && (
                        <Ionicons name="lock-closed" size={12} color="#F59E0B" />
                      )}
                    </View>
                    <Text style={styles.gridMeta}>{doc.date}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          )
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Selection Actions */}
      {selectionMode && selectedDocs.size > 0 && (
        <View style={styles.selectionActions}>
          {unprotectedInSelection > 0 && (
            <TouchableOpacity 
              style={styles.selectionActionButton}
              onPress={handleLockSelected}
            >
              <Ionicons name="lock-closed" size={20} color="#F59E0B" />
              <Text style={styles.selectionActionText}>Lock</Text>
            </TouchableOpacity>
          )}
          
          {protectedInSelection > 0 && (
            <TouchableOpacity 
              style={styles.selectionActionButton}
              onPress={handleUnlockSelected}
            >
              <Ionicons name="lock-open" size={20} color="#10B981" />
              <Text style={styles.selectionActionText}>Unlock</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.selectionActionButton}>
            <Ionicons name="share-outline" size={20} color="#00D9FF" />
            <Text style={styles.selectionActionText}>Share</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.selectionActionButton}
            onPress={handleDeleteSelected}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={[styles.selectionActionText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button */}
      {!selectionMode && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
          <View style={styles.fabGlow} />
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* PIN Modal */}
      <PinModal
        visible={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPinError('');
          setCurrentDocId(null);
          setPendingAction(null);
        }}
        onSubmit={handlePinSubmit}
        mode={pinMode}
        error={pinError}
      />
      
      {/* Document Preview Modal */}
      {showDocumentPreview && selectedDocument && (
        <Modal
          visible={showDocumentPreview}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <DocumentPreview
            imageUri={selectedDocument.imageUri}
            onClose={() => {
              setShowDocumentPreview(false);
              setSelectedDocument(null);
            }}
            onSave={handleDocumentSave}
            initialAnalysis={selectedDocument.analysisResult}
            initialEditedData={selectedDocument.editedData}
          />
        </Modal>
      )}
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
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    top: -100,
    left: -100,
  },
  gradientCircle2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0, 217, 255, 0.05)',
    bottom: 200,
    right: -80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },
  selectionClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#21262D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCount: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#00D9FF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  viewToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewToggleActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#161B22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  filtersScrollView: {
    maxHeight: 44,
    marginBottom: 16,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  filterPillActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    borderColor: '#00D9FF',
  },
  filterPillProtected: {
    // Special styling for protected filter
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterPillTextActive: {
    color: '#00D9FF',
  },
  filterPillTextProtected: {
    color: '#F59E0B',
  },
  countContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  countText: {
    fontSize: 14,
    color: '#6B7280',
  },
  protectedCountText: {
    color: '#F59E0B',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 14,
    color: '#6B7280',
  },
  documentsScrollView: {
    flex: 1,
  },
  documentsContainer: {
    paddingHorizontal: 20,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  documentCardSelected: {
    borderColor: '#00D9FF',
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#30363D',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#00D9FF',
    borderColor: '#00D9FF',
  },
  documentIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#161B22',
  },
  documentInfo: {
    flex: 1,
  },
  documentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  protectedTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: 4,
    borderRadius: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentMetaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#6B7280',
    marginHorizontal: 8,
  },
  documentAction: {
    padding: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    flexBasis: '47%',
    backgroundColor: '#161B22',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  gridCardSelected: {
    borderColor: '#00D9FF',
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
  },
  gridPreview: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gridLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLockIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCheckbox: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCheckboxSelected: {
    backgroundColor: '#00D9FF',
    borderColor: '#00D9FF',
  },
  gridBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gridBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gridInfo: {
    padding: 12,
  },
  gridNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 4,
  },
  gridName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  gridMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  bottomSpacer: {
    height: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#161B22',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  selectionActions: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#30363D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  selectionActionButton: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
  },
  selectionActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00D9FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D9FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  fabGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    backgroundColor: '#00D9FF',
    opacity: 0.3,
    transform: [{ scale: 1.2 }],
  },
});
