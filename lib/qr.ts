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
