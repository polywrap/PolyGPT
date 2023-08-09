export function isFileSystemUri(uri: string): boolean {
  return uri.startsWith("file://");
};
