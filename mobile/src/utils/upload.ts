const mimeByExt: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
};

const cleanFilename = (uri: string, fallbackName: string) => {
  const withoutQuery = uri.split('?')[0].split('#')[0];
  const filename = withoutQuery.split('/').pop()?.trim();
  return filename || fallbackName;
};

export function getUploadFile(uri: string, fallbackName = 'upload.jpg', mimeType?: string) {
  const rawName = cleanFilename(uri, fallbackName);
  const fallbackExt = fallbackName.includes('.') ? fallbackName.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
  const name = rawName.includes('.') ? rawName : `${rawName}.${fallbackExt}`;
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || fallbackExt : fallbackExt;
  const type = mimeType || mimeByExt[ext] || 'application/octet-stream';
  return { uri, name, type } as any;
}

export function isLocalAssetUri(uri?: string) {
  return !!uri && !/^https?:\/\//i.test(uri);
}
