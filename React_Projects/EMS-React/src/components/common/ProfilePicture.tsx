import { memo } from 'react';
import { Avatar, type AvatarProps } from '@mui/material';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { initials } from '@/utils/format';

interface Props extends Omit<AvatarProps, 'src' | 'children'> {
  employeeId: number | 'me' | null | undefined;
  name: string;
  hasPicture?: boolean;
  size?: number;
  version?: number;
}

/** Authenticated picture with an initials fallback. `memo`: props are primitives, so list rows skip re-renders. */
export const ProfilePicture = memo(function ProfilePicture({
  employeeId,
  name,
  hasPicture = true,
  size = 40,
  version = 0,
  sx,
  ...rest
}: Props) {
  const { src } = useProfilePicture(employeeId, hasPicture, version);
  return (
    <Avatar
      src={src ?? undefined}
      alt={src ? name : ''}
      sx={{ width: size, height: size, fontSize: size * 0.4, bgcolor: 'primary.main', ...sx }}
      {...rest}
    >
      {initials(name)}
    </Avatar>
  );
});
