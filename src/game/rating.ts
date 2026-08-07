export const MIN_RATING = 0;
export const MAX_RATING = 3500;
export const INITIAL_RATING = 1200;

export type GameResult = 'win' | 'draw' | 'loss';
export type Rating = { value: number; gamesPlayed: number };
export type RatingChange = { before: number; after: number; change: number };

export function expectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

export function calculateRating(
  rating: Rating,
  opponentRating: number,
  result: GameResult,
): RatingChange {
  const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const kFactor = rating.gamesPlayed < 30 ? 40 : rating.value < 2400 ? 20 : 10;
  const after = Math.max(
    MIN_RATING,
    Math.min(MAX_RATING, Math.round(rating.value + kFactor * (score - expectedScore(rating.value, opponentRating)))),
  );
  return { before: rating.value, after, change: after - rating.value };
}

export function ratingTitle(value: number) {
  if (value >= 2400) return 'Master';
  if (value >= 2000) return 'Expert';
  if (value >= 1600) return 'Class A';
  if (value >= 1200) return 'Class B';
  if (value >= 800) return 'Class C';
  return 'Newcomer';
}
