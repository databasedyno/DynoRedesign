/**
 * fileMagicCheck — Verify uploaded files by their magic bytes (spec §10).
 *
 * WHY: multer's `fileFilter` only sees the browser-provided filename and MIME,
 * both of which are attacker-controlled. A malicious upload can rename
 * `payload.exe` to `payload.pdf` and slip past our extension blocklist. Once
 * multer has written the file to disk we open the first N bytes and compare
 * to a small table of known-executable / executable-adjacent signatures.
 * If any of them match, we refuse and delete the file.
 *
 * Approach: KEEP the check narrow and additive — we only REJECT files whose
 * magic bytes match a known-dangerous format (PE, ELF, Mach-O, class file,
 * shell script shebang). We DO NOT enforce that the declared MIME matches
 * the actual magic — merchants ship long-tail formats and the extension
 * blocklist stays the primary guard. This is a defensive net, not a
 * whitelist.
 */
import fs from "fs";
import { apiLogger } from "../utils/loggers";

// (label, offset, magic-bytes) — offset is 0 unless the signature sits deeper.
const DANGEROUS_SIGS: Array<{ label: string; offset: number; bytes: number[] }> = [
  // Windows PE / DOS MZ (.exe, .dll, .sys)
  { label: "Windows executable (PE)", offset: 0, bytes: [0x4d, 0x5a] },
  // Linux ELF (.so, .elf, statically-linked binaries)
  { label: "Linux ELF binary", offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46] },
  // Mach-O 32-bit big-endian
  { label: "macOS Mach-O binary", offset: 0, bytes: [0xfe, 0xed, 0xfa, 0xce] },
  // Mach-O 32-bit little-endian
  { label: "macOS Mach-O binary", offset: 0, bytes: [0xce, 0xfa, 0xed, 0xfe] },
  // Mach-O 64-bit big-endian
  { label: "macOS Mach-O binary", offset: 0, bytes: [0xfe, 0xed, 0xfa, 0xcf] },
  // Mach-O 64-bit little-endian
  { label: "macOS Mach-O binary", offset: 0, bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  // Java class file
  { label: "Java class file", offset: 0, bytes: [0xca, 0xfe, 0xba, 0xbe] },
  // Unix shell script shebang `#!` — could be shell / python / any interpreter
  { label: "Unix shell script (shebang)", offset: 0, bytes: [0x23, 0x21] },
  // Windows shortcut .lnk — often used in phishing chains
  { label: "Windows shortcut (.lnk)", offset: 0, bytes: [0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00] },
];

/**
 * Read the first 16 bytes of `filepath` and return the label of any matched
 * dangerous signature, or null if clean. Does NOT throw on I/O errors —
 * a failed read is treated as "unknown, allow" so an unrelated fs blip
 * doesn't lock out uploads. If you want strict fail-closed, wrap the caller.
 */
export async function magicSniff(filepath: string): Promise<string | null> {
  try {
    const buf = Buffer.alloc(16);
    const fh = await fs.promises.open(filepath, "r");
    try {
      const { bytesRead } = await fh.read(buf, 0, 16, 0);
      const head = buf.subarray(0, bytesRead);
      for (const sig of DANGEROUS_SIGS) {
        if (head.length < sig.offset + sig.bytes.length) continue;
        let ok = true;
        for (let i = 0; i < sig.bytes.length; i++) {
          if (head[sig.offset + i] !== sig.bytes[i]) {
            ok = false;
            break;
          }
        }
        if (ok) return sig.label;
      }
      return null;
    } finally {
      await fh.close();
    }
  } catch (e: any) {
    apiLogger.warn(`[magicSniff] read failed for ${filepath}: ${e?.message || e}`);
    return null;
  }
}
