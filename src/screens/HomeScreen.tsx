import React, { useCallback, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { authService } from '../services/auth/AuthService';
import { ratingService, ratingTitle } from '../services/rating/RatingService';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
export function HomeScreen({ navigation }: Props) { const [rating,setRating]=useState(1200); const load=useCallback(()=>{authService.currentUser().then(user=>user && ratingService.getRating(user.id).then(current=>setRating(current.value)));},[]); useFocusEffect(load); return <Screen style={styles.center}><Text style={styles.title}>ShiftChess</Text><Text style={styles.rating}>{rating} <Text style={styles.ratingLabel}>{ratingTitle(rating)}</Text></Text><Text style={styles.caption}>Rated multiplayer • 0–3500</Text><AppButton title="Daily Puzzle" onPress={() => navigation.navigate('DailyPuzzle')}/><AppButton title="Play Local" onPress={() => navigation.navigate('Game', { mode: 'local' })}/><AppButton title="Multiplayer" onPress={() => navigation.navigate('Multiplayer')} /><AppButton title="Rules" onPress={() => navigation.navigate('Rules')} secondary/><AppButton title="Settings" onPress={() => navigation.navigate('Settings')} secondary/></Screen>; }
const styles = StyleSheet.create({ center:{justifyContent:'center'}, title:{fontSize:42,fontWeight:'900',color:'#f7ead2',textAlign:'center'}, rating:{fontSize:28,fontWeight:'900',color:'#75fbff',textAlign:'center',marginTop:8}, ratingLabel:{fontSize:16,color:'#f7ead2'}, caption:{color:'#d9c7ae',textAlign:'center',marginBottom:20} });
