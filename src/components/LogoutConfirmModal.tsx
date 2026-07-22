import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type LogoutConfirmModalProps = {
  visible: boolean;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function LogoutConfirmModal({
  visible,
  isLoading = false,
  onCancel,
  onConfirm,
}: LogoutConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />

        <View style={styles.modalCard}>
          <Text style={styles.title}>Log Out</Text>

          <Text style={styles.description}>
            Anda yakin ingin keluar dari akun ini?
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.logoutButton]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.logoutText}>Log Out</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  modalCard: {
    width: '84%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },

  title: {
    fontSize: 22,
    fontFamily: 'Poppins-SemiBold',
    color: '#202020',
    marginBottom: 10,
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Poppins-Regular',
    color: '#606060',
    marginBottom: 28,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },

  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cancelButton: {
    backgroundColor: '#F1F1F1',
  },

  logoutButton: {
    backgroundColor: '#D94A38',
  },

  cancelText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#303030',
  },

  logoutText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
  },
});