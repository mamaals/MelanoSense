import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { ScanLine, CircleUserRound, BookOpen, History } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    <SafeAreaView style={styles.wrapper} edges={['bottom', 'left', 'right']}>
      <View style={styles.navbar}>
        {navItems.map((item) => {
          const isActive = pathname === item.route;
          const Icon = item.Icon;

          return (
            <Pressable
              key={item.route}
              style={styles.navItem}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                // Reuse a route below detail/edit screens; replace if it is absent.
                if (!isActive) router.dismissTo(item.route);
              }}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },

  navbar: {
    minHeight: 72,
    paddingVertical: 10,
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
    elevation: 4,
  },

  navItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  label: {
    maxWidth: '100%',
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: '#B8B8B8',
    textAlign: 'center',
  },

  activeLabel: {
    color: '#007787',
    fontFamily: 'Poppins-Medium',
  },
});
