import { ComputerDifficulty } from '../game/computerPlayer';
import { Match } from '../services/multiplayer/MultiplayerService';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Multiplayer: undefined;
  Game: { mode: 'local'; computerDifficulty?: ComputerDifficulty } | { mode: 'multiplayer'; match: Match };
  OnlineGame: { matchId: string };
  DailyPuzzle: undefined;
  Rules: undefined;
  Settings: undefined;
  Leaderboard: undefined;
  Rewards: undefined;
  Shop: undefined;
  ForgotPassword: undefined;
  /** Shows a freshly issued recovery code once. `then` decides where Continue goes. */
  RecoveryCode: { code: string; then: 'Home' | 'back' };
};
