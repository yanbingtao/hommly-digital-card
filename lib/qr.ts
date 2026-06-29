import QRCode from 'qrcode';

export async function generateQRCodeDataURL(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 256,
    margin: 2,
    color: {
      dark: '#2d2d2d',
      light: '#ffffff',
    },
  });
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
