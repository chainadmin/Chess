const COLS = 10, ROWS = 8;
const BACK_RANK = ['R', 'N', 'S', 'B', 'Q', 'K', 'B', 'S', 'N', 'R'];
const FILES = 'abcdefghij'.split('');
const SYMBOLS = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', S: 'S' };
const DIRS = {
  bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  queen: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  knight: [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]],
  king: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};

let screen = 'home';
let board = makeInitialBoard();
let turn = 'white';
let selected = null;
let captured = [];
let history = [];
const app = document.querySelector('#app');

function makeInitialBoard() {
  const newBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  newBoard[0] = BACK_RANK.map(type => ({ type, color: 'black' }));
  newBoard[1] = Array.from({ length: COLS }, () => ({ type: 'P', color: 'black' }));
  newBoard[6] = Array.from({ length: COLS }, () => ({ type: 'P', color: 'white' }));
  newBoard[7] = BACK_RANK.map(type => ({ type, color: 'white' }));
  return newBoard;
}

const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const cloneBoard = position => position.map(row => row.map(piece => piece ? { ...piece } : null));
const sameSquare = (a, b) => a && b && a.r === b.r && a.c === b.c;
const algebraic = ({ r, c }) => `${FILES[c]}${ROWS - r}`;

function rayMoves(position, r, c, dirs, color) {
  const moves = [];
  for (const [dc, dr] of dirs) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = position[nr][nc];
      if (!target) moves.push({ r: nr, c: nc });
      else { if (target.color !== color) moves.push({ r: nr, c: nc }); break; }
      nr += dr; nc += dc;
    }
  }
  return moves;
}

function pseudoMoves(position, r, c) {
  const piece = position[r][c];
  if (!piece) return [];
  const { type, color } = piece;
  if (type === 'B') return rayMoves(position, r, c, DIRS.bishop, color);
  if (type === 'R') return rayMoves(position, r, c, DIRS.rook, color);
  if (type === 'Q') return rayMoves(position, r, c, DIRS.queen, color);
  if (type === 'S') {
    const diagonal = rayMoves(position, r, c, DIRS.bishop, color);
    const shift = DIRS.rook.map(([dc, dr]) => ({ r: r + dr, c: c + dc }))
      .filter(m => inBounds(m.r, m.c) && position[m.r][m.c]?.color !== color)
      .map(m => ({ ...m, shift: true }));
    return [...diagonal, ...shift];
  }
  if (type === 'N') return DIRS.knight.map(([dc, dr]) => ({ r: r + dr, c: c + dc }))
    .filter(m => inBounds(m.r, m.c) && position[m.r][m.c]?.color !== color);
  if (type === 'K') return DIRS.king.map(([dc, dr]) => ({ r: r + dr, c: c + dc }))
    .filter(m => inBounds(m.r, m.c) && position[m.r][m.c]?.color !== color);
  if (type === 'P') {
    const moves = [];
    const dir = color === 'white' ? -1 : 1;
    const start = color === 'white' ? 6 : 1;
    if (inBounds(r + dir, c) && !position[r + dir][c]) {
      moves.push({ r: r + dir, c });
      if (r === start && !position[r + dir * 2][c]) moves.push({ r: r + dir * 2, c });
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inBounds(nr, nc) && position[nr][nc] && position[nr][nc].color !== color) moves.push({ r: nr, c: nc });
    }
    return moves;
  }
  return [];
}

function findKing(position, color) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (position[r][c]?.type === 'K' && position[r][c]?.color === color) return { r, c };
  return null;
}

function isInCheck(position, color) {
  const king = findKing(position, color);
  if (!king) return true;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (position[r][c] && position[r][c].color !== color && pseudoMoves(position, r, c).some(m => sameSquare(m, king))) return true;
  }
  return false;
}

function legalMoves(position, r, c) {
  const piece = position[r][c];
  if (!piece) return [];
  return pseudoMoves(position, r, c).filter(m => {
    const next = cloneBoard(position);
    next[m.r][m.c] = next[r][c];
    next[r][c] = null;
    return !isInCheck(next, piece.color);
  });
}

function allLegalMoves(position, color) {
  const all = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (position[r][c]?.color === color) all.push(...legalMoves(position, r, c));
  return all;
}

function resetGame() {
  board = makeInitialBoard(); turn = 'white'; selected = null; captured = []; history = []; renderGame();
}

function setScreen(next) { screen = next; selected = null; render(); }

