import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnalysisResult, DocumentData } from '../services/documentAnalyzer';
import { DocumentType } from '../config/api';

const { width, height } = Dimensions.get('window');

// Text formatting options
interface TextStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fontSize: number;
  color: string;
  backgroundColor: string;
  alignment: 'left' | 'center' | 'right' | 'justify';
}

// Editable field structure
interface EditableField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'date' | 'number' | 'multiline' | 'header' | 'divider';
  style: TextStyle;
  isEditing: boolean;
}

// Document section
interface DocumentSection {
  id: string;
  title: string;
  fields: EditableField[];
  collapsed: boolean;
}

interface DocumentEditorProps {
  analysisResult: AnalysisResult;
  imageUri: string;
  initialEditedData?: any;
  onSave: (editedData: any) => void;
  onClose: () => void;
}

const DEFAULT_STYLE: TextStyle = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  fontSize: 14,
  color: '#E6EDF3',
  backgroundColor: 'transparent',
  alignment: 'left',
};

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const COLORS = [
  '#FFFFFF', '#E6EDF3', '#9CA3AF', '#6B7280',
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#00D9FF', '#FFD700',
];

export function DocumentEditor({ analysisResult, imageUri, initialEditedData, onSave, onClose }: DocumentEditorProps) {
  // Initialize sections from previous edits if available, otherwise from analysis
  const [sections, setSections] = useState<DocumentSection[]>(() => {
    if (initialEditedData?.sections) {
      return initialEditedData.sections.map((section: any, sIndex: number) => ({
        id: section.id || `section_${sIndex}`,
        title: section.title,
        fields: section.fields.map((field: any, fIndex: number) => ({
          id: field.id || `field_${sIndex}_${fIndex}`,
          label: field.label,
          value: field.value,
          type: field.type || 'text',
          style: field.style || DEFAULT_STYLE,
          isEditing: false,
        })),
        collapsed: section.collapsed || false,
      }));
    }
    return convertToSections(analysisResult);
  });
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [currentStyle, setCurrentStyle] = useState<TextStyle>(DEFAULT_STYLE);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<EditableField['type']>('text');
  const [documentTitle, setDocumentTitle] = useState(
    initialEditedData?.title || getDocumentTitle(analysisResult.documentType)
  );
  const [showPreview, setShowPreview] = useState(false);
  const [undoStack, setUndoStack] = useState<DocumentSection[][]>([]);
  const [redoStack, setRedoStack] = useState<DocumentSection[][]>([]);

  // Save state for undo
  const saveToUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), JSON.parse(JSON.stringify(sections))]);
    setRedoStack([]);
    setHasUnsavedChanges(true);
  }, [sections]);
  
  // Handle close - auto-save changes
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      // Auto-save before closing
      const editedData = {
        title: documentTitle,
        sections: sections.map(section => ({
          id: section.id,
          title: section.title,
          fields: section.fields.map(field => ({
            id: field.id,
            label: field.label,
            value: field.value,
            type: field.type,
            style: field.style,
          })),
          collapsed: section.collapsed,
        })),
        originalAnalysis: analysisResult,
      };
      onSave(editedData);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, documentTitle, sections, analysisResult, onSave, onClose]);

  // Undo action
  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previous = undoStack[undoStack.length - 1];
      setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(sections))]);
      setSections(previous);
      setUndoStack(prev => prev.slice(0, -1));
    }
  };

  // Redo action
  const handleRedo = () => {
    if (redoStack.length > 0) {
      const next = redoStack[redoStack.length - 1];
      setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(sections))]);
      setSections(next);
      setRedoStack(prev => prev.slice(0, -1));
    }
  };

  // Update field value
  const updateFieldValue = (sectionId: string, fieldId: string, value: string) => {
    saveToUndo();
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.id === fieldId) {
              return { ...field, value };
            }
            return field;
          })
        };
      }
      return section;
    }));
  };

  // Update field style
  const updateFieldStyle = (sectionId: string, fieldId: string, style: Partial<TextStyle>) => {
    saveToUndo();
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.id === fieldId) {
              return { ...field, style: { ...field.style, ...style } };
            }
            return field;
          })
        };
      }
      return section;
    }));
  };

  // Toggle style for active field
  const toggleStyle = (styleKey: keyof Pick<TextStyle, 'bold' | 'italic' | 'underline' | 'strikethrough'>) => {
    if (!activeFieldId) return;
    
    const [sectionId, fieldId] = findFieldLocation(activeFieldId);
    if (sectionId && fieldId) {
      const field = sections
        .find(s => s.id === sectionId)
        ?.fields.find(f => f.id === fieldId);
      
      if (field) {
        updateFieldStyle(sectionId, fieldId, { [styleKey]: !field.style[styleKey] });
        setCurrentStyle(prev => ({ ...prev, [styleKey]: !prev[styleKey] }));
      }
    }
  };

  // Set alignment for active field
  const setAlignment = (alignment: TextStyle['alignment']) => {
    if (!activeFieldId) return;
    
    const [sectionId, fieldId] = findFieldLocation(activeFieldId);
    if (sectionId && fieldId) {
      updateFieldStyle(sectionId, fieldId, { alignment });
      setCurrentStyle(prev => ({ ...prev, alignment }));
    }
  };

  // Set font size
  const setFontSize = (fontSize: number) => {
    if (!activeFieldId) return;
    
    const [sectionId, fieldId] = findFieldLocation(activeFieldId);
    if (sectionId && fieldId) {
      updateFieldStyle(sectionId, fieldId, { fontSize });
      setCurrentStyle(prev => ({ ...prev, fontSize }));
    }
    setShowFontSizePicker(false);
  };

  // Set color
  const setColor = (color: string) => {
    if (!activeFieldId) return;
    
    const [sectionId, fieldId] = findFieldLocation(activeFieldId);
    if (sectionId && fieldId) {
      updateFieldStyle(sectionId, fieldId, { color });
      setCurrentStyle(prev => ({ ...prev, color }));
    }
    setShowColorPicker(false);
  };

  // Find field location
  const findFieldLocation = (fieldId: string): [string | null, string | null] => {
    for (const section of sections) {
      const field = section.fields.find(f => f.id === fieldId);
      if (field) {
        return [section.id, fieldId];
      }
    }
    return [null, null];
  };

  // Add new field
  const addField = (sectionId: string) => {
    if (!newFieldLabel.trim()) return;
    
    saveToUndo();
    const newField: EditableField = {
      id: `field_${Date.now()}`,
      label: newFieldLabel,
      value: '',
      type: newFieldType,
      style: DEFAULT_STYLE,
      isEditing: false,
    };

    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return { ...section, fields: [...section.fields, newField] };
      }
      return section;
    }));

    setNewFieldLabel('');
    setShowAddFieldModal(false);
  };

  // Delete field
  const deleteField = (sectionId: string, fieldId: string) => {
    Alert.alert(
      'Delete Field',
      'Are you sure you want to delete this field?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            saveToUndo();
            setSections(prev => prev.map(section => {
              if (section.id === sectionId) {
                return {
                  ...section,
                  fields: section.fields.filter(f => f.id !== fieldId)
                };
              }
              return section;
            }));
          }
        }
      ]
    );
  };

  // Add new section
  const addSection = () => {
    saveToUndo();
    const newSection: DocumentSection = {
      id: `section_${Date.now()}`,
      title: 'New Section',
      fields: [],
      collapsed: false,
    };
    setSections(prev => [...prev, newSection]);
  };

  // Delete section
  const deleteSection = (sectionId: string) => {
    Alert.alert(
      'Delete Section',
      'Are you sure you want to delete this section and all its fields?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            saveToUndo();
            setSections(prev => prev.filter(s => s.id !== sectionId));
          }
        }
      ]
    );
  };

  // Toggle section collapse
  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return { ...section, collapsed: !section.collapsed };
      }
      return section;
    }));
  };

  // Move field up/down
  const moveField = (sectionId: string, fieldId: string, direction: 'up' | 'down') => {
    saveToUndo();
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        const fieldIndex = section.fields.findIndex(f => f.id === fieldId);
        if (fieldIndex === -1) return section;
        
        const newIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
        if (newIndex < 0 || newIndex >= section.fields.length) return section;
        
        const newFields = [...section.fields];
        [newFields[fieldIndex], newFields[newIndex]] = [newFields[newIndex], newFields[fieldIndex]];
        
        return { ...section, fields: newFields };
      }
      return section;
    }));
  };

  // Handle save
  const handleSave = () => {
    const editedData = {
      title: documentTitle,
      sections: sections.map(section => ({
        title: section.title,
        fields: section.fields.map(field => ({
          label: field.label,
          value: field.value,
          style: field.style,
        }))
      })),
      originalAnalysis: analysisResult,
    };
    onSave(editedData);
  };

  // Export as text
  const exportAsText = () => {
    let text = `${documentTitle}\n${'='.repeat(documentTitle.length)}\n\n`;
    
    sections.forEach(section => {
      text += `${section.title}\n${'-'.repeat(section.title.length)}\n`;
      section.fields.forEach(field => {
        if (field.type === 'divider') {
          text += '\n---\n\n';
        } else if (field.type === 'header') {
          text += `\n${field.value}\n\n`;
        } else {
          text += `${field.label}: ${field.value}\n`;
        }
      });
      text += '\n';
    });
    
    Alert.alert('Export', 'Document exported as text', [{ text: 'OK' }]);
    console.log(text);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <TextInput
            style={styles.documentTitleInput}
            value={documentTitle}
            onChangeText={(text) => {
              setDocumentTitle(text);
              setHasUnsavedChanges(true);
            }}
            placeholder="Document Title"
            placeholderTextColor="#6B7280"
          />
          {hasUnsavedChanges && (
            <View style={styles.unsavedIndicator}>
              <Text style={styles.unsavedText}>Edited</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={handleSave}>
          <Ionicons name="checkmark" size={24} color="#00D9FF" />
        </TouchableOpacity>
      </View>

      {/* Formatting Toolbar */}
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>
          {/* Undo/Redo */}
          <TouchableOpacity 
            style={[styles.toolButton, undoStack.length === 0 && styles.toolButtonDisabled]} 
            onPress={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Ionicons name="arrow-undo" size={20} color={undoStack.length > 0 ? "#FFFFFF" : "#4B5563"} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toolButton, redoStack.length === 0 && styles.toolButtonDisabled]} 
            onPress={handleRedo}
            disabled={redoStack.length === 0}
          >
            <Ionicons name="arrow-redo" size={20} color={redoStack.length > 0 ? "#FFFFFF" : "#4B5563"} />
          </TouchableOpacity>

          <View style={styles.toolDivider} />

          {/* Text Formatting */}
          <TouchableOpacity 
            style={[styles.toolButton, currentStyle.bold && styles.toolButtonActive]} 
            onPress={() => toggleStyle('bold')}
          >
            <Text style={[styles.toolButtonText, { fontWeight: 'bold' }]}>B</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toolButton, currentStyle.italic && styles.toolButtonActive]} 
            onPress={() => toggleStyle('italic')}
          >
            <Text style={[styles.toolButtonText, { fontStyle: 'italic' }]}>I</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toolButton, currentStyle.underline && styles.toolButtonActive]} 
            onPress={() => toggleStyle('underline')}
          >
            <Text style={[styles.toolButtonText, { textDecorationLine: 'underline' }]}>U</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toolButton, currentStyle.strikethrough && styles.toolButtonActive]} 
            onPress={() => toggleStyle('strikethrough')}
          >
            <Text style={[styles.toolButtonText, { textDecorationLine: 'line-through' }]}>S</Text>
          </TouchableOpacity>

          <View style={styles.toolDivider} />

          {/* Font Size */}
          <TouchableOpacity 
            style={styles.toolButtonWide} 
            onPress={() => setShowFontSizePicker(true)}
          >
            <Text style={styles.toolButtonText}>{currentStyle.fontSize}</Text>
            <Ionicons name="chevron-down" size={14} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Color */}
          <TouchableOpacity 
            style={styles.toolButton} 
            onPress={() => setShowColorPicker(true)}
          >
            <View style={[styles.colorIndicator, { backgroundColor: currentStyle.color }]} />
          </TouchableOpacity>

          <View style={styles.toolDivider} />

          {/* Alignment */}
          <TouchableOpacity 
            style={[styles.toolButton, currentStyle.alignment === 'left' && styles.toolButtonActive]} 
            onPress={() => setAlignment('left')}
          >
            <Ionicons name="menu" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toolButton, currentStyle.alignment === 'center' && styles.toolButtonActive]} 
            onPress={() => setAlignment('center')}
          >
            <Ionicons name="reorder-three" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toolButton, currentStyle.alignment === 'right' && styles.toolButtonActive]} 
            onPress={() => setAlignment('right')}
          >
            <Ionicons name="menu" size={20} color="#FFFFFF" style={{ transform: [{ scaleX: -1 }] }} />
          </TouchableOpacity>

          <View style={styles.toolDivider} />

          {/* Add Section */}
          <TouchableOpacity style={styles.toolButton} onPress={addSection}>
            <Ionicons name="add-circle-outline" size={20} color="#00D9FF" />
          </TouchableOpacity>

          {/* Preview */}
          <TouchableOpacity style={styles.toolButton} onPress={() => setShowPreview(true)}>
            <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Export */}
          <TouchableOpacity style={styles.toolButton} onPress={exportAsText}>
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Editor Content */}
      <ScrollView 
        style={styles.editorContent}
        contentContainerStyle={styles.editorContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Document Type Badge */}
        <View style={styles.documentTypeBadge}>
          <Ionicons 
            name={getDocumentIcon(analysisResult.documentType)} 
            size={16} 
            color="#00D9FF" 
          />
          <Text style={styles.documentTypeText}>
            {analysisResult.documentType.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {/* Sections */}
        {sections.map((section, sectionIndex) => (
          <View key={section.id} style={styles.section}>
            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <TouchableOpacity 
                style={styles.sectionToggle}
                onPress={() => toggleSection(section.id)}
              >
                <Ionicons 
                  name={section.collapsed ? 'chevron-forward' : 'chevron-down'} 
                  size={20} 
                  color="#6B7280" 
                />
              </TouchableOpacity>
              <TextInput
                style={styles.sectionTitle}
                value={section.title}
                onChangeText={(text) => {
                  setSections(prev => prev.map(s => 
                    s.id === section.id ? { ...s, title: text } : s
                  ));
                }}
                placeholder="Section Title"
                placeholderTextColor="#6B7280"
              />
              <TouchableOpacity 
                style={styles.sectionAction}
                onPress={() => {
                  setShowAddFieldModal(true);
                }}
              >
                <Ionicons name="add" size={20} color="#00D9FF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sectionAction}
                onPress={() => deleteSection(section.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>

            {/* Section Fields */}
            {!section.collapsed && (
              <View style={styles.sectionContent}>
                {section.fields.map((field, fieldIndex) => (
                  <View key={field.id} style={styles.fieldContainer}>
                    {field.type === 'divider' ? (
                      <View style={styles.dividerField}>
                        <View style={styles.dividerLine} />
                      </View>
                    ) : field.type === 'header' ? (
                      <TextInput
                        style={[
                          styles.headerField,
                          {
                            fontWeight: field.style.bold ? 'bold' : 'normal',
                            fontStyle: field.style.italic ? 'italic' : 'normal',
                            textDecorationLine: field.style.underline ? 'underline' : 
                              field.style.strikethrough ? 'line-through' : 'none',
                            fontSize: field.style.fontSize + 4,
                            color: field.style.color,
                            textAlign: field.style.alignment,
                          }
                        ]}
                        value={field.value}
                        onChangeText={(text) => updateFieldValue(section.id, field.id, text)}
                        onFocus={() => {
                          setActiveFieldId(field.id);
                          setCurrentStyle(field.style);
                        }}
                        placeholder="Header text..."
                        placeholderTextColor="#4B5563"
                      />
                    ) : (
                      <View style={styles.field}>
                        <View style={styles.fieldHeader}>
                          <Text style={styles.fieldLabel}>{field.label}</Text>
                          <View style={styles.fieldActions}>
                            <TouchableOpacity 
                              style={styles.fieldAction}
                              onPress={() => moveField(section.id, field.id, 'up')}
                              disabled={fieldIndex === 0}
                            >
                              <Ionicons 
                                name="chevron-up" 
                                size={16} 
                                color={fieldIndex === 0 ? '#4B5563' : '#6B7280'} 
                              />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.fieldAction}
                              onPress={() => moveField(section.id, field.id, 'down')}
                              disabled={fieldIndex === section.fields.length - 1}
                            >
                              <Ionicons 
                                name="chevron-down" 
                                size={16} 
                                color={fieldIndex === section.fields.length - 1 ? '#4B5563' : '#6B7280'} 
                              />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.fieldAction}
                              onPress={() => deleteField(section.id, field.id)}
                            >
                              <Ionicons name="close" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <TextInput
                          style={[
                            styles.fieldInput,
                            field.type === 'multiline' && styles.fieldInputMultiline,
                            {
                              fontWeight: field.style.bold ? 'bold' : 'normal',
                              fontStyle: field.style.italic ? 'italic' : 'normal',
                              textDecorationLine: field.style.underline ? 'underline' : 
                                field.style.strikethrough ? 'line-through' : 'none',
                              fontSize: field.style.fontSize,
                              color: field.style.color,
                              textAlign: field.style.alignment,
                            },
                            activeFieldId === field.id && styles.fieldInputActive,
                          ]}
                          value={field.value}
                          onChangeText={(text) => updateFieldValue(section.id, field.id, text)}
                          onFocus={() => {
                            setActiveFieldId(field.id);
                            setCurrentStyle(field.style);
                          }}
                          multiline={field.type === 'multiline'}
                          numberOfLines={field.type === 'multiline' ? 4 : 1}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          placeholderTextColor="#4B5563"
                          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                        />
                      </View>
                    )}
                  </View>
                ))}

                {section.fields.length === 0 && (
                  <TouchableOpacity 
                    style={styles.emptySection}
                    onPress={() => setShowAddFieldModal(true)}
                  >
                    <Ionicons name="add-circle-outline" size={32} color="#4B5563" />
                    <Text style={styles.emptySectionText}>Add a field</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}

        {/* Add Section Button */}
        <TouchableOpacity style={styles.addSectionButton} onPress={addSection}>
          <Ionicons name="add" size={20} color="#00D9FF" />
          <Text style={styles.addSectionText}>Add Section</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Font Size Picker Modal */}
      <Modal
        visible={showFontSizePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFontSizePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFontSizePicker(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Font Size</Text>
            <View style={styles.pickerGrid}>
              {FONT_SIZES.map(size => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.pickerItem,
                    currentStyle.fontSize === size && styles.pickerItemActive
                  ]}
                  onPress={() => setFontSize(size)}
                >
                  <Text style={[
                    styles.pickerItemText,
                    currentStyle.fontSize === size && styles.pickerItemTextActive
                  ]}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowColorPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowColorPicker(false)}
        >
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>Text Color</Text>
            <View style={styles.colorGrid}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorItem,
                    { backgroundColor: color },
                    currentStyle.color === color && styles.colorItemActive
                  ]}
                  onPress={() => setColor(color)}
                >
                  {currentStyle.color === color && (
                    <Ionicons name="checkmark" size={20} color={color === '#FFFFFF' ? '#000' : '#FFF'} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Field Modal */}
      <Modal
        visible={showAddFieldModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddFieldModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addFieldModal}>
            <View style={styles.addFieldHeader}>
              <Text style={styles.addFieldTitle}>Add New Field</Text>
              <TouchableOpacity onPress={() => setShowAddFieldModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Field Label</Text>
            <TextInput
              style={styles.modalInput}
              value={newFieldLabel}
              onChangeText={setNewFieldLabel}
              placeholder="e.g., Phone Number, Address..."
              placeholderTextColor="#6B7280"
              autoFocus
            />

            <Text style={styles.inputLabel}>Field Type</Text>
            <View style={styles.fieldTypeGrid}>
              {(['text', 'multiline', 'number', 'date', 'header', 'divider'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.fieldTypeItem,
                    newFieldType === type && styles.fieldTypeItemActive
                  ]}
                  onPress={() => setNewFieldType(type)}
                >
                  <Ionicons 
                    name={
                      type === 'text' ? 'text' :
                      type === 'multiline' ? 'document-text' :
                      type === 'number' ? 'calculator' :
                      type === 'date' ? 'calendar' :
                      type === 'header' ? 'text' :
                      'remove'
                    } 
                    size={20} 
                    color={newFieldType === type ? '#00D9FF' : '#6B7280'} 
                  />
                  <Text style={[
                    styles.fieldTypeText,
                    newFieldType === type && styles.fieldTypeTextActive
                  ]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.addFieldButton, !newFieldLabel.trim() && styles.addFieldButtonDisabled]}
              onPress={() => sections[0] && addField(sections[0].id)}
              disabled={!newFieldLabel.trim()}
            >
              <Ionicons name="add" size={20} color="#0D1117" />
              <Text style={styles.addFieldButtonText}>Add Field</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPreview(false)}
      >
        <SafeAreaView style={styles.previewContainer} edges={['top', 'bottom']}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setShowPreview(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Document Preview</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={styles.previewContent} contentContainerStyle={styles.previewContentContainer}>
            <Text style={styles.previewDocTitle}>{documentTitle}</Text>
            {sections.map(section => (
              <View key={section.id} style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>{section.title}</Text>
                {section.fields.map(field => (
                  <View key={field.id} style={styles.previewField}>
                    {field.type === 'divider' ? (
                      <View style={styles.previewDivider} />
                    ) : field.type === 'header' ? (
                      <Text style={[styles.previewHeaderText, {
                        fontWeight: field.style.bold ? 'bold' : 'normal',
                        fontStyle: field.style.italic ? 'italic' : 'normal',
                        textAlign: field.style.alignment,
                        color: field.style.color,
                        fontSize: field.style.fontSize + 4,
                      }]}>{field.value}</Text>
                    ) : (
                      <>
                        <Text style={styles.previewFieldLabel}>{field.label}</Text>
                        <Text style={[styles.previewFieldValue, {
                          fontWeight: field.style.bold ? 'bold' : 'normal',
                          fontStyle: field.style.italic ? 'italic' : 'normal',
                          textDecorationLine: field.style.underline ? 'underline' : 
                            field.style.strikethrough ? 'line-through' : 'none',
                          textAlign: field.style.alignment,
                          color: field.style.color,
                          fontSize: field.style.fontSize,
                        }]}>{field.value || '—'}</Text>
                      </>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Helper function to convert analysis result to editable sections
function convertToSections(result: AnalysisResult): DocumentSection[] {
  const data = result.data;
  const sections: DocumentSection[] = [];

  // Create main section based on document type
  const mainSection: DocumentSection = {
    id: 'main',
    title: getDocumentTitle(result.documentType),
    fields: [],
    collapsed: false,
  };

  // Convert data object to fields
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'type' || key === 'rawText' || key === 'tags') return;
      if (value === null || value === undefined) return;

      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase())
        .trim();

      if (typeof value === 'object' && !Array.isArray(value)) {
        // Create sub-section for nested objects
        const subSection: DocumentSection = {
          id: `section_${key}`,
          title: label,
          fields: [],
          collapsed: false,
        };

        Object.entries(value as Record<string, any>).forEach(([subKey, subValue]) => {
          if (subValue !== null && subValue !== undefined) {
            const subLabel = subKey
              .replace(/([A-Z])/g, ' $1')
              .replace(/_/g, ' ')
              .replace(/^./, str => str.toUpperCase())
              .trim();

            subSection.fields.push({
              id: `field_${key}_${subKey}`,
              label: subLabel,
              value: String(subValue),
              type: 'text',
              style: DEFAULT_STYLE,
              isEditing: false,
            });
          }
        });

        if (subSection.fields.length > 0) {
          sections.push(subSection);
        }
      } else if (Array.isArray(value)) {
        // Handle arrays
        if (value.length > 0) {
          const arraySection: DocumentSection = {
            id: `section_${key}`,
            title: label,
            fields: value.map((item, index) => {
              if (typeof item === 'object') {
                return {
                  id: `field_${key}_${index}`,
                  label: `Item ${index + 1}`,
                  value: Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(', '),
                  type: 'text' as const,
                  style: DEFAULT_STYLE,
                  isEditing: false,
                };
              }
              return {
                id: `field_${key}_${index}`,
                label: `${label} ${index + 1}`,
                value: String(item),
                type: 'text' as const,
                style: DEFAULT_STYLE,
                isEditing: false,
              };
            }),
            collapsed: false,
          };
          sections.push(arraySection);
        }
      } else {
        // Simple field
        const isLongText = String(value).length > 100;
        mainSection.fields.push({
          id: `field_${key}`,
          label,
          value: String(value),
          type: isLongText ? 'multiline' : 'text',
          style: DEFAULT_STYLE,
          isEditing: false,
        });
      }
    });
  }

  // Add main section first if it has fields
  if (mainSection.fields.length > 0) {
    sections.unshift(mainSection);
  }

  // If no sections created, create a default one with raw text
  if (sections.length === 0) {
    sections.push({
      id: 'content',
      title: 'Document Content',
      fields: [{
        id: 'field_content',
        label: 'Content',
        value: result.rawText || '',
        type: 'multiline',
        style: DEFAULT_STYLE,
        isEditing: false,
      }],
      collapsed: false,
    });
  }

  return sections;
}

// Get document title based on type
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

// Get document icon
function getDocumentIcon(type: DocumentType): string {
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
    unknown: 'document',
  };
  return icons[type] || 'document';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentTitleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    padding: 8,
  },
  unsavedIndicator: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unsavedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
    textTransform: 'uppercase',
  },
  toolbar: {
    backgroundColor: '#161B22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#21262D',
  },
  toolButtonWide: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#21262D',
    gap: 4,
  },
  toolButtonActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00D9FF',
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
  toolButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  toolDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#30363D',
    marginHorizontal: 8,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editorContent: {
    flex: 1,
  },
  editorContentContainer: {
    padding: 16,
  },
  documentTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 16,
  },
  documentTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D9FF',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: '#161B22',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#30363D',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#21262D',
    gap: 8,
  },
  sectionToggle: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionAction: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContent: {
    padding: 12,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  field: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldActions: {
    flexDirection: 'row',
    gap: 4,
  },
  fieldAction: {
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldInput: {
    fontSize: 14,
    color: '#E6EDF3',
    padding: 0,
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldInputActive: {
    borderColor: '#00D9FF',
  },
  dividerField: {
    paddingVertical: 8,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#30363D',
  },
  headerField: {
    fontSize: 18,
    color: '#FFFFFF',
    padding: 8,
    backgroundColor: '#0D1117',
    borderRadius: 8,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptySectionText: {
    fontSize: 14,
    color: '#4B5563',
  },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    backgroundColor: '#161B22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    borderStyle: 'dashed',
  },
  addSectionText: {
    fontSize: 14,
    color: '#00D9FF',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModal: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 20,
    width: width - 64,
    maxWidth: 320,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  pickerItem: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#21262D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#00D9FF',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  pickerItemTextActive: {
    color: '#00D9FF',
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  colorItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorItemActive: {
    borderColor: '#FFFFFF',
  },
  addFieldModal: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 20,
    width: width - 48,
    maxWidth: 400,
  },
  addFieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addFieldTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 20,
  },
  fieldTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  fieldTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#21262D',
    gap: 6,
  },
  fieldTypeItemActive: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00D9FF',
  },
  fieldTypeText: {
    fontSize: 13,
    color: '#6B7280',
  },
  fieldTypeTextActive: {
    color: '#00D9FF',
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9FF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addFieldButtonDisabled: {
    opacity: 0.5,
  },
  addFieldButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D1117',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0D1117',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  previewContent: {
    flex: 1,
  },
  previewContentContainer: {
    padding: 32,
  },
  previewDocTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  previewSection: {
    marginBottom: 24,
  },
  previewSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  previewField: {
    marginBottom: 12,
  },
  previewFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  previewFieldValue: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 22,
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  previewHeaderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginVertical: 8,
  },
});
