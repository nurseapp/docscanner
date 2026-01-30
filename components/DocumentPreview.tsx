import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  analyzeDocument, 
  AnalysisResult,
  DocumentData,
  PassportData,
  IDCardData,
  DriversLicenseData,
  InvoiceData,
  ReceiptData,
  BusinessCardData,
} from '../services/documentAnalyzer';
import { API_CONFIG, LanguageCode, DocumentType } from '../config/api';
import { DocumentEditor } from './DocumentEditor';
import { ExportModal } from './ExportModal';

const { width } = Dimensions.get('window');

interface DocumentPreviewProps {
  imageUri: string;
  onClose: () => void;
  onSave: (result: AnalysisResult) => void;
  initialAnalysis?: AnalysisResult;
  initialEditedData?: any;
}

export function DocumentPreview({ 
  imageUri, 
  onClose, 
  onSave, 
  initialAnalysis, 
  initialEditedData 
}: DocumentPreviewProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(!initialAnalysis);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(initialAnalysis || null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('auto');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw' | 'image'>('formatted');
  const [showEditor, setShowEditor] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editedData, setEditedData] = useState<any>(initialEditedData || null);
  const [hasEdits, setHasEdits] = useState(!!initialEditedData);

  useEffect(() => {
    // Only perform analysis if we don't have initial analysis data
    if (!initialAnalysis) {
      performAnalysis();
    }
  }, [selectedLanguage, initialAnalysis]);

  const performAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeDocument(imageUri, selectedLanguage);
      setAnalysisResult(result);
    } catch (error: any) {
      Alert.alert('Analysis Error', error.message || 'Failed to analyze document');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = () => {
    if (analysisResult) {
      // Include edited data if available
      const resultToSave = {
        ...analysisResult,
        editedData: editedData,
        hasEdits: hasEdits,
      };
      onSave(resultToSave as AnalysisResult);
    }
  };

  const handleEditorSave = (data: any) => {
    setEditedData(data);
    setHasEdits(true);
    
    // Update the analysis result data with edited content
    if (analysisResult && data.sections) {
      const updatedData: any = { type: analysisResult.documentType };
      
      // Convert sections back to data format
      data.sections.forEach((section: any) => {
        section.fields.forEach((field: any) => {
          const key = field.label
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
          updatedData[key] = field.value;
        });
      });
      
      setAnalysisResult({
        ...analysisResult,
        data: updatedData,
        rawText: data.sections
          .flatMap((s: any) => s.fields.map((f: any) => `${f.label}: ${f.value}`))
          .join('\n'),
      });
      
      // Switch to formatted tab to show changes
      setActiveTab('formatted');
      
      // Show confirmation
      Alert.alert(
        'Changes Saved! ✓',
        'Your edits are now visible in the Formatted view.',
        [{ text: 'OK' }]
      );
    }
    
    setShowEditor(false);
  };

  const handleRetry = () => {
    performAnalysis();
  };

  const getDocumentTypeIcon = (type: DocumentType): string => {
    const icons: Record<DocumentType, string> = {
      passport: 'airplane',
      id_card: 'card',
      drivers_license: 'car',
      invoice: 'receipt',
      receipt: 'cart',
      business_card: 'person',
      contract: 'document-text',
      letter: 'mail',
      form: 'clipboard',
      certificate: 'ribbon',
      bank_statement: 'cash',
      medical_record: 'medkit',
      ticket: 'ticket',
      menu: 'restaurant',
      unknown: 'help-circle',
    };
    return icons[type] || 'document';
  };

  const getDocumentTypeColor = (type: DocumentType): string => {
    const colors: Record<DocumentType, string> = {
      passport: '#3B82F6',
      id_card: '#10B981',
      drivers_license: '#F59E0B',
      invoice: '#8B5CF6',
      receipt: '#EC4899',
      business_card: '#6366F1',
      contract: '#EF4444',
      letter: '#14B8A6',
      form: '#F97316',
      certificate: '#FFD700',
      bank_statement: '#22C55E',
      medical_record: '#EF4444',
      ticket: '#06B6D4',
      menu: '#84CC16',
      unknown: '#6B7280',
    };
    return colors[type] || '#6B7280';
  };

  const renderFormattedContent = () => {
    if (!analysisResult?.data) return null;

    switch (analysisResult.documentType) {
      case 'passport':
        return <PassportFormat data={analysisResult.data as PassportData} />;
      case 'id_card':
        return <IDCardFormat data={analysisResult.data as IDCardData} />;
      case 'drivers_license':
        return <DriversLicenseFormat data={analysisResult.data as DriversLicenseData} />;
      case 'invoice':
        return <InvoiceFormat data={analysisResult.data as InvoiceData} />;
      case 'receipt':
        return <ReceiptFormat data={analysisResult.data as ReceiptData} />;
      case 'business_card':
        return <BusinessCardFormat data={analysisResult.data as BusinessCardData} />;
      default:
        return <GenericFormat data={analysisResult.data} rawText={analysisResult.rawText} />;
    }
  };

  if (isAnalyzing) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <View style={styles.scanningAnimation}>
              <Image source={{ uri: imageUri }} style={styles.scanningImage} />
              <View style={styles.scanLine} />
            </View>
            <ActivityIndicator size="large" color="#00D9FF" style={styles.loader} />
            <Text style={styles.loadingTitle}>Analyzing Document</Text>
            <Text style={styles.loadingText}>
              Detecting document type, extracting text, and formatting data...
            </Text>
            <View style={styles.loadingSteps}>
              <LoadingStep icon="scan" text="Scanning image" active />
              <LoadingStep icon="language" text="Detecting language" />
              <LoadingStep icon="document-text" text="Extracting text" />
              <LoadingStep icon="git-branch" text="Formatting data" />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Document Preview</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleRetry}>
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Document Type Badge */}
      {analysisResult && (
        <View style={styles.documentTypeSection}>
          <View style={[styles.documentTypeBadge, { backgroundColor: `${getDocumentTypeColor(analysisResult.documentType)}20` }]}>
            <Ionicons 
              name={getDocumentTypeIcon(analysisResult.documentType) as any} 
              size={24} 
              color={getDocumentTypeColor(analysisResult.documentType)} 
            />
            <View style={styles.documentTypeInfo}>
              <Text style={[styles.documentTypeLabel, { color: getDocumentTypeColor(analysisResult.documentType) }]}>
                {analysisResult.documentType.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.confidenceText}>
                {Math.round(analysisResult.confidence * 100)}% confidence
              </Text>
            </View>
          </View>
          
          {/* Language Badge */}
          <TouchableOpacity 
            style={styles.languageBadge}
            onPress={() => setShowLanguageSelector(true)}
          >
            <Text style={styles.languageFlag}>
              {API_CONFIG.SUPPORTED_LANGUAGES.find(l => l.code === analysisResult.language.detected)?.flag || '🌐'}
            </Text>
            <Text style={styles.languageText}>{analysisResult.language.name}</Text>
            <Ionicons name="chevron-down" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Tags */}
      {analysisResult?.tags && analysisResult.tags.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tagsContainer}
          contentContainerStyle={styles.tagsContent}
        >
          {analysisResult.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'formatted' && styles.tabActive]}
          onPress={() => setActiveTab('formatted')}
        >
          <Ionicons 
            name="document-text" 
            size={18} 
            color={activeTab === 'formatted' ? '#00D9FF' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'formatted' && styles.tabTextActive]}>
            Formatted
          </Text>
          {hasEdits && (
            <View style={styles.editedBadge}>
              <Text style={styles.editedBadgeText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'raw' && styles.tabActive]}
          onPress={() => setActiveTab('raw')}
        >
          <Ionicons 
            name="code" 
            size={18} 
            color={activeTab === 'raw' ? '#00D9FF' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'raw' && styles.tabTextActive]}>
            Raw Text
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'image' && styles.tabActive]}
          onPress={() => setActiveTab('image')}
        >
          <Ionicons 
            name="image" 
            size={18} 
            color={activeTab === 'image' ? '#00D9FF' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'image' && styles.tabTextActive]}>
            Original
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'formatted' && hasEdits && (
          <View style={styles.editedIndicator}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.editedIndicatorText}>
              Showing your edited version
            </Text>
          </View>
        )}
        {activeTab === 'formatted' && renderFormattedContent()}
        {activeTab === 'raw' && (
          <View style={styles.rawTextContainer}>
            <Text style={styles.rawText}>{analysisResult?.rawText || 'No text extracted'}</Text>
          </View>
        )}
        {activeTab === 'image' && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
          </View>
        )}

        {/* Warnings */}
        {analysisResult?.warnings && analysisResult.warnings.length > 0 && (
          <View style={styles.warningsContainer}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.warningTitle}>Warnings</Text>
            </View>
            {analysisResult.warnings.map((warning, index) => (
              <Text key={index} style={styles.warningText}>• {warning}</Text>
            ))}
          </View>
        )}

        {/* Processing Info */}
        {analysisResult && (
          <View style={styles.processingInfo}>
            <Ionicons name="time" size={14} color="#6B7280" />
            <Text style={styles.processingText}>
              Processed in {(analysisResult.processingTime / 1000).toFixed(1)}s
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.discardButton} onPress={onClose}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => setShowEditor(true)}
        >
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.exportButton} 
          onPress={() => setShowExportModal(true)}
        >
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons name="checkmark" size={20} color="#0D1117" />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Document Editor Modal */}
      <Modal
        visible={showEditor && !!analysisResult}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowEditor(false)}
      >
        {analysisResult && (
          <DocumentEditor
            analysisResult={analysisResult}
            imageUri={imageUri}
            initialEditedData={editedData}
            onClose={() => setShowEditor(false)}
            onSave={handleEditorSave}
          />
        )}
      </Modal>

      {/* Language Selector Modal */}
      <Modal
        visible={showLanguageSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLanguageSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageSelector(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.languageList}>
              {API_CONFIG.SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    selectedLanguage === lang.code && styles.languageOptionActive
                  ]}
                  onPress={() => {
                    setSelectedLanguage(lang.code as LanguageCode);
                    setShowLanguageSelector(false);
                  }}
                >
                  <Text style={styles.languageOptionFlag}>{lang.flag}</Text>
                  <Text style={styles.languageOptionText}>{lang.name}</Text>
                  {selectedLanguage === lang.code && (
                    <Ionicons name="checkmark" size={20} color="#00D9FF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      {analysisResult && (
        <ExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          analysisResult={analysisResult}
          editedData={editedData}
          imageUri={imageUri}
        />
      )}
    </SafeAreaView>
  );
}

