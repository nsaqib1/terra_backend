export interface GameSessionTokenPayload {
  sub: string;
  gameId: string;
  gameVersionId: string;
  userId?: string;
  type: 'game-session';
}

export interface GameSessionContext {
  sessionId: string;
  gameId: string;
  gameVersionId: string;
  userId: string | null;
  expiresAt: Date;
}