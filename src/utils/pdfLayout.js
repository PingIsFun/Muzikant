export const PAGE = {
  width: 210,
  height: 297,
  margin: 10,
  cardWidth: 47.5,
  cardHeight: 92.33333333333333,
  cols: 4,
  rows: 3,
  qrSize: 38,
};

export const CARDS_PER_PAGE = PAGE.cols * PAGE.rows;

function getGaps() {
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const contentHeight = PAGE.height - PAGE.margin * 2;
  const gapX = (contentWidth - PAGE.cardWidth * PAGE.cols) / (PAGE.cols - 1);
  const gapY = (contentHeight - PAGE.cardHeight * PAGE.rows) / (PAGE.rows - 1);
  return { gapX, gapY };
}

function getCardPosition(indexOnPage, mirrored = false) {
  const col = indexOnPage % PAGE.cols;
  const row = Math.floor(indexOnPage / PAGE.cols);
  const effectiveCol = mirrored ? PAGE.cols - 1 - col : col;
  const { gapX, gapY } = getGaps();
  const x = PAGE.margin + effectiveCol * (PAGE.cardWidth + gapX);
  const y = PAGE.margin + row * (PAGE.cardHeight + gapY);
  return { x, y };
}

export function drawCuttingGrid(pdf) {
  const { gapX, gapY } = getGaps();
  const gridColor = 204;
  pdf.setDrawColor(gridColor);
  pdf.setLineWidth(0.2);

  for (let col = 1; col < PAGE.cols; col += 1) {
    const x = PAGE.margin + col * PAGE.cardWidth + (col - 1) * gapX + gapX / 2;
    pdf.line(x, PAGE.margin, x, PAGE.height - PAGE.margin);
  }

  for (let row = 1; row < PAGE.rows; row += 1) {
    const y = PAGE.margin + row * PAGE.cardHeight + (row - 1) * gapY + gapY / 2;
    pdf.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
  }

  pdf.rect(PAGE.margin, PAGE.margin, PAGE.width - PAGE.margin * 2, PAGE.height - PAGE.margin * 2);
}

export function drawPageAlignmentMark(doc, mirrored = false) {
  const size = 8;
  const offset = 5;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0);

  if (!mirrored) {
    const x = offset;
    const y = PAGE.height - offset;
    doc.line(x, y, x, y - size);
    doc.line(x, y, x + size, y);
  } else {
    const x = PAGE.width - offset;
    const y = PAGE.height - offset;
    doc.line(x, y, x, y - size);
    doc.line(x, y, x - size, y);
  }
}

export function addFrontCardToPdf(pdf, { indexOnPage, qrDataUrl, footerText }) {
  const { x, y } = getCardPosition(indexOnPage, false);
  const qrX = x + (PAGE.cardWidth - PAGE.qrSize) / 2;
  const qrY = y + (PAGE.cardHeight - PAGE.qrSize) / 2 - 6;

  pdf.addImage(qrDataUrl, "PNG", qrX, qrY, PAGE.qrSize, PAGE.qrSize);

  if (footerText) {
    pdf.setFont("NotoSans", "normal");
    pdf.setFontSize(8);
    pdf.text(footerText, x + PAGE.cardWidth / 2, y + PAGE.cardHeight - 6, { align: "center" });
  }
}

export function addBackCardToPdf(pdf, { indexOnPage, year, artist, title }) {
  const { x, y } = getCardPosition(indexOnPage, true);
  const centerX = x + PAGE.cardWidth / 2;
  const padding = 6;
  const textWidth = PAGE.cardWidth - padding * 2;
  const topY = y + padding + 2;

  pdf.setFont("NotoSans", "bold");
  pdf.setFontSize(16);
  pdf.text(String(year), centerX, topY + 6, { align: "center" });

  pdf.setFont("NotoSans", "normal");
  pdf.setFontSize(10);
  const artistLines = pdf.splitTextToSize(artist, textWidth);
  pdf.text(artistLines, centerX, topY + 18, { align: "center" });

  pdf.setFont("NotoSans", "normal");
  pdf.setFontSize(9);
  const titleLines = pdf.splitTextToSize(title, textWidth);
  pdf.text(titleLines, centerX, topY + 32, { align: "center" });
}
