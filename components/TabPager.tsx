import React from 'react';
import { Pressable, View } from 'react-native';
import TopTabs from 'expo-router/js-top-tabs';
import type { MaterialTopTabNavigationEventMap } from 'expo-router/js-top-tabs';
import type {
  NavigationHelpers,
  ParamListBase,
  TabNavigationState,
} from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useApp } from '../hooks/useApp';
import { Txt } from './ui';
import { PagerGestureProvider } from './PagerGestures';
import { s } from '../i18n/zh-CN';
const labels: Record<string, string> = {
  index: s.today,
  trends: s.trends,
  foods: s.foods,
  settings: s.settings,
};
function Icon({ name, color }: { name: string; color: string }) {
  return (
    <Svg
      width={21}
      height={21}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'index' ? (
        <Path d="M5 3h14v18H5zM8 8h8M8 12h5M8 16h6" />
      ) : name === 'trends' ? (
        <Path d="M3 4v16h18M6 15l4-5 4 3 6-8" />
      ) : name === 'foods' ? (
        <Path d="M12 7c-6-5-12 6-5 13 2 2 3 0 5 0s3 2 5 0c7-7 1-18-5-13M12 7c0-4 2-5 5-5" />
      ) : (
        <>
          <Circle cx="12" cy="12" r="8" />
          <Circle cx="12" cy="12" r="3" />
          <Path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
        </>
      )}
    </Svg>
  );
}
interface BarProps {
  state: TabNavigationState<ParamListBase>;
  navigation: NavigationHelpers<ParamListBase, MaterialTopTabNavigationEventMap>;
}
function BottomBar({ state, navigation }: BarProps) {
  const { colors } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        paddingBottom: insets.bottom,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {state.routes.map((route, index) => {
        const selected = state.index === index;
        const color = selected ? colors.text : colors.textSecondary;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={labels[route.name]}
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{
              flex: 1,
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <Icon name={route.name} color={color} />
            <Txt size={11} color={color}>
              {labels[route.name]}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
export function TabPager() {
  const { colors } = useApp();
  return (
    <PagerGestureProvider>
      {(gestureLocked) => (
        <TopTabs
          initialRouteName="index"
          backBehavior="history"
          tabBarPosition="bottom"
          tabBar={(props: BarProps) => <BottomBar {...props} />}
          screenOptions={{
            swipeEnabled: !gestureLocked,
            animationEnabled: true,
            lazy: true,
            lazyPreloadDistance: 1,
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          <TopTabs.Screen name="index" options={{ title: s.today }} />
          <TopTabs.Screen name="trends" options={{ title: s.trends }} />
          <TopTabs.Screen name="foods" options={{ title: s.foods }} />
          <TopTabs.Screen name="settings" options={{ title: s.settings }} />
        </TopTabs>
      )}
    </PagerGestureProvider>
  );
}
