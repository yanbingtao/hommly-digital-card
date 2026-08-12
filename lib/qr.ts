import QRCode from 'qrcode';

export const STANDARD_QR_WIDTH = 256;
export const COMPACT_QR_WIDTH = 96;

export async function generateQRCodeDataURL(
  url: string,
  width: number = STANDARD_QR_WIDTH
): Promise<string> {
  return QRCode.toDataURL(url, {
    width,
    margin: 2,
    color: {
      dark: '#2d2d2d',
      light: '#ffffff',
    },
  });
}

export async function generateCompactQRCodeDataURL(url: string): Promise<string> {
  return generateQRCodeDataURL(url, COMPACT_QR_WIDTH);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function orderQrFilename(orderNumber: string, suffix: 'edit_page_qr' | 'view_page_qr'): string {
  const safeOrderId = orderNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${safeOrderId}_${suffix}.png`;
}

export function formatGiftNumberForFilename(recipientNumber: number): string {
  if (recipientNumber >= 100) {
    return String(recipientNumber);
  }
  return String(recipientNumber).padStart(2, '0');
}

export function individualRecipientViewQrFilename(
  orderNumber: string,
  recipientNumber: number
): string {
  const safeOrderId = orderNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${safeOrderId}_gift_${formatGiftNumberForFilename(recipientNumber)}_view_qr.png`;
}
