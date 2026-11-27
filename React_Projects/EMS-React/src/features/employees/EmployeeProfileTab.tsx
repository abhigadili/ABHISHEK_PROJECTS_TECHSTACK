import { Stack } from '@mui/material';
import { useEmployeeContext } from './useEmployeeContext';
import { PictureManager } from '@/features/profile/PictureManager';
import { QualificationsView } from './QualificationsView';
import { usePermissions } from '@/hooks/usePermissions';

export default function EmployeeProfileTab() {
  const { employee, pictureVersion, bumpPicture } = useEmployeeContext();
  const { isAdmin } = usePermissions();
  return (
    <Stack spacing={2}>
      {isAdmin && (
        <PictureManager
          employeeId={employee.id}
          name={employee.fullName}
          hasPicture={!!employee.profilePictureUrl}
          version={pictureVersion}
          onChanged={bumpPicture}
        />
      )}
      <QualificationsView employeeId={employee.id} />
    </Stack>
  );
}
