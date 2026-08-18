import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0d0d1a', borderTopColor: '#1a1a2e' },
        tabBarActiveTintColor: '#9b59b6',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text> }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔍</Text> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: 'PortAils', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🌀</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>☽</Text> }}
      />
    </Tabs>
  )
}
