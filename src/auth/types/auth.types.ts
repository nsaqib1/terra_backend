export interface AccessTokenPayload {
  sub: string;
  type: 'access';
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}