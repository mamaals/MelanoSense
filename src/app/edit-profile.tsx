import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getCurrentUserProfile, 
  updateCurrentUserProfile, 
} from '../services/profileServices';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserRound } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import Button from '../components/Button';
import FormScreen from '../components/FormScreen';
import BirthDateField from '../components/BirthDateField';
import { isAllowedBirthDate } from '../utils/birthDate';
import {
  isValidPhone,
  normalizePhone,
} from '../utils/profileValidation';
import { getSafeErrorMessage } from '../utils/userFacingErrors';

type GenderValue = 'male' | 'female' | '';

export default function EditProfilePage() {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<GenderValue>('');

  const [loadState, setLoadState] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const loadRequestRef = useRef(0);
  const mountedRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (loadInFlightRef.current) {
      return loadInFlightRef.current;
    }

    const requestId = ++loadRequestRef.current;
    const request = (async () => {
      try {
        const { profile, error } = await getCurrentUserProfile();

        if (!mountedRef.current || requestId !== loadRequestRef.current) {
          return;
        }

        if (error || !profile) {
          setLoadState('ERROR');
          return;
        }

        setName(profile.full_name ?? '');
        setBirthDate(profile.birth_date ?? '');
        setPhone(profile.phone ?? '');

        if (profile.gender === 'male' || profile.gender === 'female') {
          setGender(profile.gender);
        } else {
          setGender('');
        }

        setLoadState('SUCCESS');
      } catch {
        if (mountedRef.current && requestId === loadRequestRef.current) {
          setLoadState('ERROR');
        }
      }
    })();

    loadInFlightRef.current = request;

    try {
      await request;
    } finally {
      if (loadInFlightRef.current === request) {
        loadInFlightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const loadTimer = setTimeout(() => {
      void fetchProfile();
    }, 0);

    return () => {
      mountedRef.current = false;
      clearTimeout(loadTimer);
    };
  }, [fetchProfile]);

  const retryProfile = useCallback(() => {
    setLoadState('LOADING');
    void fetchProfile();
  }, [fetchProfile]);

  async function handleSave() {
    if (savingRef.current) {
      return;
    }

    if (!name.trim()) {
      Alert.alert('Data belum lengkap', 'Nama wajib diisi.');
      return;
    }

    if (!gender) {
      Alert.alert('Data belum lengkap', 'Pilih jenis kelamin.');
      return;
    }

    if (!isAllowedBirthDate(birthDate)) {
      Alert.alert(
        'Tanggal lahir tidak valid',
        'Pilih tanggal lahir yang benar dan tidak di masa depan.'
      );
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert(
        'Nomor telepon tidak valid',
        'Nomor telepon wajib diisi dengan angka yang valid.',
      );
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    let error: unknown = null;

    try {
      ({ error } = await updateCurrentUserProfile({
        full_name: name.trim(),
        gender,
        birth_date: birthDate.trim(),
        phone: normalizePhone(phone),
      }));
    } catch (saveError) {
      error = saveError;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }

    if (error) {
      Alert.alert(
        'Gagal menyimpan profil',
        getSafeErrorMessage(
          error,
          'Profil belum dapat disimpan. Silakan coba lagi.',
        ),
      );
      return;
    }

    Alert.alert('Berhasil', 'Profil berhasil diperbarui.', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  }

  if (loadState === 'LOADING') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007787" />
          <Text style={styles.loadingText}>Memuat profil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === 'ERROR') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Profil belum dapat dimuat</Text>
          <Text style={styles.errorText}>
            Periksa koneksi internet Anda, lalu coba lagi.
          </Text>
          <Button title="Coba Lagi" variant="cyan" onPress={retryProfile} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <FormScreen includeBottomInset={false} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <UserRound size={24} color="#FFFFFF" strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>Edit Profil</Text>
        </View>

        <View style={styles.card}>
          <Input
            label="Nama"
            value={name}
            onChangeText={setName}
            placeholder="Masukkan nama lengkap"
          />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Jenis Kelamin</Text>

            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={gender}
                onValueChange={(value) =>
                  setGender(value as GenderValue)
                }
                style={styles.picker}
                dropdownIconColor="#2A2A2A"
              >
                <Picker.Item
                  label="Pilih jenis kelamin"
                  value=""
                  color="#A8A8A8"
                />

                <Picker.Item
                  label="Laki-laki"
                  value="male"
                  color="#2A2A2A"
                />

                <Picker.Item
                  label="Perempuan"
                  value="female"
                  color="#2A2A2A"
                />
              </Picker>
            </View>
          </View>

          <BirthDateField
            value={birthDate}
            onChange={setBirthDate}
            disabled={isSaving}
          />

          <Input
            label="Nomor Telepon"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Masukkan nomor telepon"
            autoCapitalize="none"
          />
        </View>

        <Button
          title={isSaving ? 'Menyimpan...' : 'Simpan Profil'}
          variant="orange"
          shape="rounded"
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        />

        <Button
          title="Batal"
          variant="white"
          shape="rounded"
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isSaving}
        />
    </FormScreen>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: | 'default' | 'number-pad' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: InputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#A8A8A8"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  loadingText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#777777',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
  },

  errorTitle: {
    color: '#2A2A2A',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 17,
    textAlign: 'center',
  },

  errorText: {
    marginTop: 10,
    marginBottom: 20,
    color: '#667085',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#007787',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  title: {
    flex: 1,
    fontSize: 28,
    fontFamily: 'Poppins-SemiBold',
    color: '#2A2A2A',
  },

  card: {
    backgroundColor: '#F1FAF5',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },

  inputGroup: {
    marginBottom: 14,
  },

  label: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#2A2A2A',
    marginBottom: 6,
  },

  input: {
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#2A2A2A',
  },

  pickerContainer: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  picker: {
    width: '100%',
    color: '#2A2A2A',
    fontFamily: 'Poppins-Regular',
  },

  saveButton: {
    marginTop: 22,
  },

  cancelButton: {
    marginTop: 10,
  },
});
