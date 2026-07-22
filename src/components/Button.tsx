import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

type ButtonVariant = 'cyan' | 'darkgreen' | 'white' | 'orange';
type ButtonShape = 'pill' | 'rounded' | 'square';

type ButtonProps = {
  title: string;
  variant?: ButtonVariant;
  outline?: boolean;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  shape?: ButtonShape;
  disabled?: boolean;
};

const buttonColors: Record<ButtonVariant, string> = {
  cyan: '#92DAD7',
  darkgreen: '#007787',
  white: '#F1FAF5',
  orange: '#ff5e00',
};

const borderRadiusMap: Record<ButtonShape, number> = {
  pill: 26,
  rounded: 10,
  square: 0,
};

const Button = ({
  title,
  variant = 'cyan',
  outline = false,
  shape = 'pill',
  onPress,
  style,
  disabled = false,
}: ButtonProps) => {
  const backgroundColor = buttonColors[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor,
          borderRadius: borderRadiusMap[shape],
          borderWidth: outline ? 1.5 : 0,
          borderColor: outline ? '#000000' : 'transparent',
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
};

export default Button;

const styles = StyleSheet.create({
  button: {
    height: 45,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    fontFamily: 'Manrope-Bold',
    color: '#05051F',
  },
});
