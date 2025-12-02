import { Tabs, useRouter } from 'expo-router';
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Text, Animated, PanResponder } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { HapticTab } from '@/components/haptic-tab';
import { PlusButtonTab } from '@/components/plus-button-tab';
import { MoreButtonTab } from '@/components/more-button-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ConstrainedTabBar } from '@/components/layout/constrained-tab-bar';
import { QuickAddProvider, useQuickAdd } from '@/contexts/quick-add-context';

function TabLayoutContent() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { isQuickAddVisible, setQuickAddVisible } = useQuickAdd();
  const [isMoreMenuVisible, setMoreMenuVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // start responding when there is a noticeable vertical drag
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // only allow dragging down (positive dy)
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 80; // pixels to consider it a dismiss
        if (gestureState.dy > threshold) {
          // animate sheet down and then close, without resetting dragY here
          Animated.timing(dragY, {
            toValue: 300, // larger value so it moves fully off screen
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setQuickAddVisible(false);
            // DO NOT reset dragY here
          });
        } else {
          // not enough drag: spring back to original position
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (isQuickAddVisible) {
      slideAnim.setValue(0);
      dragY.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isQuickAddVisible, slideAnim, dragY]);

  const sheetTranslateY = Animated.add(
    slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [40, 0], // same values you used before
    }),
    dragY
  );

  const handleMoreSettings = () => {
    setMoreMenuVisible(false);
    // Navigate to your existing Settings screen
    router.push('/(tabs)/settings');
  };

  const handleMoreExercise = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/exercise');
  };

  const handleMoreMeds = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/meds');
  };

  const handleMoreWater = () => {
    setMoreMenuVisible(false);
    router.push('/(tabs)/water');
  };

  const renderQuickAddCard = (label: string) => (
    <Pressable
      key={label}
      style={({ pressed }) => [
        styles.quickAddCard,
        pressed && styles.quickAddCardPressed,
      ]}
      onPress={() => setQuickAddVisible(false)}
    >
      <View style={styles.quickAddCardIconCircle}>
        <Text style={styles.quickAddCardIconText}>
          {label.charAt(0)}
        </Text>
      </View>
      <Text style={styles.quickAddCardLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: colors.tint,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBar: (props) => <ConstrainedTabBar {...props} />,
            tabBarStyle: {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              height: 54,
            },
          }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Food Diary',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t('tabs.dashboard'),
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="meds"
          options={{
            title: '',
            tabBarButton: (props) => <PlusButtonTab {...props} />,
            tabBarIcon: () => null,
          }}
        />
        <Tabs.Screen
          name="water"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        <Tabs.Screen
          name="exercise"
          options={{
            title: 'Custom',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="heart-pulse" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.more'),
            tabBarButton: (props) => <MoreButtonTab {...props} onPressCustom={() => setMoreMenuVisible(true)} />,
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
          }}
        />
        {/* Hide explore tab - keeping it for backward compatibility but not showing in tab bar */}
        <Tabs.Screen
          name="explore"
          options={{
            href: null, // Hide from tab bar
          }}
        />
        </Tabs>
        <Modal
          visible={isQuickAddVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQuickAddVisible(false)}
        >
          <Pressable
            style={styles.quickAddOverlay}
            onPress={() => setQuickAddVisible(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.quickAddSheet}>
                <Animated.View
                  style={[
                    styles.quickAddSheetInner,
                    {
                      transform: [{ translateY: sheetTranslateY }],
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  {/* drag handle */}
                  <Pressable
                    style={styles.quickAddHandle}
                    onPress={() => setQuickAddVisible(false)}
                  />

                  {/* cards grid */}
                  <View style={styles.quickAddGrid}>
                    {renderQuickAddCard('Log Food')}
                    {renderQuickAddCard('Custom')}
                    {renderQuickAddCard('Enter Weight')}
                    {renderQuickAddCard('Scan Barcode')}
                    {renderQuickAddCard('Water')}
                    {renderQuickAddCard('Exercise')}
                  </View>
                </Animated.View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        <Modal
          visible={isMoreMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMoreMenuVisible(false)}
        >
          <Pressable
            style={styles.moreMenuOverlay}
            onPress={() => setMoreMenuVisible(false)}
          >
            <View style={styles.moreMenuSheet}>
              <View style={styles.moreMenuHandle} />

              <Pressable style={styles.moreMenuItem} onPress={handleMoreSettings}>
                <Text style={styles.moreMenuItemText}>Settings</Text>
              </Pressable>

              <Pressable style={styles.moreMenuItem} onPress={handleMoreExercise}>
                <Text style={styles.moreMenuItemText}>Exercise</Text>
              </Pressable>

              <Pressable style={styles.moreMenuItem} onPress={handleMoreMeds}>
                <Text style={styles.moreMenuItemText}>Meds</Text>
              </Pressable>

              <Pressable style={styles.moreMenuItem} onPress={handleMoreWater}>
                <Text style={styles.moreMenuItemText}>Water</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
  );
}

export default function TabLayout() {
  return (
    <QuickAddProvider>
      <TabLayoutContent />
    </QuickAddProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  quickAddOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  quickAddSheet: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 0,
  },
  quickAddSheetInner: {
    width: '100%',
    maxWidth: 900,
    backgroundColor: '#ffffff',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  quickAddHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 12,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAddCard: {
    width: '48%',
    backgroundColor: '#f6f7fb',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  quickAddCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  quickAddCardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A7599',
    marginBottom: 8,
  },
  quickAddCardIconText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
  },
  quickAddCardLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
  },
  moreMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  moreMenuSheet: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingBottom: 12,
    paddingTop: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  moreMenuHandle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 8,
  },
  moreMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  moreMenuItemText: {
    fontSize: 15,
  },
});
