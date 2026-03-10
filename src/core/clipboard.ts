import clipboard from 'clipboardy';

export async function readClipboard(): Promise<string> {
  return clipboard.read();
}
