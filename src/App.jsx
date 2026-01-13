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
  const [progressValue, setProgressValue] = useState(0);
  const [error, setError] = useState("");
  const [backFields, setBackFields] = useState({
    year: true,
    artist: true,
    album: false,
    title: true,
  });
  const [flipBackSide, setFlipBackSide] = useState(true);

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
      const setProgressState = (message, value) => {
        setProgress(message);
        setProgressValue(value);
      };

      setProgressState("Fetching tracks", 10);
      const playlist = await fetchPlaylist(playlistId);
      const tracks = playlist?.tracks || [];
      const playlistTitle = playlist?.name || playlistId;
      if (!tracks.length) {
        setProgress("");
        setProgressValue(0);
        setError("No playable tracks found in this playlist.");
        return;
      }

      setProgressState("Generating QR codes (1/1)", 20);
      const qrDataUrls = [];
      for (let index = 0; index < tracks.length; index += 1) {
        const track = tracks[index];
        const percent = 20 + Math.round(((index + 1) / tracks.length) * 60);
        setProgressState(`Generating QR codes (${index + 1}/${tracks.length})`, percent);
        const dataUrl = await generateQrDataUrl(track.id);
        qrDataUrls.push(dataUrl);
      }

      setProgressState("Loading PDF font", 85);
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      await registerPdfFonts(pdf);
      setProgressState("Building PDF (1/1)", 90);
      const totalPages = Math.ceil(tracks.length / CARDS_PER_PAGE);

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        const pagePercent = 90 + Math.round(((pageIndex + 1) / totalPages) * 10);
        setProgressState(`Building PDF (${pageIndex + 1}/${totalPages})`, pagePercent);
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
        drawPageAlignmentMark(pdf, flipBackSide);
        slice.forEach((track, indexOnPage) => {
          addBackCardToPdf(pdf, {
            indexOnPage,
            year: track.year,
            artist: track.artist,
            album: track.album,
            title: track.title,
            fields: backFields,
            mirrored: flipBackSide,
          });
        });
      }

      const safeName = sanitizeFilename(playlistTitle) || "playlist";
      pdf.save(`music-timeline-cards-${safeName}.pdf`);
      setProgress("");
      setProgressValue(0);
    } catch (err) {
      setProgress("");
      setProgressValue(0);
      setError(err.message || "Something went wrong while generating the PDF.");
    }
  };

  const hasBackFields = Object.values(backFields).some(Boolean);
  const canGenerate = isValidPlaylist && hasBackFields && !progress;

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
        </header>

        <PlaylistInput
          value={playlistInput}
          onChange={setPlaylistInput}
          isValid={isValidPlaylist}
          playlistId={playlistId}
        />

        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
            Back of card shows
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {[
              { key: "year", label: "Year" },
              { key: "artist", label: "Artist" },
              { key: "album", label: "Album" },
              { key: "title", label: "Title" },
            ].map((field) => {
              return (
                <label key={field.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={backFields[field.key]}
                    onChange={() =>
                      setBackFields((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                    }
                  />
                  <span style={{ fontSize: "14px", color: "#0f172a" }}>
                    {field.label}
                  </span>
                </label>
              );
            })}
          </div>
          {!hasBackFields && (
            <div style={{ fontSize: "12px", color: "#b91c1c" }}>
              Select at least one field to generate cards.
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
            PDF settings
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={flipBackSide}
              onChange={() => setFlipBackSide((prev) => !prev)}
            />
            <span style={{ fontSize: "14px", color: "#0f172a" }}>
              Flip back side
            </span>
          </label>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <PdfGenerator disabled={!canGenerate} onClick={handleGeneratePdf} />
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ fontSize: "12px", color: "#475569" }}>
            Print with no margins at 100% scale for best alignment.
          </div>
          {progress && (
            <div style={{ display: "grid", gap: "6px" }}>
              <div style={{ fontSize: "14px", color: "#334155" }}>
                {progress}
              </div>
              <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "999px" }}>
                <div
                  style={{
                    width: `${Math.min(Math.max(progressValue, 0), 100)}%`,
                    height: "100%",
                    background: "#16a34a",
                    borderRadius: "999px",
                    transition: "width 200ms ease",
                  }}
                />
              </div>
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
