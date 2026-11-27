import { leaveApi } from '@/services/leaveApi';
import { saveBlob } from '@/services/reportApi';

/** File download: fetch the bytes with the Bearer token (Axios), then hand the Blob to the browser as a Save-As. */
export async function downloadDocument(requestId: number, docId: number, fileName: string) {
  saveBlob(await leaveApi.downloadDocument(requestId, docId), fileName);
}
