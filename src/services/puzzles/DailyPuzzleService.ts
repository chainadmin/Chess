import AsyncStorage from '@react-native-async-storage/async-storage';
import { Board, COLS, ROWS } from '../../game/board';
import { legalMoves } from '../../game/legalMoves';
import { Move, Piece } from '../../game/pieces';
import { STORAGE_KEYS } from '../../storage/keys';

export type DailyPuzzle = {
  id: string;
  date: string;
  board: Board;
  solution: Move;
  title: string;
  prompt: string;
};

type StoredPuzzles = { puzzles: DailyPuzzle[]; completed: string[] };
const KNIGHT_JUMPS = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]] as const;

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + amount);
  return localDateKey(date);
}

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

function emptyBoard(): Board { return Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null)); }

export function generatePuzzle(date: string): DailyPuzzle {
  let seed = hash(`shiftchess-daily-${date}`);
  const random = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  const board = emptyBoard();
  board[7][0] = { type: 'K', color: 'white' };
  board[0][9] = { type: 'K', color: 'black' };

  // Generate a fresh, legal knight fork/capture layout from the date seed.
  let from = { row: 3, col: 4 }, to = { row: 1, col: 5 };
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = { row: 2 + random(4), col: 2 + random(6) };
    const [dr, dc] = KNIGHT_JUMPS[random(KNIGHT_JUMPS.length)];
    const target = { row: candidate.row + dr, col: candidate.col + dc };
    if (target.row > 0 && target.row < ROWS - 1 && target.col > 0 && target.col < COLS - 1) { from = candidate; to = target; break; }
  }
  board[from.row][from.col] = { type: 'N', color: 'white' };
  board[to.row][to.col] = { type: 'Q', color: 'black' };
  const solution = { from, to };
  if (!legalMoves(board, from.row, from.col).some(move => move.row === to.row && move.col === to.col)) {
    throw new Error('Generated an invalid daily puzzle');
  }
  return { id: `daily-${date}-${hash(date).toString(16)}`, date, board, solution, title: 'Knight Vision', prompt: 'White to move — capture the black queen in one move.' };
}

async function read(): Promise<StoredPuzzles> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.dailyPuzzles);
  if (!raw) return { puzzles: [], completed: [] };
  try { const value = JSON.parse(raw) as StoredPuzzles; return { puzzles: value.puzzles ?? [], completed: value.completed ?? [] }; }
  catch { return { puzzles: [], completed: [] }; }
}

async function write(value: StoredPuzzles) { await AsyncStorage.setItem(STORAGE_KEYS.dailyPuzzles, JSON.stringify(value)); }

export const dailyPuzzleService = {
  async getDaily(date = new Date()) {
    const today = localDateKey(date);
    const stored = await read();
    // Always keep today's puzzle plus tomorrow's ready. On first launch this creates two.
    const wanted = [today, addDays(today, 1)];
    for (const key of wanted) if (!stored.puzzles.some(puzzle => puzzle.date === key)) stored.puzzles.push(generatePuzzle(key));
    stored.puzzles = stored.puzzles.filter(puzzle => puzzle.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
    await write(stored);
    return { puzzle: stored.puzzles.find(item => item.date === today)!, completed: stored.completed.includes(today), queued: stored.puzzles.length };
  },
  async markCompleted(date: string) {
    const stored = await read();
    if (!stored.completed.includes(date)) stored.completed.push(date);
    await write(stored);
  }
};
