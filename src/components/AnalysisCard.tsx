import { StyleSheet, Text, View } from 'react-native';

type AnalysisCardProps = {
  title: string;
  status: string;
  description: string;
};

export default function AnalysisCard({
  title,
  status,
  description,
}: AnalysisCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        <Text style={styles.description}>
          <Text style={styles.status}>{status}. </Text>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },

  content: {
    flex: 1,
  },

  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Regular',
    color: '#101010',
    marginBottom: 10,
  },

  description: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Poppins-Regular',
    color: '#8A8A8A',
  },

  status: {
    fontFamily: 'Poppins-Bold',
    color: '#777777',
  },
});