function tapSquare(r, c) {
  const moves = selected ? legalMoves(board, selected.r, selected.c) : [];
  const piece = board[r][c];
  const move = moves.find(m => m.r === r && m.c === c);
  if (selected && move) {
    const next = cloneBoard(board);
    const moving = next[selected.r][selected.c];
    const taken = next[r][c];
    next[r][c] = moving; next[selected.r][selected.c] = null;
    if (moving.type === 'P' && (r === 0 || r === ROWS - 1)) next[r][c] = { ...moving, type: 'Q' };
    board = next;
    if (taken) captured.push(taken);
    history.unshift(`${turn[0].toUpperCase()} ${moving.type}${algebraic(selected)}→${algebraic({ r, c })}${taken ? ` x${taken.type}` : ''}${move.shift ? ' shift' : ''}`);
    turn = turn === 'white' ? 'black' : 'white';
    selected = null;
  } else if (piece?.color === turn) selected = { r, c };
  else selected = null;
  renderGame();
}

function render() {
  if (screen === 'home') renderHome();
  if (screen === 'rules') renderRules();
  if (screen === 'game') renderGame();
}

function renderHome() {
  app.innerHTML = `<section class="panel home"><div class="brand"><span class="logo">S</span><h1>ShiftChess</h1><p>10×8 chess with a color-shifting bishop.</p></div><button id="play">Play Local</button><button class="secondary" id="rules">Rules</button></section>`;
  document.querySelector('#play').addEventListener('click', () => setScreen('game'));
  document.querySelector('#rules').addEventListener('click', () => setScreen('rules'));
}

function renderRules() {
  app.innerHTML = `<section class="panel rules"><button class="link" id="home">← Home</button><h1>Rules</h1><p>ShiftChess uses a 10 column by 8 row board. Each back rank starts:</p><p class="rank">R N S B Q K B S N R</p><p>Each side has 10 pawns. Standard chess movement, captures, turns, check, and checkmate detection apply unless changed here.</p><h2>Shifter (S)</h2><ul><li><b>Bishop move:</b> any number of diagonal squares, without jumping, including diagonal captures.</li><li><b>Shift move:</b> exactly one square up, down, left, or right, including captures. This switches square color.</li><li><b>Not a queen:</b> it cannot move multiple orthogonal squares.</li><li><b>Not a king:</b> a one-square diagonal is legal only because it is also a clear bishop move.</li></ul><p>Example: a Shifter on e4 can slide diagonally to b7 or h1 if clear, or shift exactly to e5, e3, d4, or f4.</p><button id="play">Play Local</button></section>`;
  document.querySelector('#home').addEventListener('click', () => setScreen('home'));
  document.querySelector('#play').addEventListener('click', () => setScreen('game'));
}

function renderGame() {
  screen = 'game';
  const moves = selected ? legalMoves(board, selected.r, selected.c) : [];
  const check = isInCheck(board, turn);
  const mate = check && allLegalMoves(board, turn).length === 0;
  app.innerHTML = `<section class="game"><header><button class="link" id="home">← Home</button><div><h1>ShiftChess</h1><p class="${check ? 'danger' : ''}">${mate ? `${turn} is checkmated` : `${turn}'s turn${check ? ' — check!' : ''}`}</p></div><button id="reset">Reset</button></header><div class="captured"><b>Captured</b><span>${captured.length ? captured.map(p => `<em class="${p.color}">${SYMBOLS[p.type]}</em>`).join('') : 'None'}</span></div><div class="board" aria-label="10 by 8 ShiftChess board"></div><section class="history"><h2>Move History</h2><ol>${history.map(h => `<li>${h}</li>`).join('')}</ol></section></section>`;
  const boardEl = document.querySelector('.board');
  board.forEach((row, r) => row.forEach((piece, c) => {
    const isMove = moves.some(m => m.r === r && m.c === c);
    const isShift = moves.some(m => m.r === r && m.c === c && m.shift);
    const square = document.createElement('button');
    square.className = `square ${(r + c) % 2 ? 'dark' : 'light'} ${sameSquare(selected, { r, c }) ? 'selected' : ''} ${isMove ? 'move' : ''} ${isShift ? 'shift' : ''}`;
    square.innerHTML = `<span class="coord">${c === 0 ? ROWS - r : ''}${r === ROWS - 1 ? FILES[c] : ''}</span>${piece ? `<span class="piece ${piece.color} ${piece.type === 'S' ? 'shifter' : ''}">${SYMBOLS[piece.type]}</span>` : ''}`;
    square.addEventListener('click', () => tapSquare(r, c));
    boardEl.appendChild(square);
  }));
  document.querySelector('#home').addEventListener('click', () => setScreen('home'));
  document.querySelector('#reset').addEventListener('click', resetGame);
}

render();
