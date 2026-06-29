import React, { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
export function RegisterScreen({ navigation }: Props) { const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [error,setError]=useState(''); const register=async()=>{try{if(password!==confirm) throw new Error('Passwords do not match'); await authService.register(email,password); navigation.replace('Home');}catch(e){setError((e as Error).message)}}; return <Screen><Text style={styles.title}>Register</Text><TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9d8fa8" autoCapitalize="none" value={email} onChangeText={setEmail}/><TextInput style={styles.input} placeholder="Password" placeholderTextColor="#9d8fa8" secureTextEntry value={password} onChangeText={setPassword}/><TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#9d8fa8" secureTextEntry value={confirm} onChangeText={setConfirm}/>{!!error&&<Text style={styles.error}>{error}</Text>}<AppButton title="Create Account" onPress={register}/><AppButton title="Back to Login" onPress={()=>navigation.navigate('Login')} secondary/></Screen>; }
const styles = StyleSheet.create({ title:{fontSize:34,fontWeight:'900',color:'#f7ead2',marginVertical:20}, input:{backgroundColor:'#ffffff12',color:'#fff',padding:14,borderRadius:14,marginVertical:8}, error:{color:'#ff7777'} });
