import { chmod } from "node:fs/promises";

import QRCode from "qrcode";

export async function writeQrCode(path: string, url: string): Promise<void> {
  await QRCode.toFile(path, url, {
    errorCorrectionLevel: "M",
    margin: 3,
    width: 480,
  });
  await chmod(path, 0o600);
}
