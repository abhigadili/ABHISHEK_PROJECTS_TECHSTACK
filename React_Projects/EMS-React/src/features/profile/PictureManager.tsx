import { Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { ProfilePicture } from '@/components/common/ProfilePicture';
import { FileUpload, type FileUploadHandle } from '@/components/common/FileUpload';
import { employeeApi } from '@/services/employeeApi';
import { invalidateProfilePicture } from '@/hooks/useProfilePicture';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import { useNotify } from '@/contexts/NotificationContext';
import { errorMessage } from '@/api/errors';
import { useAppDispatch } from '@/app/store/hooks';
import { emsApi } from '@/store/api/emsApi';

/** Upload / replace / remove a profile picture (`employeeId='me'` uses the self-service endpoints). */
export function PictureManager({
  employeeId,
  name,
  hasPicture,
  version,
  onChanged,
}: {
  employeeId: number | 'me';
  name: string;
  hasPicture: boolean;
  version: number;
  onChanged: () => void;
}) {
  const uploadRef = useRef<FileUploadHandle>(null); // imperative handle: parent can open/clear the picker
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  const confirm = useConfirm();
  const dispatch = useAppDispatch();

  const afterChange = () => {
    invalidateProfilePicture(employeeId);
    dispatch(emsApi.util.invalidateTags(['Employee', 'Profile'])); // refresh `profilePictureUrl` flag everywhere
    onChanged();
  };

  const upload = async (file: File) => {
    setBusy(true);
    setProgress(0);
    try {
      await employeeApi.uploadPicture(employeeId, file, setProgress);
      notify.success('Profile picture updated');
      afterChange();
    } catch (e) {
      notify.error(errorMessage(e));
    } finally {
      setBusy(false);
      setProgress(null);
      uploadRef.current?.clear();
    }
  };

  const remove = async () => {
    if (
      !(await confirm({
        title: 'Remove profile picture?',
        message: 'The initials avatar will be shown instead.',
        confirmLabel: 'Remove',
        destructive: true,
      }))
    )
      return;
    try {
      await employeeApi.deletePicture(employeeId);
      notify.success('Profile picture removed');
      afterChange();
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Profile picture
        </Typography>
        <Stack direction="row" spacing={3} alignItems="center">
          <ProfilePicture
            employeeId={employeeId}
            name={name}
            hasPicture={hasPicture}
            size={96}
            version={version}
          />
          <Stack spacing={1}>
            <FileUpload
              ref={uploadRef}
              accept="image/jpeg,image/png,image/webp"
              maxBytes={2 * 1024 * 1024}
              label={hasPicture ? 'Replace picture' : 'Upload picture'}
              onFile={upload}
              progress={progress}
              disabled={busy}
            />
            <Typography variant="caption" color="text.secondary">
              JPEG, PNG or WebP, up to 2 MB.
            </Typography>
            {hasPicture && (
              <Button size="small" color="error" onClick={remove} sx={{ alignSelf: 'flex-start' }}>
                Remove
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
