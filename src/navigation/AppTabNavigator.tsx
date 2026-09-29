import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FileText, Home, Map, MessageCircle, User } from 'lucide-react-native';

import { colors } from '@/constants/theme';
import { MessagesScreen } from '@/screens/messages/MessagesScreen';
import { ModeHomeScreen } from '@/screens/ModeHomeScreen';
import { ModeRequestsScreen } from '@/screens/ModeRequestsScreen';
import { UserProfileScreen } from '@/screens/profile/UserProfileScreen';

export type AppTabParamList = {
  Home: undefined;
  Requests: undefined;
  Map: undefined;
  Chat: undefined;
  AppProfile: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

const tabIcon =
  (Icon: typeof Home) =>
  ({ color, size }: { color: string; size: number }) => <Icon color={color} size={size} />;

export function AppTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.foreground,
        lazy: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tab.Screen
        component={ModeHomeScreen}
        name="Home"
        options={{
          headerShown: false,
          tabBarIcon: tabIcon(Home),
          title: 'Home',
        }}
      />
      <Tab.Screen
        component={ModeRequestsScreen}
        name="Requests"
        options={{
          headerShown: false,
          tabBarIcon: tabIcon(FileText),
          title: 'Requests',
        }}
      />
      <Tab.Screen
        getComponent={() =>
          // Keep MapLibre off the initial signed-in bundle until the Map tab opens.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('@/screens/donor/NearbyDonorsMapScreen').NearbyDonorsMapScreen
        }
        name="Map"
        options={{
          headerShown: false,
          tabBarIcon: tabIcon(Map),
          title: 'Map',
        }}
      />
      <Tab.Screen
        component={MessagesScreen}
        name="Chat"
        options={{
          headerShown: false,
          tabBarIcon: tabIcon(MessageCircle),
          title: 'Chat',
        }}
      />
      <Tab.Screen
        component={UserProfileScreen}
        name="AppProfile"
        options={{
          headerShown: false,
          tabBarIcon: tabIcon(User),
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}
