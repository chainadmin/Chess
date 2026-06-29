import React, { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
export function LoginScreen({ navigation }: Props) { const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const login=async()=>{try{await authService.login(email,password); navigation.replace('Home');}catch(e){setError((e as Error).message)}}; return <Screen><Text style={styles.title}>Login</Text><TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9d8fa8" autoCapitalize="none" value={email} onChangeText={setEmail}/><TextInput style={styles.input} placeholder="Password" placeholderTextColor="#9d8fa8" secureTextEntry value={password} onChangeText={setPassword}/>{!!error&&<Text style={styles.error}>{error}</Text>}<AppButton title="Login" onPress={login}/><AppButton title="Register instead" onPress={()=>navigation.navigate('Register')} secondary/></Screen>; }
const styles = StyleSheet.create({ title:{fontSize:34,fontWeight:'900',color:'#f7ead2',marginVertical:20}, input:{backgroundColor:'#ffffff12',color:'#fff',padding:14,borderRadius:14,marginVertical:8}, error:{color:'#ff7777'} });
