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
import { OnlineGameScreen } from './src/screens/OnlineGameScreen';
import { GameScreen } from './src/screens/GameScreen';
import { RulesScreen } from './src/screens/RulesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { DailyPuzzleScreen } from './src/screens/DailyPuzzleScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { RewardsScreen } from './src/screens/RewardsScreen';
import { ShopScreen } from './src/screens/ShopScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { RecoveryCodeScreen } from './src/screens/RecoveryCodeScreen';
import { purchaseService } from './src/services/purchases/PurchaseService';
import { entitlementStore } from './src/services/purchases/entitlements';
import { authService } from './src/services/auth/AuthService';
import { adService } from './src/services/ads/AdService';
import { AdModal } from './src/components/AdModal';
import { theme } from './src/styles/theme';
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function App() { const [initial,setInitial]=useState<keyof RootStackParamList | null>(null); useEffect(()=>{
  authService.currentUser().then(u=>setInitial(u?'Home':'Welcome'));
  // Load verified purchases first so "Remove Ads" is respected before any ad request.
  void entitlementStore.load()
    .then(()=>purchaseService.available ? purchaseService.init().catch(()=>undefined) : undefined)
    .then(()=>adService.initAds())
    .catch(()=>undefined);
},[]); if (!initial) return <View style={{flex:1,backgroundColor:theme.colors.bgBottom,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={theme.colors.cyan} /></View>; return <NavigationContainer><Stack.Navigator initialRouteName={initial} screenOptions={{headerStyle:{backgroundColor:theme.colors.bgTop},headerTintColor:theme.colors.text,contentStyle:{backgroundColor:theme.colors.bgBottom}}}><Stack.Screen name="Welcome" component={WelcomeScreen} options={{headerShown:false}}/><Stack.Screen name="Login" component={LoginScreen}/><Stack.Screen name="Register" component={RegisterScreen}/><Stack.Screen name="Home" component={HomeScreen} options={{headerShown:false}}/><Stack.Screen name="Multiplayer" component={MultiplayerScreen} options={{title:'Play online'}}/><Stack.Screen name="Game" component={GameScreen}/><Stack.Screen name="OnlineGame" component={OnlineGameScreen} options={{title:'Online 3+2'}}/><Stack.Screen name="DailyPuzzle" component={DailyPuzzleScreen} options={{title:'Daily Puzzle'}}/><Stack.Screen name="Rules" component={RulesScreen}/><Stack.Screen name="Settings" component={SettingsScreen}/><Stack.Screen name="Leaderboard" component={LeaderboardScreen}/><Stack.Screen name="Rewards" component={RewardsScreen} options={{title:'Levels & rewards'}}/><Stack.Screen name="Shop" component={ShopScreen}/><Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{title:'Reset password'}}/><Stack.Screen name="RecoveryCode" component={RecoveryCodeScreen} options={{title:'Recovery code',headerBackVisible:false,gestureEnabled:false}}/></Stack.Navigator><AdModal /></NavigationContainer>; }
