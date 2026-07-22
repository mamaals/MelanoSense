import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type ProcessLoaderProps = {
  message: string;
};

export default function ProcessLoader({ message }: ProcessLoaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>

      <ActivityIndicator
        size="large"
        color="#007787"
        style={styles.indicator}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  message: {
    maxWidth: 250,
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Poppins-Regular',
    color: '#A5A5A5',
    textAlign: 'center',
  },

  indicator: {
    marginTop: 18,
  },
});