import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { ScanLine, CircleUserRound, BookOpen, History } from 'lucide-react-native';

const navItems = [
  {
    label: 'Scan',
    route: '/home',
    Icon: ScanLine,
  },
  {
    label: 'Profile',
    route: '/profile',
    Icon: CircleUserRound,
  },
  {
    label: 'Panduan',
    route: '/guide',
    Icon: BookOpen,
  },
  {
    label: 'Histori',
    route: '/history',
    Icon: History,
  },
 ] as const;

export default function BottomNavbar() {
  const pathname = usePathname();

  return (
    <View style={styles.wrapper}>
      <View style={styles.navbar}>
        {navItems.map((item) => {
          const isActive = pathname === item.route;
          const Icon = item.Icon;

          return (
            <Pressable
              key={item.route}
              style={styles.navItem}
              onPress={() => router.push(item.route)}
            >
              <Icon
                size={24}
                color={isActive ? '#007787' : '#B8B8B8'}
                strokeWidth={2.2}
              />

              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },

  navbar: {
    height: 82,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',


    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },

  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  label: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: '#B8B8B8',
  },

  activeLabel: {
    color: '#007787',
    fontFamily: 'Poppins-Medium',
  },
});