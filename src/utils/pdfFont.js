const FONT_NAME = "NotoSans";
const BASE_URL = import.meta.env.BASE_URL;
const REGULAR_PATH = `${BASE_URL}fonts/NotoSans-Regular.ttf`;
const BOLD_PATH = `${BASE_URL}fonts/NotoSans-Bold.ttf`;
const ITALIC_PATH = `${BASE_URL}fonts/NotoSans-Italic.ttf`;
const REGULAR_FILE = "NotoSans-Regular.ttf";
const BOLD_FILE = "NotoSans-Bold.ttf";
const ITALIC_FILE = "NotoSans-Italic.ttf";

let fontDataPromise = null;
const registeredPdfs = new WeakSet();

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchFontData(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error("Unable to load PDF font. Check that the font files are available.");
  }
  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

async function loadFontData() {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all([
      fetchFontData(REGULAR_PATH),
      fetchFontData(BOLD_PATH),
      fetchFontData(ITALIC_PATH),
    ]);
  }
  return fontDataPromise;
}

export async function registerPdfFonts(pdf) {
  if (registeredPdfs.has(pdf)) {
    return FONT_NAME;
  }
  const [regular, bold, italic] = await loadFontData();
  pdf.addFileToVFS(REGULAR_FILE, regular);
  pdf.addFont(REGULAR_FILE, FONT_NAME, "normal");
  pdf.addFileToVFS(BOLD_FILE, bold);
  pdf.addFont(BOLD_FILE, FONT_NAME, "bold");
  pdf.addFileToVFS(ITALIC_FILE, italic);
  pdf.addFont(ITALIC_FILE, FONT_NAME, "italic");
  registeredPdfs.add(pdf);
  return FONT_NAME;
}

export const PDF_FONT_NAME = FONT_NAME;
