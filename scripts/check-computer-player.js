const fs = require('fs');

const source = fs.readFileSync('src/game/computerPlayer.ts', 'utf8');
const gameScreen = fs.readFileSync('src/screens/GameScreen.tsx', 'utf8');
const homeScreen = fs.readFileSync('src/screens/HomeScreen.tsx', 'utf8');

for (const difficulty of ['easy', 'medium', 'hard']) {
  if (!source.includes(`'${difficulty}'`)) throw new Error(`Missing ${difficulty} computer difficulty.`);
  if (!homeScreen.includes(`Computer ${difficulty[0].toUpperCase()}${difficulty.slice(1)}`)) throw new Error(`Home screen does not expose ${difficulty}.`);
}

if (!source.includes('deterministicPick')) throw new Error('Computer moves should be deterministic for replayable tests.');
if (!source.includes('depth === 2')) throw new Error('Hard computer difficulty should perform reply-aware search.');
if (!gameScreen.includes('Computer thinking…')) throw new Error('Game screen should lock input and show computer thinking state.');
if (!gameScreen.includes('ShifterSigil')) throw new Error('Game screen should render the Shifter sigil asset.');

console.log('Computer difficulty and Shifter asset checks passed.');
