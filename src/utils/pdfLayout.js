export const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 15,
  marginTop: 15,
  marginRight: 10,
  marginBottom: 10,
};

const MIN_CARD_SIZE = 32;
const QR_SCALE = 0.78;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function computeLayout() {
  const contentWidth = PAGE.width - PAGE.marginLeft - PAGE.marginRight;
  const contentHeight = PAGE.height - PAGE.marginTop - PAGE.marginBottom;
  const maxCols = Math.floor(contentWidth / MIN_CARD_SIZE);
  const maxRows = Math.floor(contentHeight / MIN_CARD_SIZE);

  let best = null;

  for (let cols = 1; cols <= maxCols; cols += 1) {
    for (let rows = 1; rows <= maxRows; rows += 1) {
      const cardSize = Math.min(contentWidth / cols, contentHeight / rows);
      if (cardSize < MIN_CARD_SIZE) continue;
      const cards = cols * rows;
      if (!best || cards > best.cards || (cards === best.cards && cardSize > best.cardSize)) {
        best = { cols, rows, cardSize, cards };
      }
    }
  }

  const cardSize = best ? best.cardSize : MIN_CARD_SIZE;
  const cols = best ? best.cols : 1;
  const rows = best ? best.rows : 1;
  const gapX = cols > 1 ? (contentWidth - cardSize * cols) / (cols - 1) : 0;
  const gapY = rows > 1 ? (contentHeight - cardSize * rows) / (rows - 1) : 0;

  return {
    cols,
    rows,
    cardSize,
    gapX,
    gapY,
    qrSize: cardSize * QR_SCALE,
  };
}

const LAYOUT = computeLayout();

export const CARDS_PER_PAGE = LAYOUT.cols * LAYOUT.rows;

function getCardPosition(indexOnPage, mirrored = false) {
  const col = indexOnPage % LAYOUT.cols;
  const row = Math.floor(indexOnPage / LAYOUT.cols);
  const effectiveCol = mirrored ? LAYOUT.cols - 1 - col : col;
  const x = PAGE.marginLeft + effectiveCol * (LAYOUT.cardSize + LAYOUT.gapX);
  const y = PAGE.marginTop + row * (LAYOUT.cardSize + LAYOUT.gapY);
  return { x, y };
}

export function drawCuttingGrid(pdf) {
  const gridColor = 204;
  pdf.setDrawColor(gridColor);
  pdf.setLineWidth(0.2);

  for (let col = 1; col < LAYOUT.cols; col += 1) {
    const x =
      PAGE.marginLeft + col * LAYOUT.cardSize + (col - 1) * LAYOUT.gapX + LAYOUT.gapX / 2;
    pdf.line(x, PAGE.marginTop, x, PAGE.height - PAGE.marginBottom);
  }

  for (let row = 1; row < LAYOUT.rows; row += 1) {
    const y = PAGE.marginTop + row * LAYOUT.cardSize + (row - 1) * LAYOUT.gapY + LAYOUT.gapY / 2;
    pdf.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);
  }

  pdf.rect(
    PAGE.marginLeft,
    PAGE.marginTop,
    PAGE.width - PAGE.marginLeft - PAGE.marginRight,
    PAGE.height - PAGE.marginTop - PAGE.marginBottom
  );
}

export function drawPageAlignmentMark(doc, mirrored = false) {
  const xStart = mirrored
    ? PAGE.marginLeft + (LAYOUT.cols - 1) * (LAYOUT.cardSize + LAYOUT.gapX)
    : PAGE.marginLeft;
  const yStart = PAGE.marginTop + (LAYOUT.rows - 1) * (LAYOUT.cardSize + LAYOUT.gapY);
  const xEnd = xStart + LAYOUT.cardSize;
  const yEnd = yStart + LAYOUT.cardSize;
  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  const verticalX = mirrored ? xEnd : xStart;
  doc.line(verticalX, yStart, verticalX, yEnd);
  doc.line(xStart, yEnd, xEnd, yEnd);
}

