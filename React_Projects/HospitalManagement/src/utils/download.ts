/** Triggers a browser download for a Blob and releases the object URL afterwards. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveText(text: string, fileName: string, mime = 'text/plain') {
  saveBlob(new Blob([text], { type: mime }), fileName);
}
