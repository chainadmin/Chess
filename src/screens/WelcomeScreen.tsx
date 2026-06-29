import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;
export function WelcomeScreen({ navigation }: Props) { const guest = async () => { await authService.continueAsGuest(); navigation.replace('Home'); }; return <Screen style={styles.center}><View style={styles.logo}><Text style={styles.logoText}>S</Text></View><Text style={styles.title}>ShiftChess</Text><Text style={styles.subtitle}>10×8 chess with the Shifter.</Text><AppButton title="Login" onPress={() => navigation.navigate('Login')} /><AppButton title="Register" onPress={() => navigation.navigate('Register')} secondary /><AppButton title="Continue as Guest" onPress={guest} secondary /></Screen>; }
const styles = StyleSheet.create({ center:{justifyContent:'center'}, logo:{alignSelf:'center',width:90,height:90,borderRadius:28,backgroundColor:'#38e6ff',alignItems:'center',justifyContent:'center'}, logoText:{fontSize:54,fontWeight:'900',color:'#111'}, title:{fontSize:42,fontWeight:'900',color:'#f7ead2',textAlign:'center',marginTop:14}, subtitle:{color:'#d9c7ae',textAlign:'center',marginBottom:24} });
