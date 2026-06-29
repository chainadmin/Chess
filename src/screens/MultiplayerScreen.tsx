import React, { useState } from 'react';
import { ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { multiplayerService } from '../services/multiplayer/MultiplayerService';
import { TimeControlId } from '../game/timers';
type Props = NativeStackScreenProps<RootStackParamList, 'Multiplayer'>;
export function MultiplayerScreen({ navigation }: Props) { const [searching,setSearching]=useState(false); const quick=async(id:TimeControlId)=>{setSearching(true); await multiplayerService.connect(); const match=await multiplayerService.joinQueue(id); setSearching(false); navigation.navigate('Game',{mode:'multiplayer',match});}; const cancel=async()=>{await multiplayerService.cancelQueue(); setSearching(false);}; return <Screen><Text style={styles.title}>Quick Match</Text>{searching ? <><ActivityIndicator color="#75fbff"/><Text style={styles.copy}>Searching… mock matchmaking usually takes 2 seconds.</Text><AppButton title="Cancel" onPress={cancel} secondary/></> : <><AppButton title="3 Minute" onPress={()=>quick('blitz_3_0')}/><AppButton title="1 Minute + 1 Second Increment" onPress={()=>quick('bullet_1_1')}/><AppButton title="10 Minute" onPress={()=>quick('rapid_10_0')}/></>} </Screen>; }
const styles = StyleSheet.create({ title:{fontSize:34,fontWeight:'900',color:'#f7ead2',marginBottom:20}, copy:{color:'#d9c7ae',textAlign:'center',margin:20} });
