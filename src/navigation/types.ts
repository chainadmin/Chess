import { ComputerDifficulty } from '../game/computerPlayer';
import { Match } from '../services/multiplayer/MultiplayerService';
import { Color } from '../game/pieces';
import { TimeControlId } from '../game/timers';

/** Offline game options. `timeControl: null` (or missing) means untimed. */
export type LocalGameParams = { mode: 'local'; computerDifficulty?: ComputerDifficulty; playerColor?: Color; timeControl?: TimeControlId | null };

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Multiplayer: undefined;
  Game: LocalGameParams | { mode: 'multiplayer'; match: Match };
  /** Pick level, color and clock before an offline game. */
  GameSetup: { opponent: 'computer' | 'human'; computerDifficulty?: ComputerDifficulty };
  OnlineGame: { matchId: string };
  DailyPuzzle: undefined;
  Rules: undefined;
  Settings: undefined;
  Leaderboard: undefined;
  Rewards: undefined;
  Shop: undefined;
  Collection: undefined;
  ForgotPassword: undefined;
  /** Shows a freshly issued recovery code once. `then` decides where Continue goes. */
  RecoveryCode: { code: string; then: 'Home' | 'back' };
};
