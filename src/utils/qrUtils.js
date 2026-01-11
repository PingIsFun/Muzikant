import QRCode from "qrcode";

export async function generateQrDataUrl(trackId) {
  const payload = `https://open.spotify.com/track/${trackId}`;
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
  });
}
