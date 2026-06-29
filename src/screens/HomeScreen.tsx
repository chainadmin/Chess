import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
export function HomeScreen({ navigation }: Props) { return <Screen style={styles.center}><Text style={styles.title}>ShiftChess</Text><AppButton title="Play Local" onPress={() => navigation.navigate('Game', { mode: 'local' })}/><AppButton title="Multiplayer" onPress={() => navigation.navigate('Multiplayer')} /><AppButton title="Rules" onPress={() => navigation.navigate('Rules')} secondary/><AppButton title="Settings" onPress={() => navigation.navigate('Settings')} secondary/></Screen>; }
const styles = StyleSheet.create({ center:{justifyContent:'center'}, title:{fontSize:42,fontWeight:'900',color:'#f7ead2',textAlign:'center',marginBottom:24} });
