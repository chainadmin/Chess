import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { ComputerDifficulty } from '../game/computerPlayer';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const playComputer = (computerDifficulty: ComputerDifficulty) => navigation.navigate('Game', { mode: 'local', computerDifficulty });
  return <Screen style={styles.center}><Text style={styles.title}>ShiftChess</Text><Text style={styles.subhead}>Local Play</Text><AppButton title="Pass & Play" onPress={() => navigation.navigate('Game', { mode: 'local' })}/><View style={styles.aiGrid}><AppButton title="Computer Easy" onPress={() => playComputer('easy')} secondary/><AppButton title="Computer Medium" onPress={() => playComputer('medium')} secondary/><AppButton title="Computer Hard" onPress={() => playComputer('hard')} secondary/></View><AppButton title="Multiplayer" onPress={() => navigation.navigate('Multiplayer')} /><AppButton title="Rules" onPress={() => navigation.navigate('Rules')} secondary/><AppButton title="Settings" onPress={() => navigation.navigate('Settings')} secondary/></Screen>;
}

const styles = StyleSheet.create({ center:{justifyContent:'center'}, title:{fontSize:42,fontWeight:'900',color:'#f7ead2',textAlign:'center',marginBottom:18}, subhead:{color:'#75fbff',fontWeight:'900',fontSize:16,textAlign:'center',marginBottom:8,textTransform:'uppercase',letterSpacing:1}, aiGrid:{gap:8,marginVertical:4} });
