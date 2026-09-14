/** Middle-truncate a wallet address: first 8 + last 6 chars (short values untouched). */
export const maskAddress = (address: string | undefined | null, head = 8, tail = 6): string => {
  const a = String(address ?? "");
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
};

export default maskAddress;
