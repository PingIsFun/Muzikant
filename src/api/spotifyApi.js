const API_BASE = "https://api.spotify.com/v1";

async function spotifyFetch(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Spotify API error: ${detail}`);
  }
  return response.json();
}

export async function fetchPlaylistName({ accessToken, playlistId }) {
  const url = `${API_BASE}/playlists/${playlistId}?fields=name`;
  const data = await spotifyFetch(url, accessToken);
  return data.name || "playlist";
}

export async function fetchPlaylistTracks({ accessToken, playlistId, onProgress }) {
  const tracks = [];
  const seen = new Set();
  let url = `${API_BASE}/playlists/${playlistId}/tracks?limit=100`;

  while (url) {
    const data = await spotifyFetch(url, accessToken);
    if (onProgress) {
      const fetched = tracks.length + data.items.length;
      onProgress(fetched);
    }

    for (const item of data.items) {
      if (!item || item.is_local) continue;
      const track = item.track;
      if (!track || !track.id) continue;
      if (seen.has(track.id)) continue;

      const releaseDate = track.album?.release_date || "";
      const year = Number.parseInt(releaseDate.slice(0, 4), 10);
      if (!Number.isFinite(year)) continue;

      const artists = (track.artists || []).map((artist) => artist.name).filter(Boolean);

      tracks.push({
        id: track.id,
        title: track.name,
        artist: artists.join(", "),
        year,
        spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
      });
      seen.add(track.id);
    }

    url = data.next;
  }

  return tracks;
}
