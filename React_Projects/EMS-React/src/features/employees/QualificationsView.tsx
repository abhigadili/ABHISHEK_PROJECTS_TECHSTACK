import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { qualificationsStore } from '@/services/qualificationsStore';
import { formatDate } from '@/utils/format';

/** Read-only education / experience / skills — the data comes from this browser's storage (no backend endpoint exists). */
export function QualificationsView({ employeeId, version = 0 }: { employeeId: number; version?: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is an explicit invalidation key
  const q = useMemo(() => qualificationsStore.load(employeeId), [employeeId, version]);
  const empty =
    !q.education.length &&
    !q.experience.length &&
    !q.skills.length &&
    !q.certifications.length &&
    !q.extraEmergencyContacts.length;
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Education, experience & skills
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          The backend has no endpoint for these sections yet, so they are stored in{' '}
          <strong>this browser only</strong> (see docs/backend-api-integration.md → Missing APIs).
        </Alert>
        {empty ? (
          <Typography color="text.secondary">
            Nothing recorded in this browser. Use “Edit” to add education, experience and skills.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {q.education.length > 0 && (
              <Box>
                <Typography fontWeight={700}>Education</Typography>
                {q.education.map((e, i) => (
                  <Typography key={i} variant="body2">
                    {e.degree}
                    {e.fieldOfStudy ? `, ${e.fieldOfStudy}` : ''} — {e.institution} ({e.startYear}–
                    {e.endYear ?? 'present'})
                  </Typography>
                ))}
              </Box>
            )}
            {q.experience.length > 0 && (
              <Box>
                <Typography fontWeight={700}>Previous experience</Typography>
                {q.experience.map((e, i) => (
                  <Typography key={i} variant="body2">
                    {e.title} — {e.company} ({formatDate(e.startDate)} –{' '}
                    {e.endDate ? formatDate(e.endDate) : 'present'})
                  </Typography>
                ))}
              </Box>
            )}
            {q.skills.length > 0 && (
              <Box>
                <Typography fontWeight={700}>Skills</Typography>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {q.skills.map((s, i) => (
                    <Chip key={i} label={`${s.name} · ${s.level.toLowerCase()}`} size="small" />
                  ))}
                </Stack>
              </Box>
            )}
            {q.certifications.length > 0 && (
              <Box>
                <Typography fontWeight={700}>Certifications</Typography>
                {q.certifications.map((c, i) => (
                  <Typography key={i} variant="body2">
                    {c.name} — {c.issuer} ({c.year})
                  </Typography>
                ))}
              </Box>
            )}
            {q.extraEmergencyContacts.length > 0 && (
              <Box>
                <Typography fontWeight={700}>Additional emergency contacts</Typography>
                {q.extraEmergencyContacts.map((c, i) => (
                  <Typography key={i} variant="body2">
                    {c.name} ({c.relation}) · {c.phone}
                  </Typography>
                ))}
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
