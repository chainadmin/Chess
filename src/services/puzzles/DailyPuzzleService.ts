import AsyncStorage from '@react-native-async-storage/async-storage';
import { Board, COLS, ROWS } from '../../game/board';
import { legalMoves } from '../../game/legalMoves';
import { Move, Piece, Square } from '../../game/pieces';
import { STORAGE_KEYS } from '../../storage/keys';

export type PuzzleDifficulty = 'Easy' | 'Medium' | 'Hard';
export type DailyPuzzle = {
  id: string;
  date: string;
  board: Board;
  solution: Move;
  title: string;
  prompt: string;
  difficulty: PuzzleDifficulty;
};

type StoredPuzzles = { puzzles: DailyPuzzle[]; completed: string[] };
const KNIGHT_JUMPS = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]] as const;
type Random = (max: number) => number;

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

type Template = (random: Random) => { board: Board; solution: Move; title: string; prompt: string; difficulty: PuzzleDifficulty };

// White knight forks/captures a loose black queen — the day's positions vary but the theme stays a clean tactical shot.
const knightForkPuzzle: Template = (random) => {
  const board = emptyBoard();
  board[7][0] = { type: 'K', color: 'white' };
  board[0][9] = { type: 'K', color: 'black' };
  let from: Square = { row: 3, col: 4 }, to: Square = { row: 1, col: 5 };
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = { row: 2 + random(4), col: 2 + random(6) };
    const [dr, dc] = KNIGHT_JUMPS[random(KNIGHT_JUMPS.length)];
    const target = { row: candidate.row + dr, col: candidate.col + dc };
    if (target.row > 0 && target.row < ROWS - 1 && target.col > 0 && target.col < COLS - 1) { from = candidate; to = target; break; }
  }
  board[from.row][from.col] = { type: 'N', color: 'white' };
  board[to.row][to.col] = { type: 'Q', color: 'black' };
  return { board, solution: { from, to }, title: 'Knight Vision', prompt: 'White to move — capture the black queen in one move.', difficulty: 'Easy' };
};

// The Lancer's bishop-style diagonal reach, unblocked, snipes a loose rook.
const shifterDiagonalPuzzle: Template = (random) => {
  const board = emptyBoard();
  board[7][9] = { type: 'K', color: 'white' };
  board[0][0] = { type: 'K', color: 'black' };
  const from: Square = { row: 5 + random(2), col: 1 + random(3) };
  const distance = 2 + random(3);
  const to: Square = { row: from.row - distance, col: from.col + distance };
  board[from.row][from.col] = { type: 'S', color: 'white' };
  board[to.row][to.col] = { type: 'R', color: 'black' };
  return { board, solution: { from, to }, title: "Lancer's Reach", prompt: 'White to move — the Lancer can slide like a bishop. Capture the rook in one move.', difficulty: 'Easy' };
};

// The Lancer's unique one-square orthogonal capture claims a rook sitting right next to it.
const shifterShiftPuzzle: Template = (random) => {
  const board = emptyBoard();
  board[7][9] = { type: 'K', color: 'white' };
  board[0][0] = { type: 'K', color: 'black' };
  const from: Square = { row: 3 + random(3), col: 3 + random(4) };
  const dirs: Square[] = [{ row: 0, col: 1 }, { row: 0, col: -1 }, { row: 1, col: 0 }, { row: -1, col: 0 }];
  const dir = dirs[random(dirs.length)];
  const to: Square = { row: from.row + dir.row, col: from.col + dir.col };
  board[from.row][from.col] = { type: 'S', color: 'white' };
  board[to.row][to.col] = { type: 'R', color: 'black' };
  return { board, solution: { from, to }, title: 'Point-Blank Shift', prompt: "White to move — the Lancer can also step one square orthogonally. Capture the rook in one move.", difficulty: 'Easy' };
};

// A back-rank mate in one: the black king is cornered and boxed in by its own pawns,
// so a rook checking along the open rank covers the only other escape square too.
const backRankMatePuzzle: Template = (random) => {
  const board = emptyBoard();
  const leftCorner = random(2) === 0;
  const kingCol = leftCorner ? 0 : COLS - 1;
  const blockerCol = leftCorner ? 1 : COLS - 2;
  const rookCol = leftCorner ? 2 + random(COLS - 2) : random(COLS - 2);
  board[0][kingCol] = { type: 'K', color: 'black' };
  board[1][kingCol] = { type: 'P', color: 'black' };
  board[1][blockerCol] = { type: 'P', color: 'black' };
  board[7][COLS - 1 - kingCol] = { type: 'K', color: 'white' };
  board[2][rookCol] = { type: 'R', color: 'white' };
  const from: Square = { row: 2, col: rookCol };
  const to: Square = { row: 0, col: rookCol };
  return { board, solution: { from, to }, title: 'Back Rank Break', prompt: 'White to move — deliver checkmate in one.', difficulty: 'Medium' };
};

export const PUZZLE_TEMPLATES = { knightForkPuzzle, shifterDiagonalPuzzle, shifterShiftPuzzle, backRankMatePuzzle };
const TEMPLATES: Template[] = Object.values(PUZZLE_TEMPLATES);

export function generatePuzzle(date: string): DailyPuzzle {
  let seed = hash(`shiftchess-daily-${date}`);
  const random: Random = (max) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  const templateIndex = random(TEMPLATES.length);
  const { board, solution, title, prompt, difficulty } = TEMPLATES[templateIndex](random);
  if (!legalMoves(board, solution.from.row, solution.from.col).some(move => move.row === solution.to.row && move.col === solution.to.col)) {
    throw new Error('Generated an invalid daily puzzle');
  }
  return { id: `daily-${date}-${hash(date).toString(16)}`, date, board, solution, title, prompt, difficulty };
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
    for (const key of wanted) {
      const existing = stored.puzzles.find(p => p.date === key);
      if (!existing || !existing.difficulty) {
        stored.puzzles = stored.puzzles.filter(p => p.date !== key);
        stored.puzzles.push(generatePuzzle(key));
      }
    }
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