export function addFrontCardToPdf(pdf, { indexOnPage, qrDataUrl }) {
  const { x, y } = getCardPosition(indexOnPage, false);
  const padding = Math.max(2, LAYOUT.cardSize * 0.06);
  const qrX = x + (LAYOUT.cardSize - LAYOUT.qrSize) / 2;
  const qrY = y + padding;

  pdf.addImage(qrDataUrl, "PNG", qrX, qrY, LAYOUT.qrSize, LAYOUT.qrSize);
}

export function addBackCardToPdf(
  pdf,
  { indexOnPage, year, artist, album, title, fields, mirrored = true }
) {
  const { x, y } = getCardPosition(indexOnPage, mirrored);
  const centerX = x + LAYOUT.cardSize / 2;
  const padding = Math.max(2, LAYOUT.cardSize * 0.06);
  const textWidth = LAYOUT.cardSize - padding * 2;
  const yearSize = clamp(LAYOUT.cardSize * 0.38, 10, 18);
  const artistSize = clamp(LAYOUT.cardSize * 0.18, 8, 12);
  const titleSize = clamp(LAYOUT.cardSize * 0.16, 8, 11);
  const lineGap = 0.5;
  const lineHeightFactor = 0.5;
  const maxHeight = LAYOUT.cardSize - padding * 2;
  const minScale = 0.25;

  const showYear = fields?.year ?? true;
  const showArtist = fields?.artist ?? true;
  const showAlbum = fields?.album ?? true;
  const showTitle = fields?.title ?? true;

  let artistLabel = "";
  if (showArtist && showAlbum && artist && album) {
    artistLabel = `${artist}: ${album}`;
  } else if (showArtist && artist) {
    artistLabel = artist;
  } else if (showAlbum && album) {
    artistLabel = album;
  }

  const blocks = [];
  if (showYear && year) {
    blocks.push({ style: "bold", size: yearSize, text: String(year) });
  }
  if (artistLabel) {
    blocks.push({ style: "italic", size: artistSize, text: artistLabel });
  }
  if (showTitle && title) {
    blocks.push({ style: "normal", size: titleSize, text: title });
  }

  if (!blocks.length) return;

  const buildBlocks = (scale) =>
    blocks.map((block) => {
      const size = block.size * scale;
      pdf.setFont("NotoSans", block.style);
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(block.text, textWidth);
      return { ...block, size, lines };
    });

  const computeHeight = (blockData, gap) =>
    blockData.reduce((total, block, index) => {
      const blockHeight = block.lines.length * block.size * lineHeightFactor;
      const spacer = index < blockData.length - 1 ? gap : 0;
      return total + blockHeight + spacer;
    }, 0);

  const getLayoutForScale = (scale) => {
    const blockData = buildBlocks(scale);
    const gap = lineGap * scale;
    const height = computeHeight(blockData, gap);
    return { blockData, gap, height };
  };

  let scale = 1;
  let layout = getLayoutForScale(scale);

  if (layout.height > maxHeight) {
    let low = minScale;
    let high = 1;
    let best = null;

    for (let i = 0; i < 12; i += 1) {
      const mid = (low + high) / 2;
      const candidate = getLayoutForScale(mid);
      if (candidate.height <= maxHeight) {
        best = candidate;
        low = mid;
      } else {
        high = mid;
      }
    }

    if (best) {
      layout = best;
    } else {
      layout = getLayoutForScale(minScale);
    }
  }

  let cursorY = y + padding;

  layout.blockData.forEach((block, index) => {
    pdf.setFont("NotoSans", block.style);
    pdf.setFontSize(block.size);
    const baseline = block.size * lineHeightFactor;
    pdf.text(block.lines, centerX, cursorY + baseline, { align: "center" });
    cursorY += block.lines.length * block.size * lineHeightFactor;
    if (index < layout.blockData.length - 1) {
      cursorY += layout.gap;
    }
  });
}
