/**
 * BottomSheet — panneau modal qui slide depuis le bas de l'écran.
 *
 * - Animation spring à l'ouverture, timing à la fermeture.
 * - Backdrop semi-transparent cliquable pour fermer.
 * - KeyboardAvoidingView intégré : le contenu remonte quand le clavier apparaît.
 * - Pas de dépendance native supplémentaire (utilise le Modal RN standard).
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated, Dimensions, KeyboardAvoidingView, Modal,
  Platform, Pressable, StyleSheet, View,
} from 'react-native';
import { palette } from '@/theme';

interface Props {
  visible:   boolean;
  onDismiss: () => void;
  children:  React.ReactNode;
}

const SCREEN_H = Dimensions.get('window').height;

export function BottomSheet({ visible, onDismiss, children }: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_H, duration: 260, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,        duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.avoidingView}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          {/* Drag handle */}
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  avoidingView: {
    flex:            1,
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor:      palette.white,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingBottom:        Platform.OS === 'ios' ? 40 : 24,
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -4 },
    shadowOpacity:        0.12,
    shadowRadius:         16,
    elevation:            24,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: palette.gray200,
    alignSelf:       'center',
    marginTop:       12,
    marginBottom:    20,
  },
});
