import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { COLS, ROWS, sameSquare } from '../game/board';
import { legalMoves } from '../game/legalMoves';
import { Square, SYMBOLS } from '../game/pieces';
import { DailyPuzzle, dailyPuzzleService } from '../services/puzzles/DailyPuzzleService';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyPuzzle'>;
export function DailyPuzzleScreen({ navigation }: Props) {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const [queued, setQueued] = useState(0);
  const moves = useMemo(() => puzzle && selected ? legalMoves(puzzle.board, selected.row, selected.col) : [], [puzzle, selected]);
  useEffect(() => { dailyPuzzleService.getDaily().then(result => { setPuzzle(result.puzzle); setComplete(result.completed); setQueued(result.queued); setMessage(result.completed ? 'Solved today — come back tomorrow!' : ''); }); }, []);
  async function tap(row: number, col: number) {
    if (!puzzle || complete) return;
    const piece = puzzle.board[row][col];
    if (!selected) { if (piece?.color === 'white') setSelected({ row, col }); return; }
    const legal = moves.some(move => move.row === row && move.col === col);
    if (legal && sameSquare(selected, puzzle.solution.from) && sameSquare({ row, col }, puzzle.solution.to)) {
      setComplete(true); setMessage('Brilliant! Puzzle solved.'); setSelected(null); await dailyPuzzleService.markCompleted(puzzle.date); return;
    }
    if (legal) { setMessage('Not quite. Reset and look for the queen capture.'); setSelected(null); }
    else if (piece?.color === 'white') setSelected({ row, col }); else setSelected(null);
  }
  if (!puzzle) return <Screen style={styles.loading}><ActivityIndicator color="#75fbff" /><Text style={styles.copy}>Generating today’s puzzle…</Text></Screen>;
  return <Screen><Text style={styles.eyebrow}>DAILY PUZZLE · {puzzle.date}</Text><Text style={styles.title}>{puzzle.title}</Text><Text style={styles.copy}>{puzzle.prompt}</Text><View style={styles.board}>{puzzle.board.map((row, rowIndex) => row.map((piece, colIndex) => { const canMove = moves.some(move => move.row === rowIndex && move.col === colIndex); return <Pressable key={`${rowIndex}-${colIndex}`} onPress={() => tap(rowIndex, colIndex)} style={[styles.square, (rowIndex + colIndex) % 2 ? styles.dark : styles.light, sameSquare(selected, {row:rowIndex,col:colIndex}) && styles.selected, canMove && styles.move]}><Text style={[styles.piece, piece?.color === 'black' && styles.blackPiece]}>{piece ? SYMBOLS[piece.type] : ''}</Text></Pressable>; }))}</View><View style={styles.card}><Text style={complete ? styles.success : styles.feedback}>{message || 'Tap a white piece, then choose its destination.'}</Text><Text style={styles.queue}>⚡ {queued} puzzles generated · Tomorrow’s puzzle is ready</Text></View>{!complete && <AppButton title="Reset Puzzle" onPress={() => { setSelected(null); setMessage(''); }} secondary />}<AppButton title="Back Home" onPress={() => navigation.navigate('Home')} secondary /></Screen>;
}
const styles = StyleSheet.create({ loading:{alignItems:'center',justifyContent:'center'}, eyebrow:{color:'#75fbff',fontWeight:'900',letterSpacing:1.5,marginTop:8}, title:{fontSize:30,fontWeight:'900',color:'#f7ead2',marginTop:4}, copy:{color:'#d9c7ae',marginVertical:10}, board:{width:'100%',aspectRatio:10/8,flexDirection:'row',flexWrap:'wrap',borderRadius:14,overflow:'hidden',borderWidth:2,borderColor:'#6c4a2f',marginVertical:12}, square:{width:`${100/COLS}%`,height:`${100/ROWS}%`,alignItems:'center',justifyContent:'center'}, light:{backgroundColor:'#f0d09c'}, dark:{backgroundColor:'#8f5d35'}, selected:{borderWidth:3,borderColor:'#ffed75'}, move:{borderWidth:3,borderColor:'#24e7ff'}, piece:{fontSize:25,color:'#fffaf0',fontWeight:'900'}, blackPiece:{color:'#1d1718'}, card:{backgroundColor:'#211b29',borderRadius:14,padding:14,marginVertical:8}, feedback:{color:'#f7ead2',fontWeight:'800'}, success:{color:'#72f2a0',fontWeight:'900',fontSize:17}, queue:{color:'#9e91a8',marginTop:8,fontSize:12} });
