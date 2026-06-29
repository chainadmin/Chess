import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './src/navigation/types';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MultiplayerScreen } from './src/screens/MultiplayerScreen';
import { GameScreen } from './src/screens/GameScreen';
import { RulesScreen } from './src/screens/RulesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { authService } from './src/services/auth/AuthService';
import { adService } from './src/services/ads/AdService';
import { AdModal } from './src/components/AdModal';
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function App() { const [initial,setInitial]=useState<keyof RootStackParamList | null>(null); useEffect(()=>{adService.initAds(); authService.currentUser().then(u=>setInitial(u?'Home':'Welcome'));},[]); if (!initial) return <View style={{flex:1,backgroundColor:'#120f18',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color='#75fbff' /></View>; return <NavigationContainer><Stack.Navigator initialRouteName={initial} screenOptions={{headerStyle:{backgroundColor:'#120f18'},headerTintColor:'#f7ead2',contentStyle:{backgroundColor:'#120f18'}}}><Stack.Screen name="Welcome" component={WelcomeScreen} options={{headerShown:false}}/><Stack.Screen name="Login" component={LoginScreen}/><Stack.Screen name="Register" component={RegisterScreen}/><Stack.Screen name="Home" component={HomeScreen} options={{headerShown:false}}/><Stack.Screen name="Multiplayer" component={MultiplayerScreen}/><Stack.Screen name="Game" component={GameScreen}/><Stack.Screen name="Rules" component={RulesScreen}/><Stack.Screen name="Settings" component={SettingsScreen}/></Stack.Navigator><AdModal /></NavigationContainer>; }
