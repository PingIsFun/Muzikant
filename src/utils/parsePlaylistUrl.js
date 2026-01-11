export function parsePlaylistUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch && urlMatch[1]) return urlMatch[1];
  const uriMatch = trimmed.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch && uriMatch[1]) return uriMatch[1];
  return null;
}
