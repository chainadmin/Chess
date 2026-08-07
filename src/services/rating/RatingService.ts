import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../storage/keys';
import { calculateRating, GameResult, INITIAL_RATING, Rating, RatingChange } from '../../game/rating';

export * from '../../game/rating';

type StoredRatings = Record<string, Rating>;

class RatingService {
  private async all(): Promise<StoredRatings> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ratings);
    return raw ? JSON.parse(raw) as StoredRatings : {};
  }

  async getRating(userId: string): Promise<Rating> {
    return (await this.all())[userId] ?? { value: INITIAL_RATING, gamesPlayed: 0 };
  }

  async recordResult(userId: string, opponentRating: number, result: GameResult): Promise<RatingChange> {
    const ratings = await this.all();
    const current = ratings[userId] ?? { value: INITIAL_RATING, gamesPlayed: 0 };
    const change = calculateRating(current, opponentRating, result);
    ratings[userId] = { value: change.after, gamesPlayed: current.gamesPlayed + 1 };
    await AsyncStorage.setItem(STORAGE_KEYS.ratings, JSON.stringify(ratings));
    return change;
  }
}

export const ratingService = new RatingService();
