// Shared by the media library and lesson file uploads. No "server-only": it is data.
// What the first bytes may be for each declared type. Text has no signature.
export const sniffedTypes: Record<string, string[] | null> = {
  "image/jpeg": ["image/jpeg"],
  "image/png": ["image/png", "image/apng"],
  "image/webp": ["image/webp"],
  "image/avif": ["image/avif"],
  "image/gif": ["image/gif"],
  "application/pdf": ["application/pdf"],
  "application/msword": ["application/x-cfb"],
  "application/vnd.ms-excel": ["application/x-cfb"],
  "application/vnd.ms-powerpoint": ["application/x-cfb"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
  ],
  "video/mp4": ["video/mp4", "video/x-m4v"],
  "video/webm": ["video/webm"],
  "video/quicktime": ["video/quicktime"],
  "application/zip": ["application/zip"],
  "application/x-zip-compressed": ["application/zip"],
  "text/plain": null,
  "text/csv": null,
};
