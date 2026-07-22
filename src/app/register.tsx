import React, { useState } from "react";
import {
    View, Text, StyleSheet, Image,
    TextInput, Pressable, Touchable,
    TouchableOpacity
} from 'react-native';
import Button from '@/components/Button';
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from '@expo/vector-icons';


function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

const RegisterPage = () => {
    const { signUpWithPassword, signInWithOAuth } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    async function handleRegister() {
      const normalizedEmail = email.trim().toLowerCase();

      setMessage('');
      setErrorMessage('');

      if (!isValidEmail(normalizedEmail)) {
        setErrorMessage('Masukkan alamat email yang valid.');
        return;
      }

      if (password.length < 6) {
        setErrorMessage('Password minimal 6 karakter.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Konfirmasi password tidak sama.');
        return;
      }

      try {
        setLoading(true);
        setMessage('Mendaftarkan akun...');
        const result = await signUpWithPassword({
          email: normalizedEmail,
          password,
          metadata: {
            email: normalizedEmail,
          },
        });

        if (result.needsEmailConfirmation) {
          setMessage('Registrasi berhasil. Periksa email untuk konfirmasi akun.');
          router.replace('/login');
          return;
        }

        setMessage('Registrasi berhasil.');
        router.replace('/home');
      } catch (error) {
        setMessage('');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Registrasi gagal. Silakan coba lagi.'
        );
      } finally {
        setLoading(false);
      }
    }

    async function handleOAuthLogin(provider: 'google' | 'apple') {
      setMessage('');
      setErrorMessage('');

      try {
        setLoading(true);
        setMessage(
          provider === 'google'
            ? 'Membuka login Google...'
            : 'Membuka login Apple...'
        );
        await signInWithOAuth(provider);
        setMessage('Login berhasil.');
        router.replace('/home');
      } catch (error) {
        setMessage('');
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Login sosial gagal. Silakan coba lagi.'
        );
      } finally {
        setLoading(false);
      }
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Register</Text>
                    <Image source={require('../../assets/images/Plester.png')} style={{width:20, height:20}} />
                </View>
    

          <View style={styles.form}>
            <Text style={styles.label}>
              Email <Text style={styles.required}>*</Text>
            </Text>
          

          <TextInput style={styles.input} 
          placeholder="Masukkan Email" 
          placeholderTextColor="#B8B8B8"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}/>
          
          <Text style={styles.label}>
            Password <Text style={styles.required}>*</Text>
          </Text>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Masukkan Password"
              placeholderTextColor="#B8B8B8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((previous) => !previous)}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            Konfirmasi Password <Text style={styles.required}>*</Text>
          </Text>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Masukkan Ulang Password"
              placeholderTextColor="#B8B8B8"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((previous) => !previous)}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.optionRow}>
            <Pressable style={styles.rememberRow}>
              <View style={styles.checkbox} />
              <Text style={styles.rememberText}>Ingat Saya</Text>
            </Pressable>

            <Pressable>
              <Text style={styles.forgotText}>Lupa Password?</Text>
            </Pressable>
          </View>


          <View style={styles.primaryButton}>
            <Button
              title={loading ? 'Memproses...' : 'Sign Up'}
              variant="darkgreen"
              onPress={handleRegister}
              disabled={loading}
            />
          </View>

          <View style={styles.primaryButton}>
            <Button
              title="Sign In dengan Google"
              variant="white"
              outline
              onPress={() => handleOAuthLogin('google')}
              disabled={loading}
            />
          </View>

          <View style={styles.primaryButton}>
            <Button
              title="Sign In dengan Apple"
              variant="white"
              outline
              onPress={() => handleOAuthLogin('apple')}
              disabled={loading}
            />
          </View>

          {message ? <Text style={styles.statusText}>{message}</Text> : null}
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
        </View>       

        <View style={styles.footer}>
          <Text style={styles.footerText}>Sudah memiliki akun?</Text>
          <Pressable  onPress={() => router.push('./login')}>
            <Text style={styles.footerLink}> LogIn</Text>
          </Pressable>
        </View>  
        </View>
        </SafeAreaView>
    )
};

export default RegisterPage;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 42,
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginBottom: 38,
  },

  title: {
    fontSize: 30,
    color: '#05051F',
    fontFamily: 'Poppins-SemiBold',
  },

  logo: {
    fontSize: 30,
    fontWeight: '800',
    color: '#007787',
  },

  form: {
    width: '100%',
  },

  label: {
    fontSize: 17,
    fontFamily: 'Poppins-Medium',
    color: '#101010',
    marginBottom: 6,
  },

  required: {
    color: '#E60000',
  },

  input: {
    height: 36, 
    borderWidth: 1,
    borderColor: '#CFCFCF',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
    color: '#101010',
    marginBottom: 18,
  },

  passwordContainer: {
    height: 36,
    borderWidth: 1,
    borderColor: "#CFCFCF",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  passwordInput: {
    flex: 1,
    height: "100%",
    paddingLeft: 12,
    paddingRight: 4,
    fontSize: 11,
    fontFamily: "Manrope-Regular",
    color: "#101010",
  },

  eyeButton: {
    height: "100%",
    width: 42,
    justifyContent: "center",
    alignItems: "center",
  },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 28,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    marginRight: 8,
  },

  rememberText: {
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    color: '#B2B2B2',
  },

  forgotText: {
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    color: '#05051F',
  },

  primaryButton: {
    marginBottom: 8,
  },

  statusText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    color: '#007787',
    textAlign: 'center',
  },

  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    color: '#E60000',
    textAlign: 'center',
  },

  socialButton: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9DAEAA',
    backgroundColor: '#F8FFFC',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  googleIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4285F4',
    marginRight: 8,
  },

  appleIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
    marginRight: 8,
  },

  socialButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101010',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },

  footerText: {
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    color: '#B2B2B2',
  },

  footerLink: {
    fontSize: 12,
    fontFamily: 'Manrope-Bold',
    color: '#05051F',
  },
});
