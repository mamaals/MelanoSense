import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { 
  getCurrentUserProfile, 
  updateCurrentUserProfile, 
} from '../services/profileServices';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserRound } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import Button from '../components/Button';

type GenderValue = 'male' | 'female' | '';

export default function EditProfilePage() {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<GenderValue>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setIsLoading(true);

    const { profile, error } = await getCurrentUserProfile();

    if (error) {
      Alert.alert('Gagal mengambil profil', error.message);
      setIsLoading(false);
      return;
    }

    if (!profile) {
      Alert.alert('Profil tidak ditemukan');
      setIsLoading(false);
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

    setIsLoading(false);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Data belum lengkap', 'Nama wajib diisi.');
      return;
    }

    if (!gender) {
      Alert.alert('Data belum lengkap', 'Pilih jenis kelamin.');
      return;
    }

    if (birthDate.trim() && !isValidDateFormat(birthDate.trim())) {
      Alert.alert(
        'Format tanggal salah',
        'Gunakan format tanggal YYYY-MM-DD, contohnya 2006-02-22.'
      );
      return;
    }

    setIsSaving(true);

    const { error } = await updateCurrentUserProfile({
      full_name: name.trim(),
      gender,
      birth_date: birthDate.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    setIsSaving(false);

    if (error) {
      Alert.alert('Gagal menyimpan profil', error.message);
      return;
    }

    Alert.alert('Berhasil', 'Profil berhasil diperbarui.', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007787" />
          <Text style={styles.loadingText}>Memuat profil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
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

          <Input
            label="Tanggal Lahir"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="YYYY-MM-DD"
            keyboardType="number-pad"
            autoCapitalize="none"
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
      </ScrollView>
    </SafeAreaView>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?:
    | 'default'
    | 'number-pad'
    | 'phone-pad'
    | 'email-address';
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

function isValidDateFormat(value: string) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  return !Number.isNaN(parsedDate.getTime());
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

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 130,
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
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#2A2A2A',
  },

  pickerContainer: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  picker: {
    width: '100%',
    color: '#2A2A2A',
  },

  saveButton: {
    height: 48,
    marginTop: 22,
  },

  cancelButton: {
    height: 48,
    marginTop: 10,
  },
});