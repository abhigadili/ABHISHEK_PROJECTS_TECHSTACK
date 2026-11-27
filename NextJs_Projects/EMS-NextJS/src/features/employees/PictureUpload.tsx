'use client';
import { ActionForm, SubmitButton } from '@/components/forms/ActionForm';
import { FileUpload } from '@/components/forms/FileUpload';
import { uploadPictureAction } from '@/actions/employees';

/** Multipart Server Action: the browser posts the file to the action, which validates type/size then forwards it to Express. */
export function PictureUpload({ employeeId }: { employeeId: number }) {
  return (
    <ActionForm action={uploadPictureAction} className="space-y-3">
      <input type="hidden" name="id" value={employeeId} />
      <FileUpload name="file" accept="image/jpeg,image/png,image/webp" maxBytes={2 * 1024 * 1024} label="Choose picture (JPEG/PNG/WebP, max 2 MB)" />
      <SubmitButton pendingLabel="Uploading…">Upload picture</SubmitButton>
    </ActionForm>
  );
}
