const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const STATE_KEY = "spotify_auth_state";
const VERIFIER_KEY = "spotify_code_verifier";
const TOKEN_KEY = "spotify_access_token";
const EXPIRES_KEY = "spotify_token_expires_at";

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => ("0" + byte.toString(16)).slice(-2)).join("");
}

async function generateCodeChallenge(verifier) {
  const digest = await sha256(verifier);
  return base64UrlEncode(digest);
}

function buildAuthUrl({ clientId, redirectUri, scopes, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function startAuth({ clientId, redirectUri, scopes }) {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const url = buildAuthUrl({
    clientId,
    redirectUri,
    scopes,
    state,
    codeChallenge: challenge,
  });

  window.location.assign(url);
}

export function storeToken(accessToken, expiresIn) {
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresIn * 1000));
}

export function getStoredToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = sessionStorage.getItem(EXPIRES_KEY);
  if (!token || !expiresAt) return null;
  if (Date.now() >= Number(expiresAt)) return null;
  return { accessToken: token, expiresAt: Number(expiresAt) };
}

export function clearStoredToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

export async function handleAuthRedirect({ clientId, redirectUri }) {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("error");
  const authErrorDescription = params.get("error_description") || "";
  if (authError) {
    if (authError === "invalid_redirect_uri" || authErrorDescription.toLowerCase().includes("redirect")) {
      throw new Error("Redirect URI does not match Spotify app configuration.");
    }
    if (authError === "access_denied") {
      throw new Error("Authorization was denied. Please approve access to continue.");
    }
    throw new Error(authErrorDescription || "Authorization failed.");
  }
  const code = params.get("code");
  const state = params.get("state");
  if (!code) return null;

  const storedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!storedState || !verifier || state !== storedState) {
    throw new Error("Authentication state mismatch. Please try again.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Token request failed: ${detail}`);
  }

  const data = await response.json();

  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}
