/**
 * Holds the short-lived access token in memory only (never localStorage/
 * sessionStorage) so it isn't readable by an injected script via XSS.
 * The long-lived refresh token lives in an httpOnly cookie the browser
 * manages automatically - JS never touches it.
 */
let accessToken = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  }
};
