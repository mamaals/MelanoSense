import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import Button from './Button';
import { formatBirthDate, isAllowedBirthDate, parseCalendarDate, serializeCalendarDate } from '../utils/birthDate';

type BirthDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function BirthDateField({ value, onChange, disabled = false }: BirthDateFieldProps) {
  const [iosVisible, setIosVisible] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const activeRef = useRef(true);
  const androidOpenRef = useRef(false);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      if (androidOpenRef.current) void DateTimePickerAndroid.dismiss('date');
    };
  }, []);

  function commit(date: Date) {
    const next = serializeCalendarDate(date);
    if (activeRef.current && next && isAllowedBirthDate(next)) onChange(next);
  }

  function openPicker() {
    if (disabled || androidOpenRef.current) return;
    Keyboard.dismiss();
    const today = new Date();
    const selected = isAllowedBirthDate(value, today) ? parseCalendarDate(value) ?? today : today;
    if (Platform.OS === 'android') {
      androidOpenRef.current = true;
      DateTimePickerAndroid.open({
        value: selected,
        mode: 'date',
        display: 'default',
        maximumDate: today,
        positiveButton: { label: 'OK' },
        negativeButton: { label: 'Batal' },
        onValueChange: (_event, date) => {
          androidOpenRef.current = false;
          commit(date);
        },
        onDismiss: () => { androidOpenRef.current = false; },
        onError: () => { androidOpenRef.current = false; },
      });
    } else {
      setDraft(selected);
      setIosVisible(true);
    }
  }

  const displayValue = formatBirthDate(value);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>Tanggal Lahir</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Tanggal Lahir, ${displayValue || 'belum dipilih'}`}
        accessibilityHint="Buka kalender untuk memilih tanggal lahir"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={styles.field}
      >
        <Text style={[styles.value, !displayValue && styles.placeholder]}>
          {displayValue || 'Pilih tanggal lahir'}
        </Text>
        <CalendarDays size={22} color="#007787" />
      </Pressable>
      {Platform.OS === 'ios' && iosVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setIosVisible(false)}>
          <SafeAreaView style={styles.modal}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.label}>Tanggal Lahir</Text>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                locale="id-ID"
                themeVariant="light"
                maximumDate={new Date()}
                onValueChange={(_event, date) => setDraft(date)}
                style={styles.iosPicker}
              />
              <Button title="OK" onPress={() => { commit(draft); setIosVisible(false); }} />
              <Button title="Batal" variant="white" onPress={() => setIosVisible(false)} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { fontSize: 15, fontFamily: 'Poppins-SemiBold', color: '#2A2A2A', marginBottom: 6 },
  field: {
    minHeight: 48, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  value: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Poppins-Regular', color: '#2A2A2A' },
  placeholder: { color: '#777777' },
  modal: { flex: 1, backgroundColor: '#FFFFFF' },
  modalContent: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  iosPicker: { width: '100%' },
});
