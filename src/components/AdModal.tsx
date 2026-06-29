import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { adService } from '../services/ads/AdService';
import { AppButton } from './AppButton';
export function AdModal() { const [reason, setReason] = useState<string | null>(null); useEffect(() => adService.subscribe(setReason), []); return <Modal visible={!!reason} transparent animationType="fade"><View style={styles.backdrop}><View style={styles.card}><Text style={styles.title}>Mock Ad</Text><Text style={styles.copy}>Expo Go ad placeholder: {reason}</Text><AppButton title="Close" onPress={() => setReason(null)} /></View></View></Modal>; }
const styles = StyleSheet.create({ backdrop:{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:24}, card:{backgroundColor:'#20172a',borderRadius:24,padding:24,borderWidth:1,borderColor:'#ffffff22'}, title:{fontSize:28,fontWeight:'900',color:'#75fbff',textAlign:'center'}, copy:{color:'#f7ead2',textAlign:'center',marginVertical:16} });
