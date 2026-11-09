import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type FormScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  includeBottomInset?: boolean;
}>;

export default function FormScreen({
  children,
  contentContainerStyle,
  includeBottomInset = true,
}: FormScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      style={styles.screen}
      edges={includeBottomInset ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
});
