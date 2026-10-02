export interface GameSessionTokenPayload {
  sub: string;
  gameId: string;
  gameVersionId: string;
  userId?: string;
  type: 'game-session';
}