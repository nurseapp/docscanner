import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PinModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
  mode: 'set' | 'verify' | 'change';
  title?: string;
  subtitle?: string;
  error?: string;
}

const PIN_LENGTH = 4;

export function PinModal({
  visible,
  onClose,
  onSubmit,
  mode,
  title,
  subtitle,
  error,
}: PinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [localError, setLocalError] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      setConfirmPin('');
      setStep('enter');
      setLocalError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  useEffect(() => {
    if (error) {
      setLocalError(error);
      triggerShake();
    }
  }, [error]);

  const triggerShake = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(100);
    }
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handlePinChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    setLocalError('');

    if (step === 'enter') {
      setPin(numericValue);
      
      if (numericValue.length === PIN_LENGTH) {
        if (mode === 'verify') {
          // Submit immediately for verification
          onSubmit(numericValue);
        } else if (mode === 'set' || mode === 'change') {
          // Move to confirm step
          setTimeout(() => {
            setStep('confirm');
            setConfirmPin('');
          }, 200);
        }
      }
    } else {
      setConfirmPin(numericValue);
      
      if (numericValue.length === PIN_LENGTH) {
        if (numericValue === pin) {
          onSubmit(numericValue);
        } else {
          setLocalError('PINs do not match');
          triggerShake();
          setTimeout(() => {
            setConfirmPin('');
          }, 500);
        }
      }
    }
  };

  const handleKeyPress = (key: string) => {
    const currentPin = step === 'enter' ? pin : confirmPin;
    
    if (key === 'delete') {
      handlePinChange(currentPin.slice(0, -1));
    } else if (key === 'clear') {
      handlePinChange('');
    } else {
      handlePinChange(currentPin + key);
    }
  };

  const getTitle = () => {
    if (title) return title;
    if (mode === 'verify') return 'Enter PIN';
    if (mode === 'change') return step === 'enter' ? 'Enter New PIN' : 'Confirm New PIN';
    return step === 'enter' ? 'Create PIN' : 'Confirm PIN';
  };

  const getSubtitle = () => {
    if (subtitle) return subtitle;
    if (mode === 'verify') return 'Enter your 4-digit PIN to unlock';
    if (mode === 'set') {
      return step === 'enter' 
        ? 'Create a 4-digit PIN to protect this document'
        : 'Re-enter your PIN to confirm';
    }
    return step === 'enter'
      ? 'Enter a new 4-digit PIN'
      : 'Re-enter your new PIN to confirm';
  };

  const currentPin = step === 'enter' ? pin : confirmPin;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ translateX: shakeAnim }] }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.lockIconContainer}>
              <Ionicons name="lock-closed" size={32} color="#00D9FF" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>

          {/* PIN Dots */}
          <View style={styles.pinContainer}>
            {Array.from({ length: PIN_LENGTH }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  index < currentPin.length && styles.pinDotFilled,
                  localError && styles.pinDotError,
                ]}
              >
                {index < currentPin.length && (
                  <View style={styles.pinDotInner} />
                )}
              </View>
            ))}
          </View>

          {/* Error Message */}
          {localError ? (
            <Text style={styles.errorText}>{localError}</Text>
          ) : (
            <View style={styles.errorPlaceholder} />
          )}

          {/* Hidden Input for keyboard */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={currentPin}
            onChangeText={handlePinChange}
            keyboardType="number-pad"
            maxLength={PIN_LENGTH}
            secureTextEntry
            autoFocus
          />

          {/* Number Pad */}
          <View style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <TouchableOpacity
                key={num}
                style={styles.keypadButton}
                onPress={() => handleKeyPress(String(num))}
              >
                <Text style={styles.keypadText}>{num}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.keypadButton}
              onPress={() => handleKeyPress('clear')}
            >
              <Text style={styles.keypadTextSmall}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keypadButton}
              onPress={() => handleKeyPress('0')}
            >
              <Text style={styles.keypadText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.keypadButton}
              onPress={() => handleKeyPress('delete')}
            >
              <Ionicons name="backspace-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Step Indicator for Set/Change mode */}
          {(mode === 'set' || mode === 'change') && (
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, step === 'enter' && styles.stepDotActive]} />
              <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#161B22',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#21262D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: '50%',
    marginLeft: -32,
    top: -8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  pinContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#30363D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinDotFilled: {
    borderColor: '#00D9FF',
  },
  pinDotError: {
    borderColor: '#EF4444',
  },
  pinDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00D9FF',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 16,
    height: 20,
  },
  errorPlaceholder: {
    height: 36,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
  keypadButton: {
    width: 72,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#21262D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  keypadTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#30363D',
  },
  stepDotActive: {
    backgroundColor: '#00D9FF',
  },
});
