import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import PlaylistInput from "./components/PlaylistInput.jsx";
import PdfGenerator from "./components/PdfGenerator.jsx";
import { parsePlaylistUrl } from "./utils/parsePlaylistUrl.js";
import { fetchPlaylist } from "./api/backendApi.js";
import { generateQrDataUrl } from "./utils/qrUtils.js";
import {
  addFrontCardToPdf,
  addBackCardToPdf,
  drawCuttingGrid,
  drawPageAlignmentMark,
  CARDS_PER_PAGE,
} from "./utils/pdfLayout.js";
import { registerPdfFonts } from "./utils/pdfFont.js";

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
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const isValidPlaylist = useMemo(() => Boolean(playlistId), [playlistId]);

  useEffect(() => {
    const parsedId = parsePlaylistUrl(playlistInput);
    setPlaylistId(parsedId);
  }, [playlistInput]);

  const handleGeneratePdf = async () => {
    setError("");
    if (!playlistId) {
      setError("Please enter a valid playlist URL or URI.");
      return;
    }

    try {
      setProgress("Fetching tracks");
      const playlist = await fetchPlaylist(playlistId);
      const tracks = playlist?.tracks || [];
      const playlistTitle = playlist?.name || playlistId;
      if (!tracks.length) {
        setProgress("");
        setError("No playable tracks found in this playlist.");
        return;
      }

      setProgress("Generating QR codes");
      const qrDataUrls = [];
      for (let index = 0; index < tracks.length; index += 1) {
        const track = tracks[index];
        setProgress(`Generating QR codes (${index + 1}/${tracks.length})`);
        const dataUrl = await generateQrDataUrl(track.id);
        qrDataUrls.push(dataUrl);
      }

      setProgress("Building PDF");
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
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

      const safeName = sanitizeFilename(playlistTitle) || "playlist";
      pdf.save(`music-timeline-cards-${safeName}.pdf`);
      setProgress("");
    } catch (err) {
      setProgress("");
      setError(err.message || "Something went wrong while generating the PDF.");
    }
  };

  const canGenerate = isValidPlaylist && !progress;

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
            Paste a Spotify playlist link and generate printable QR cards for a music timeline party.
          </p>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            Only the host connects to Spotify on the server. Players do not need accounts.
          </p>
        </header>

        <PlaylistInput
          value={playlistInput}
          onChange={setPlaylistInput}
          isValid={isValidPlaylist}
          playlistId={playlistId}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <PdfGenerator disabled={!canGenerate} onClick={handleGeneratePdf} />
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
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
        </div>
      </div>
    </div>
  );
}
