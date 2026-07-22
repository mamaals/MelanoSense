import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

type AnalysisCardProps = {
  title: string;
  status: string;
  description: string;
  image?: ImageSourcePropType;
};

export default function AnalysisCard({
  title,
  status,
  description,
  image,
}: AnalysisCardProps) {
  return (
    <View style={styles.container}>
      {image ? (
        <Image
          source={image}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderText}>Image</Text>
        </View>
      )}

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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
    marginBottom: 28,
  },

  image: {
    width: 105,
    height: 105,
    borderRadius: 4,
    backgroundColor: '#F1F1F1',
  },

  imagePlaceholder: {
    width: 105,
    height: 105,
    borderRadius: 4,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderText: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#999999',
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