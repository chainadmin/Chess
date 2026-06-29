import React, { useCallback, useState } from 'react';
import { Text, StyleSheet, Switch } from 'react-native';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { purchaseService } from '../services/purchases/PurchaseService';
import { authService, User } from '../services/auth/AuthService';
import { STORAGE_KEYS } from '../storage/keys';
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export function SettingsScreen({ navigation }: Props) { const [adsRemoved,setAdsRemoved]=useState(false); const [sound,setSound]=useState(true); const [user,setUser]=useState<User|null>(null); const load=useCallback(()=>{purchaseService.getEntitlements().then(e=>setAdsRemoved(e.adsRemoved)); authService.currentUser().then(setUser); AsyncStorage.getItem(STORAGE_KEYS.soundEnabled).then(v=>setSound(v !== 'false'));},[]); useFocusEffect(load); const remove=async()=>setAdsRemoved((await purchaseService.purchaseRemoveAds()).adsRemoved); const restore=async()=>setAdsRemoved((await purchaseService.restorePurchases()).adsRemoved); const toggle=async(v:boolean)=>{setSound(v); await AsyncStorage.setItem(STORAGE_KEYS.soundEnabled,String(v));}; const logout=async()=>{await authService.logout(); navigation.dispatch(CommonActions.reset({index:0,routes:[{name:'Welcome'}]}));}; return <Screen><Text style={styles.title}>Settings</Text><Text style={styles.copy}>Account: {user ? `${user.displayName}${user.guest ? ' (Guest)' : ''}` : 'Not signed in'}</Text><Text style={styles.copy}>Ads removed: {adsRemoved ? 'Yes' : 'No'}</Text><AppButton title="Remove Ads" onPress={remove}/><AppButton title="Restore Purchases" onPress={restore} secondary/><Text style={styles.copy}>Sound</Text><Switch value={sound} onValueChange={toggle}/><AppButton title="Logout" onPress={logout} secondary/></Screen>; }
const styles = StyleSheet.create({ title:{fontSize:34,fontWeight:'900',color:'#f7ead2',marginBottom:16}, copy:{color:'#e9d8c0',fontSize:16,marginVertical:8} });