// Loading Step Component
function LoadingStep({ icon, text, active = false }: { icon: string; text: string; active?: boolean }) {
  return (
    <View style={[styles.loadingStep, active && styles.loadingStepActive]}>
      <Ionicons name={icon as any} size={16} color={active ? '#00D9FF' : '#6B7280'} />
      <Text style={[styles.loadingStepText, active && styles.loadingStepTextActive]}>{text}</Text>
    </View>
  );
}

// Passport Format Component
function PassportFormat({ data }: { data: PassportData }) {
  return (
    <View style={styles.passportCard}>
      <View style={styles.passportHeader}>
        <Ionicons name="airplane" size={24} color="#3B82F6" />
        <Text style={styles.passportTitle}>PASSPORT</Text>
      </View>
      <View style={styles.passportBody}>
        <DataField label="Document Number" value={data.documentNumber} highlight />
        <View style={styles.passportRow}>
          <DataField label="Surname" value={data.surname} flex />
          <DataField label="Given Names" value={data.givenNames} flex />
        </View>
        <View style={styles.passportRow}>
          <DataField label="Nationality" value={data.nationality} flex />
          <DataField label="Sex" value={data.sex} flex />
        </View>
        <View style={styles.passportRow}>
          <DataField label="Date of Birth" value={data.dateOfBirth} flex />
          <DataField label="Place of Birth" value={data.placeOfBirth} flex />
        </View>
        <View style={styles.passportRow}>
          <DataField label="Date of Issue" value={data.dateOfIssue} flex />
          <DataField label="Date of Expiry" value={data.dateOfExpiry} flex />
        </View>
        <DataField label="Issuing Authority" value={data.issuingAuthority} />
        {data.mrz && (
          <View style={styles.mrzContainer}>
            <Text style={styles.mrzLabel}>Machine Readable Zone</Text>
            <Text style={styles.mrzText}>{data.mrz}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ID Card Format Component
function IDCardFormat({ data }: { data: IDCardData }) {
  return (
    <View style={styles.idCard}>
      <View style={styles.idCardHeader}>
        <Ionicons name="card" size={24} color="#10B981" />
        <Text style={styles.idCardTitle}>IDENTITY CARD</Text>
      </View>
      <View style={styles.idCardBody}>
        <DataField label="Document Number" value={data.documentNumber} highlight />
        <DataField label="Full Name" value={data.fullName} />
        <View style={styles.passportRow}>
          <DataField label="Date of Birth" value={data.dateOfBirth} flex />
          <DataField label="Sex" value={data.sex} flex />
        </View>
        <DataField label="Nationality" value={data.nationality} />
        <DataField label="Address" value={data.address} />
        <View style={styles.passportRow}>
          <DataField label="Date of Issue" value={data.dateOfIssue} flex />
          <DataField label="Date of Expiry" value={data.dateOfExpiry} flex />
        </View>
        <DataField label="Issuing Authority" value={data.issuingAuthority} />
      </View>
    </View>
  );
}

// Driver's License Format Component
function DriversLicenseFormat({ data }: { data: DriversLicenseData }) {
  return (
    <View style={styles.licenseCard}>
      <View style={styles.licenseHeader}>
        <Ionicons name="car" size={24} color="#F59E0B" />
        <Text style={styles.licenseTitle}>DRIVER'S LICENSE</Text>
      </View>
      <View style={styles.licenseBody}>
        <DataField label="License Number" value={data.licenseNumber} highlight />
        <DataField label="Full Name" value={data.fullName} />
        <DataField label="Date of Birth" value={data.dateOfBirth} />
        <DataField label="Address" value={data.address} />
        <DataField label="License Class" value={data.licenseClass} highlight />
        <View style={styles.passportRow}>
          <DataField label="Date of Issue" value={data.dateOfIssue} flex />
          <DataField label="Date of Expiry" value={data.dateOfExpiry} flex />
        </View>
        {data.restrictions && <DataField label="Restrictions" value={data.restrictions} />}
        {data.endorsements && <DataField label="Endorsements" value={data.endorsements} />}
      </View>
    </View>
  );
}

// Invoice Format Component
function InvoiceFormat({ data }: { data: InvoiceData }) {
  return (
    <View style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <Ionicons name="receipt" size={24} color="#8B5CF6" />
        <Text style={styles.invoiceTitle}>INVOICE</Text>
        <Text style={styles.invoiceNumber}>#{data.invoiceNumber}</Text>
      </View>
      <View style={styles.invoiceBody}>
        <View style={styles.invoiceParties}>
          <View style={styles.invoiceParty}>
            <Text style={styles.partyLabel}>From</Text>
            <Text style={styles.partyName}>{data.vendor?.name}</Text>
            <Text style={styles.partyDetail}>{data.vendor?.address}</Text>
            {data.vendor?.email && <Text style={styles.partyDetail}>{data.vendor.email}</Text>}
          </View>
          <View style={styles.invoiceParty}>
            <Text style={styles.partyLabel}>To</Text>
            <Text style={styles.partyName}>{data.customer?.name}</Text>
            <Text style={styles.partyDetail}>{data.customer?.address}</Text>
          </View>
        </View>
        <View style={styles.invoiceDates}>
          <DataField label="Date" value={data.date} flex />
          {data.dueDate && <DataField label="Due Date" value={data.dueDate} flex />}
        </View>
        <View style={styles.itemsTable}>
          <View style={styles.itemsHeader}>
            <Text style={[styles.itemHeaderText, { flex: 2 }]}>Description</Text>
            <Text style={styles.itemHeaderText}>Qty</Text>
            <Text style={styles.itemHeaderText}>Price</Text>
            <Text style={styles.itemHeaderText}>Total</Text>
          </View>
          {data.items?.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={[styles.itemText, { flex: 2 }]}>{item.description}</Text>
              <Text style={styles.itemText}>{item.quantity}</Text>
              <Text style={styles.itemText}>{item.unitPrice?.toFixed(2)}</Text>
              <Text style={styles.itemText}>{item.total?.toFixed(2)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.invoiceTotals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{data.currency} {data.subtotal?.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>{data.currency} {data.tax?.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{data.currency} {data.total?.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Receipt Format Component
function ReceiptFormat({ data }: { data: ReceiptData }) {
  return (
    <View style={styles.receiptCard}>
      <View style={styles.receiptHeader}>
        <Text style={styles.receiptMerchant}>{data.merchantName}</Text>
        {data.merchantAddress && <Text style={styles.receiptAddress}>{data.merchantAddress}</Text>}
        <Text style={styles.receiptDate}>{data.date} {data.time}</Text>
      </View>
      <View style={styles.receiptDivider} />
      <View style={styles.receiptItems}>
        {data.items?.map((item, index) => (
          <View key={index} style={styles.receiptItem}>
            <Text style={styles.receiptItemName}>
              {item.quantity ? `${item.quantity}x ` : ''}{item.name}
            </Text>
            <Text style={styles.receiptItemPrice}>{data.currency} {item.price?.toFixed(2)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.receiptDivider} />
      <View style={styles.receiptTotals}>
        {data.subtotal && (
          <View style={styles.receiptTotalRow}>
            <Text style={styles.receiptTotalLabel}>Subtotal</Text>
            <Text style={styles.receiptTotalValue}>{data.currency} {data.subtotal.toFixed(2)}</Text>
          </View>
        )}
        {data.tax && (
          <View style={styles.receiptTotalRow}>
            <Text style={styles.receiptTotalLabel}>Tax</Text>
            <Text style={styles.receiptTotalValue}>{data.currency} {data.tax.toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.receiptTotalRow, styles.receiptGrandTotal]}>
          <Text style={styles.receiptGrandLabel}>TOTAL</Text>
          <Text style={styles.receiptGrandValue}>{data.currency} {data.total?.toFixed(2)}</Text>
        </View>
      </View>
      {data.paymentMethod && (
        <Text style={styles.receiptPayment}>Payment: {data.paymentMethod}</Text>
      )}
      {data.transactionId && (
        <Text style={styles.receiptTransaction}>Ref: {data.transactionId}</Text>
      )}
    </View>
  );
}

// Business Card Format Component
function BusinessCardFormat({ data }: { data: BusinessCardData }) {
  return (
    <View style={styles.businessCard}>
      <View style={styles.businessCardHeader}>
        <Text style={styles.businessName}>{data.name}</Text>
        {data.title && <Text style={styles.businessTitle}>{data.title}</Text>}
        {data.company && <Text style={styles.businessCompany}>{data.company}</Text>}
      </View>
      <View style={styles.businessCardBody}>
        {data.phone?.map((phone, index) => (
          <View key={index} style={styles.contactRow}>
            <Ionicons name="call" size={16} color="#00D9FF" />
            <Text style={styles.contactText}>{phone}</Text>
          </View>
        ))}
        {data.email?.map((email, index) => (
          <View key={index} style={styles.contactRow}>
            <Ionicons name="mail" size={16} color="#00D9FF" />
            <Text style={styles.contactText}>{email}</Text>
          </View>
        ))}
        {data.website && (
          <View style={styles.contactRow}>
            <Ionicons name="globe" size={16} color="#00D9FF" />
            <Text style={styles.contactText}>{data.website}</Text>
          </View>
        )}
        {data.address && (
          <View style={styles.contactRow}>
            <Ionicons name="location" size={16} color="#00D9FF" />
            <Text style={styles.contactText}>{data.address}</Text>
          </View>
        )}
        {data.socialMedia?.map((social, index) => (
          <View key={index} style={styles.contactRow}>
            <Ionicons name="logo-linkedin" size={16} color="#00D9FF" />
            <Text style={styles.contactText}>{social.platform}: {social.handle}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Generic Format Component - handles any document type
function GenericFormat({ data, rawText }: { data: any; rawText: string }) {
  // Extract all fields from the data object for display
  const getDisplayFields = () => {
    if (!data) return [];
    
    const excludeKeys = ['type', 'rawText', 'raw_text', 'tags'];
    const fields: { label: string; value: string }[] = [];
    
    // If keyFields exists, use those
    if (data.keyFields && Array.isArray(data.keyFields)) {
      return data.keyFields;
    }
    
    // Otherwise, iterate through all object properties
    Object.entries(data).forEach(([key, value]) => {
      if (excludeKeys.includes(key)) return;
      if (value === null || value === undefined) return;
      
      // Format the key as a readable label
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();
      
      // Handle different value types
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - flatten it
        Object.entries(value as Record<string, any>).forEach(([subKey, subValue]) => {
          if (subValue !== null && subValue !== undefined) {
            const subLabel = `${label} - ${subKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}`;
            fields.push({ label: subLabel, value: String(subValue) });
          }
        });
      } else if (Array.isArray(value)) {
        // Array - join items or show count
        if (value.length > 0) {
          if (typeof value[0] === 'object') {
            fields.push({ label, value: `${value.length} items` });
          } else {
            fields.push({ label, value: value.join(', ') });
          }
        }
      } else {
        fields.push({ label, value: String(value) });
      }
    });
    
    return fields;
  };

  const displayFields = getDisplayFields();

  return (
    <View style={styles.genericCard}>
      {data.title && <Text style={styles.genericTitle}>{data.title}</Text>}
      {data.summary && <Text style={styles.genericSummary}>{data.summary}</Text>}
      
      {displayFields.length > 0 ? (
        displayFields.map((field: any, index: number) => (
          <DataField key={index} label={field.label} value={field.value} />
        ))
      ) : (
        <View style={styles.genericContent}>
          <Text style={styles.genericContentText}>
            {rawText || data.content || 'No structured data extracted'}
          </Text>
        </View>
      )}
      
      {data.content && displayFields.length > 0 && (
        <View style={styles.genericContent}>
          <Text style={styles.genericContentText}>{data.content}</Text>
        </View>
      )}
    </View>
  );
}

// Data Field Component
function DataField({ 
  label, 
  value, 
  highlight = false,
  flex = false 
}: { 
  label: string; 
  value: string; 
  highlight?: boolean;
  flex?: boolean;
}) {
  return (
    <View style={[styles.dataField, flex && { flex: 1 }]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={[styles.dataValue, highlight && styles.dataValueHighlight]}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingContent: {
    alignItems: 'center',
  },
  scanningAnimation: {
    width: 200,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  scanningImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00D9FF',
  },
  loader: {
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  loadingSteps: {
    width: '100%',
    gap: 12,
  },
  loadingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#161B22',
    borderRadius: 8,
  },
  loadingStepActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
  },
  loadingStepText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingStepTextActive: {
    color: '#00D9FF',
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
  headerButton: {
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
  documentTypeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  documentTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 12,
  },
  documentTypeInfo: {
    gap: 2,
  },
  documentTypeLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  confidenceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  languageFlag: {
    fontSize: 16,
  },
  languageText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  tagsContainer: {
    maxHeight: 40,
    marginBottom: 8,
  },
  tagsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  tag: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#00D9FF',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    backgroundColor: '#161B22',
  },
  tabActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#00D9FF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  rawTextContainer: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  rawText: {
    fontSize: 14,
    color: '#E6EDF3',
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  imageContainer: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  warningsContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  warningText: {
    fontSize: 13,
    color: '#FCD34D',
    lineHeight: 20,
  },
  processingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  processingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  discardButton: {
    width: 48,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  discardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    gap: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    gap: 6,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#00D9FF',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D1117',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161B22',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  languageList: {
    padding: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  languageOptionActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
  },
  languageOptionFlag: {
    fontSize: 24,
  },
  languageOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  // Data Field styles
  dataField: {
    marginBottom: 12,
  },
  dataLabel: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 15,
    color: '#E6EDF3',
    fontWeight: '500',
  },
  dataValueHighlight: {
    color: '#00D9FF',
    fontWeight: '700',
  },
  // Passport styles
  passportCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  passportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F620',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3B82F640',
  },
  passportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 1,
  },
  passportBody: {
    padding: 16,
  },
  passportRow: {
    flexDirection: 'row',
    gap: 16,
  },
  mrzContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#0D1117',
    borderRadius: 8,
  },
  mrzLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  mrzText: {
    fontSize: 12,
    color: '#00D9FF',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  // ID Card styles
  idCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  idCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#10B98140',
  },
  idCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 1,
  },
  idCardBody: {
    padding: 16,
  },
  // License styles
  licenseCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  licenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B40',
  },
  licenseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 1,
  },
  licenseBody: {
    padding: 16,
  },
  // Invoice styles
  invoiceCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#8B5CF640',
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
    letterSpacing: 1,
  },
  invoiceNumber: {
    marginLeft: 'auto',
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  invoiceBody: {
    padding: 16,
  },
  invoiceParties: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  invoiceParty: {
    flex: 1,
    backgroundColor: '#0D1117',
    borderRadius: 12,
    padding: 12,
  },
  partyLabel: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  partyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  partyDetail: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  invoiceDates: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  itemsTable: {
    backgroundColor: '#0D1117',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    backgroundColor: '#1C2128',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    color: '#E6EDF3',
  },
  invoiceTotals: {
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    paddingTop: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 13,
    color: '#E6EDF3',
  },
  grandTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00D9FF',
  },
  // Receipt styles
  receiptCard: {
    backgroundColor: '#FFFEF5',
    borderRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptMerchant: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  receiptAddress: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  receiptDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 12,
    borderStyle: 'dashed',
  },
  receiptItems: {
    gap: 6,
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptItemName: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  receiptItemPrice: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  receiptTotals: {
    gap: 4,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptTotalLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  receiptTotalValue: {
    fontSize: 13,
    color: '#1F2937',
  },
  receiptGrandTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  receiptGrandLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  receiptGrandValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  receiptPayment: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  receiptTransaction: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  // Business Card styles
  businessCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  businessCardHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  businessName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  businessTitle: {
    fontSize: 14,
    color: '#A5B4FC',
    marginBottom: 2,
  },
  businessCompany: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  businessCardBody: {
    padding: 16,
    gap: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 14,
    color: '#E6EDF3',
  },
  // Generic styles
  genericCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  genericTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  genericSummary: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
    lineHeight: 20,
  },
  genericContent: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#0D1117',
    borderRadius: 8,
  },
  genericContentText: {
    fontSize: 14,
    color: '#E6EDF3',
    lineHeight: 22,
  },
  // Edited indicator styles
  editedBadge: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  editedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  editedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 8,
  },
  editedIndicatorText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
});
