import { Match } from '../services/multiplayer/MultiplayerService';
export type RootStackParamList = { Welcome: undefined; Login: undefined; Register: undefined; Home: undefined; Multiplayer: undefined; Game: { mode: 'local' | 'multiplayer'; match?: Match }; DailyPuzzle: undefined; Rules: undefined; Settings: undefined };
