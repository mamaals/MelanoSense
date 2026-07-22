import React from 'react';
import { Text, StyleSheet } from 'react-native';

type HeaderTextProps = {
  text: string;
  type?: 'title' | 'subtitle';
  textColor?: string;
};

const HeaderText = ({
  text,
  type = 'title',
  textColor = '#000000',
}: HeaderTextProps) => {
  return (
    <Text
      style={[
        styles.base,
        type === 'title' ? styles.title : styles.subtitle,
        { color: textColor },
      ]}
    >
      {text}
    </Text>
  );
};

export default HeaderText;

const styles = StyleSheet.create({
  base: {
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginBottom: 38,
  },
});