import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { multiplayerService } from '../services/multiplayer/MultiplayerService';
import { TimeControlId } from '../game/timers';
import { authService } from '../services/auth/AuthService';
import { INITIAL_RATING, ratingService } from '../services/rating/RatingService';
type Props = NativeStackScreenProps<RootStackParamList, 'Multiplayer'>;
export function MultiplayerScreen({ navigation }: Props) { const [searching,setSearching]=useState(false); const [rating,setRating]=useState(INITIAL_RATING); useEffect(()=>{authService.currentUser().then(user=>user && ratingService.getRating(user.id).then(current=>setRating(current.value)));},[]); const quick=async(id:TimeControlId)=>{setSearching(true); await multiplayerService.connect(); const match=await multiplayerService.joinQueue(id,rating); setSearching(false); navigation.navigate('Game',{mode:'multiplayer',match});}; const cancel=async()=>{await multiplayerService.cancelQueue(); setSearching(false);}; return <Screen><Text style={styles.title}>Quick Match</Text><Text style={styles.rating}>Your rating: {rating}</Text>{searching ? <><ActivityIndicator color="#75fbff"/><Text style={styles.copy}>Finding an opponent near your rating…</Text><AppButton title="Cancel" onPress={cancel} secondary/></> : <><AppButton title="3 Minute" onPress={()=>quick('blitz_3_0')}/><AppButton title="1 Minute + 1 Second Increment" onPress={()=>quick('bullet_1_1')}/><AppButton title="10 Minute" onPress={()=>quick('rapid_10_0')}/></>} </Screen>; }
const styles = StyleSheet.create({ title:{fontSize:34,fontWeight:'900',color:'#f7ead2'}, rating:{fontSize:18,fontWeight:'800',color:'#75fbff',marginBottom:20}, copy:{color:'#d9c7ae',textAlign:'center',margin:20} });
