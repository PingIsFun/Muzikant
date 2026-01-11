import React from "react";

export default function PlaylistInput({ value, onChange, isValid, playlistId }) {
  return (
    <div style={{ display: "grid", gap: "8px" }}>
      <label htmlFor="playlist" style={{ fontWeight: 600 }}>
        Playlist URL or URI
      </label>
      <input
        id="playlist"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://open.spotify.com/playlist/..."
        style={{ padding: "10px", fontSize: "16px", borderRadius: "6px", border: "1px solid #ccc" }}
      />
      <div style={{ fontSize: "13px", color: isValid ? "#166534" : "#7f1d1d" }}>
        {isValid && playlistId
          ? `Playlist ID: ${playlistId}`
          : "Enter a valid Spotify playlist URL or URI."}
      </div>
    </div>
  );
}
