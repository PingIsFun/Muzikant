import { API_BASE } from "../config/api.js";

export async function fetchPlaylist(playlistId) {
  const response = await fetch(`${API_BASE}/api/playlist/${playlistId}`);
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error("Spotify is temporarily unavailable. Please try again.");
    }
    throw new Error("Failed to fetch playlist.");
  }
  return response.json();
}
