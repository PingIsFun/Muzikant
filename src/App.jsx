import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import PlaylistInput from "./components/PlaylistInput.jsx";
import PdfGenerator from "./components/PdfGenerator.jsx";
import { parsePlaylistUrl } from "./utils/parsePlaylistUrl.js";
import { startAuth, handleAuthRedirect, getStoredToken, storeToken, clearStoredToken } from "./auth/spotifyAuth.js";
import { fetchPlaylistName, fetchPlaylistTracks } from "./api/spotifyApi.js";
import { generateQrDataUrl } from "./utils/qrUtils.js";
import {
  addFrontCardToPdf,
  addBackCardToPdf,
  drawCuttingGrid,
  drawPageAlignmentMark,
  CARDS_PER_PAGE,
} from "./utils/pdfLayout.js";
import { registerPdfFonts } from "./utils/pdfFont.js";

const SCOPES = ["playlist-read-private", "playlist-read-collaborative"];

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

export default function App() {
  const [playlistInput, setPlaylistInput] = useState("");
  const [playlistId, setPlaylistId] = useState(null);
  const [authStatus, setAuthStatus] = useState("unauthenticated");
  const [accessToken, setAccessToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [playlistName, setPlaylistName] = useState("");

  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin + window.location.pathname;

  const isValidPlaylist = useMemo(() => Boolean(playlistId), [playlistId]);
  const isAuthenticated = Boolean(accessToken) && Date.now() < expiresAt;

  useEffect(() => {
    const parsedId = parsePlaylistUrl(playlistInput);
    setPlaylistId(parsedId);
  }, [playlistInput]);

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      setAccessToken(stored.accessToken);
      setExpiresAt(stored.expiresAt);
      setAuthStatus("authenticated");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        if (!clientId) return;
        const result = await handleAuthRedirect({ clientId, redirectUri });
        if (!result || !isMounted) return;
        storeToken(result.accessToken, result.expiresIn);
        const stored = getStoredToken();
        if (!stored) return;
        setAccessToken(stored.accessToken);
        setExpiresAt(stored.expiresAt);
        setAuthStatus("authenticated");
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || "Authentication failed.");
        setAuthStatus("unauthenticated");
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [clientId, redirectUri]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const timeout = window.setTimeout(() => {
      clearStoredToken();
      setAccessToken(null);
      setExpiresAt(0);
      setAuthStatus("unauthenticated");
      setError("Your session expired. Please reconnect to Spotify.");
    }, Math.max(expiresAt - Date.now(), 0));
    return () => window.clearTimeout(timeout);
  }, [expiresAt]);

  const handleConnect = async () => {
    setError("");
    if (!clientId) {
      setError("Missing Spotify client ID. Set VITE_SPOTIFY_CLIENT_ID in your environment.");
      return;
    }
    setAuthStatus("authenticating");
    await startAuth({ clientId, redirectUri, scopes: SCOPES });
  };

  const handleGeneratePdf = async () => {
    setError("");
    if (!isAuthenticated) {
      setError("Please connect to Spotify again. The session has expired.");
      return;
    }
    if (!playlistId) {
      setError("Please enter a valid playlist URL or URI.");
      return;
    }

    try {
      setProgress("Fetching tracks");
      const [name, tracks] = await Promise.all([
        fetchPlaylistName({ accessToken, playlistId }),
        fetchPlaylistTracks({
          accessToken,
          playlistId,
          onProgress: () => {},
        }),
      ]);
      if (!tracks.length) {
        setProgress("");
        setError("No playable tracks found in this playlist.");
        return;
      }

      setPlaylistName(name);

      setProgress("Generating QR codes");
      const qrDataUrls = [];
      for (let index = 0; index < tracks.length; index += 1) {
        const track = tracks[index];
        setProgress(`Generating QR codes (${index + 1}/${tracks.length})`);
        const dataUrl = await generateQrDataUrl(track.id);
        qrDataUrls.push(dataUrl);
      }

      setProgress("Building PDF");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      setProgress("Loading PDF font");
      await registerPdfFonts(pdf);
      setProgress("Building PDF");
      const totalPages = Math.ceil(tracks.length / CARDS_PER_PAGE);

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        if (pageIndex > 0) {
          pdf.addPage();
        }
        drawCuttingGrid(pdf);
        drawPageAlignmentMark(pdf, false);
        const startIndex = pageIndex * CARDS_PER_PAGE;
        const slice = tracks.slice(startIndex, startIndex + CARDS_PER_PAGE);

        slice.forEach((track, indexOnPage) => {
          addFrontCardToPdf(pdf, {
            indexOnPage,
            qrDataUrl: qrDataUrls[startIndex + indexOnPage],
            footerText: "Scan to play",
          });
        });

        pdf.addPage();
        drawCuttingGrid(pdf);
        drawPageAlignmentMark(pdf, true);
        slice.forEach((track, indexOnPage) => {
          addBackCardToPdf(pdf, {
            indexOnPage,
            year: track.year,
            artist: track.artist,
            title: track.title,
          });
        });
      }

      const safeName = sanitizeFilename(name) || "playlist";
      pdf.save(`music-timeline-cards-${safeName}.pdf`);
      setProgress("");
    } catch (err) {
      setProgress("");
      setError(err.message || "Something went wrong while generating the PDF.");
    }
  };

  const canGenerate = isValidPlaylist && isAuthenticated && !progress;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
        fontFamily: "\"Noto Sans\", system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "white",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
          display: "grid",
          gap: "20px",
        }}
      >
        <header style={{ display: "grid", gap: "8px" }}>
          <h1 style={{ margin: 0, fontSize: "28px" }}>Muzikant</h1>
          <p style={{ margin: 0, color: "#475569" }}>
            Convert a Spotify playlist into printable QR cards for a music timeline party.
          </p>
        </header>

        <PlaylistInput
          value={playlistInput}
          onChange={setPlaylistInput}
          isValid={isValidPlaylist}
          playlistId={playlistId}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <button
            type="button"
            onClick={handleConnect}
            disabled={authStatus === "authenticating"}
            style={{
              padding: "12px 16px",
              fontSize: "16px",
              borderRadius: "6px",
              border: "1px solid #111827",
              background: authStatus === "authenticating" ? "#e2e8f0" : "white",
              color: "#111827",
              cursor: authStatus === "authenticating" ? "not-allowed" : "pointer",
            }}
          >
            {isAuthenticated ? "Re-authenticate" : "Connect to Spotify"}
          </button>
          <PdfGenerator disabled={!canGenerate} onClick={handleGeneratePdf} />
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ fontSize: "14px", color: "#0f172a" }}>
            Auth status: {isAuthenticated ? "Connected" : "Not connected"}
          </div>
          <div style={{ fontSize: "12px", color: "#475569" }}>
            Print duplex (long edge), scale 100%. The L-shaped marks should overlap when aligned correctly.
          </div>
          {progress && (
            <div style={{ fontSize: "14px", color: "#334155" }}>
              {progress}
            </div>
          )}
          {error && (
            <div style={{ fontSize: "14px", color: "#b91c1c" }}>
              {error}
            </div>
          )}
          {!clientId && (
            <div style={{ fontSize: "12px", color: "#7c2d12" }}>
              Set VITE_SPOTIFY_CLIENT_ID and VITE_REDIRECT_URI in your environment, then register the
              redirect URI in your Spotify app.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
