import { StyleSheet, Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';

type ProfileSegmentProps = {
  name?: string;
};

export default function header({ name = 'User' }: ProfileSegmentProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <UserRound size={22} color="#FFFFFF" strokeWidth={2.2} />
      </View>

      <View style={styles.textContent}>
        <Text style={styles.greeting}>Selamat Datang,</Text>
        <Text style={styles.name}>{name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },

  avatar: {
    flexShrink: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007787',
    justifyContent: 'center',
    alignItems: 'center',
  },

  greeting: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4A4A4A',
    marginBottom: 2,
  },

  textContent: { flex: 1, minWidth: 0 },

  name: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2A2A2A',
  },
});
