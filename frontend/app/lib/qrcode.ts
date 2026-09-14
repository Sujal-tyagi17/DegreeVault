/**
 * QR Code generation utilities for DegreeVault certificate verification.
 */

import QRCode from "qrcode";

/**
 * Generate a verification URL for a given certificate ID.
 * Uses the current origin in the browser, or a fallback for SSR.
 */
export function getVerificationUrl(certId: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  return `${origin}/verify?cert=${encodeURIComponent(certId)}`;
}

/**
 * Generate a QR code as a data URL (base64 PNG image).
 * Can be used in <img src={dataUrl} /> or for download.
 */
export async function generateQRCodeDataUrl(
  certId: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  const url = getVerificationUrl(certId);
  const dataUrl = await QRCode.toDataURL(url, {
    width: options?.width || 300,
    margin: options?.margin || 2,
    color: {
      dark: "#1e1b4b", // deep indigo
      light: "#ffffff",
    },
    errorCorrectionLevel: "H", // high error correction for reliability
  });
  return dataUrl;
}

/**
 * Trigger a download of the QR code as a PNG file.
 */
export function downloadQRCode(dataUrl: string, certId: string): void {
  const link = document.createElement("a");
  link.download = `DegreeVault-QR-${certId}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
