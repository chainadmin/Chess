import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { COLS, ROWS, sameSquare } from '../game/board';
import { createGameState, GameState, makeMove, resign, timeout } from '../game/gameState';
import { legalMoves } from '../game/legalMoves';
import { Move, SYMBOLS } from '../game/pieces';
import { applyMoveClock, ClockState, createClock, formatMs, tickClock, TIME_CONTROLS } from '../game/timers';
import { adService } from '../services/ads/AdService';
import { multiplayerService } from '../services/multiplayer/MultiplayerService';
type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;
export function GameScreen({ route, navigation }: Props) {
  const mode = route.params.mode;
  const match = route.params.match;
  const [state,setState] = useState<GameState>(createGameState);
  const [clock,setClock] = useState<ClockState>(() => createClock(match?.timeControl ?? TIME_CONTROLS.blitz_3_0));
  const adRecorded = useRef(false);
  const moves = useMemo(() => state.selected ? legalMoves(state.board,state.selected.row,state.selected.col) : [], [state]);
  useEffect(() => { const id = setInterval(() => setClock(c => tickClock(c,1000)), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (clock.timedOut && state.status === 'active') setState(s => timeout(s, clock.timedOut!)); }, [clock.timedOut, state.status]);
  useEffect(() => { if (state.status !== 'active' && !adRecorded.current) { adRecorded.current = true; adService.recordCompletedGame(); } }, [state.status]);
  function reset() { adRecorded.current = false; setState(createGameState()); setClock(createClock(match?.timeControl ?? TIME_CONTROLS.blitz_3_0)); }
  async function play(move: Move) { const before = state.turn; const next = makeMove(state, move); if (next !== state) { setState(next); setClock(c => applyMoveClock(c,before)); if (mode === 'multiplayer') await multiplayerService.sendMove(move); } }
  function tap(row:number,col:number) { const piece = state.board[row][col]; const picked = moves.find(m => m.row===row && m.col===col); if (state.status !== 'active') return; if (state.selected && picked) play({from:state.selected,to:picked,shift:picked.shift}); else if (piece?.color === state.turn) setState(s => ({...s, selected:{row,col}})); else setState(s => ({...s, selected:null})); }
  function doResign() { Alert.alert('Resign?', 'End this game now?', [{text:'Cancel'}, {text:'Resign', style:'destructive', onPress:()=>setState(s=>resign(s,s.turn))}]); }
  return <Screen><View style={styles.header}><Text style={styles.title}>{mode === 'local' ? 'Local Game' : `vs ${match?.opponentName}`}</Text><Text style={styles.status}>{state.status === 'active' ? `${state.turn}'s turn` : `Game over: ${state.status}. Winner: ${state.winner}`}</Text></View><View style={styles.clocks}><Text style={clock.active==='black'?styles.activeClock:styles.clock}>Black {formatMs(clock.blackMs)}</Text><Text style={clock.active==='white'?styles.activeClock:styles.clock}>White {formatMs(clock.whiteMs)}</Text></View><View style={styles.board}>{state.board.map((row,rowIndex)=>row.map((piece,colIndex)=>{const isMove=moves.some(m=>m.row===rowIndex&&m.col===colIndex); const isShift=moves.some(m=>m.row===rowIndex&&m.col===colIndex&&m.shift); return <Pressable key={`${rowIndex}-${colIndex}`} onPress={()=>tap(rowIndex,colIndex)} style={[styles.square,(rowIndex+colIndex)%2?styles.dark:styles.light,sameSquare(state.selected,{row:rowIndex,col:colIndex})&&styles.selected,isMove&&styles.move,isShift&&styles.shift]}><Text style={[styles.piece,piece?.color==='black'&&styles.blackPiece,piece?.type==='S'&&styles.shifter]}>{piece ? SYMBOLS[piece.type] : ''}</Text></Pressable>}))}</View><Text style={styles.copy}>Captured: {state.captured.map((p,i)=><Text key={i}>{SYMBOLS[p.type]} </Text>)}</Text><View style={styles.actions}><AppButton title="Resign" onPress={doResign} secondary />{mode === 'local' && <AppButton title="Reset" onPress={reset} />}</View><Text style={styles.subhead}>Move History</Text><ScrollView style={styles.history}>{state.history.map((h,i)=><Text key={i} style={styles.copy}>{h}</Text>)}</ScrollView><AppButton title="Back Home" onPress={()=>navigation.navigate('Home')} secondary /></Screen>;
}
const styles = StyleSheet.create({ header:{marginBottom:8}, title:{fontSize:26,fontWeight:'900',color:'#f7ead2'}, status:{color:'#75fbff',textTransform:'capitalize'}, clocks:{flexDirection:'row',justifyContent:'space-between',marginBottom:8}, clock:{color:'#d9c7ae',fontWeight:'800'}, activeClock:{color:'#fff',fontWeight:'900'}, board:{width:'100%',aspectRatio:10/8,flexDirection:'row',flexWrap:'wrap',borderRadius:14,overflow:'hidden',borderWidth:2,borderColor:'#6c4a2f'}, square:{width:`${100/COLS}%`,height:`${100/ROWS}%`,alignItems:'center',justifyContent:'center'}, light:{backgroundColor:'#f0d09c'}, dark:{backgroundColor:'#8f5d35'}, selected:{borderWidth:2,borderColor:'#ffed75'}, move:{borderWidth:3,borderColor:'#234d35'}, shift:{borderColor:'#24e7ff',shadowColor:'#24e7ff',shadowOpacity:1,shadowRadius:6}, piece:{fontSize:24,color:'#fffaf0',fontWeight:'900'}, blackPiece:{color:'#1d1718'}, shifter:{color:'#071018',backgroundColor:'#32e5f2',borderRadius:14,paddingHorizontal:7,overflow:'hidden'}, copy:{color:'#e9d8c0',marginTop:8}, actions:{flexDirection:'row',gap:10}, subhead:{color:'#f7ead2',fontWeight:'900',fontSize:18,marginTop:8}, history:{maxHeight:90} });
