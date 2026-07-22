import { StyleSheet, View, Image} from 'react-native';
import { router } from 'expo-router';

import Button from '../components/Button';
import HeaderText from '../components/headerText';

const OpenScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.spacer} />

    <View style={styles.ImageContainer}>
      <Image source={require('../../assets/images/Logo.png')} style={{width:275, height: 275}}/>
    </View>
    <View style={styles.header}>
      <HeaderText text="Early Detection of Melanoma Disease" type="subtitle" />
    </View>
  
      <View style={styles.spacer} />

      <View style={styles.buttonContainer}>
        <Button title="Sign Up" variant="cyan" onPress={() => router.push('./register')} />

        <View style={styles.buttonGap} />

        <Button title="Log In" variant="darkgreen" onPress={() => router.push('./login')} />
      </View>
    </View>
  );
};

export default OpenScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 64,
    paddingBottom: 48,
    backgroundColor: '#FFFFFF',
  },
  ImageContainer: {
    alignItems: 'center',
    flex: 1,
  },
  header: {
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
  },
  buttonGap: {
    height: 10,
  },
});
