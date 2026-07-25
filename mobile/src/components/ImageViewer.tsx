import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  uri?: string | null;
  visible: boolean;
  onClose: () => void;
}

const TOP_OFFSET = (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 50) + 8;

// Full-screen image lightbox. Tap anywhere or the close button to dismiss.
export default function ImageViewer({ uri, visible, onClose }: Props) {
  const [loading, setLoading] = React.useState(true);

  return (
    <Modal visible={visible && !!uri} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.fill} activeOpacity={1} onPress={onClose}>
          {loading ? <ActivityIndicator size="large" color="#fff" style={styles.loader} /> : null}
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.closeBtn, { top: TOP_OFFSET }]} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  loader: { position: 'absolute' },
  closeBtn: { position: 'absolute', right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
});
