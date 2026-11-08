import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { adService } from '../services/ads/AdService';
import { AppButton } from './AppButton';
import { theme } from '../styles/theme';
export function AdModal() { const [reason, setReason] = useState<string | null>(null); useEffect(() => adService.subscribe(setReason), []); return <Modal visible={!!reason} onRequestClose={() => setReason(null)} transparent animationType="fade"><View style={styles.backdrop}><View style={styles.card}><Text style={styles.title}>Ad placement preview</Text><Text style={styles.copy}>No live ad is being shown. This is a local placement test; no reward or charge is involved.</Text><AppButton title="Close" onPress={() => setReason(null)} /></View></View></Modal>; }
const styles = StyleSheet.create({ backdrop:{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:24}, card:{backgroundColor:theme.colors.surface,borderRadius:theme.radius.xl,padding:24,borderWidth:1,borderColor:theme.colors.border}, title:{fontSize:28,fontWeight:'900',color:theme.colors.cyan,textAlign:'center'}, copy:{color:theme.colors.text,textAlign:'center',marginVertical:16} });
