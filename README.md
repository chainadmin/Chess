# ShiftChess

ShiftChess is a mobile-only local prototype for a 10×8 chess variant featuring the **Shifter**.

## Rules

- Board: 10 columns × 8 rows.
- Back rank for both players: `R N S B Q K B S N R`.
- Pawn rank: 10 pawns per side.
- Standard chess movement, captures, alternating turns, check, and checkmate detection are implemented unless noted below.
- Pawns promote to queens when they reach the far rank.
- Castling and en passant are intentionally omitted for this prototype.

## Shifter (S)

The Shifter is visually represented by an `S` token.

It has two legal move types:

1. **Bishop move**: moves any number of squares diagonally, cannot jump pieces, and captures diagonally like a bishop.
2. **Shift move**: moves exactly one square orthogonally up, down, left, or right, and may capture on that square.

Important clarifications:

- The Shifter is **not** a queen; it cannot move multiple squares orthogonally.
- The Shifter is **not** a king; diagonal movement is legal only as a bishop-style path.
- Orthogonal Shifter moves receive a subtle cyan glow in the legal-move highlight.

## Screens

- Home: Play Local and Rules.
- Game: 10×8 board, captured pieces, turn/check indicator, reset button, move history.
- Rules: variant setup and Shifter examples.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 on a phone-sized viewport. The prototype intentionally displays a phone-only notice on wider screens.

## Build

```bash
npm run build
```
