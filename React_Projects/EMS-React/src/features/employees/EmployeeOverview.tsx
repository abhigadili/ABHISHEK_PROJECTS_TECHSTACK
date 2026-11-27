import { Box, Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useEmployeeContext } from './useEmployeeContext';
import { formatDate, formatMoney, humanize } from '@/utils/format';
import { Can } from '@/components/common/Can';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography>{children || '—'}</Typography>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function EmployeeOverview() {
  const { employee: e } = useEmployeeContext();
  const addr = e.address;
  return (
    <Stack spacing={2}>
      <Section title="Work">
        <Field label="Department">{e.department?.name}</Field>
        <Field label="Designation">{e.designation?.name}</Field>
        <Field label="Job title">{e.jobTitle}</Field>
        <Field label="Team">{e.team?.name}</Field>
        <Field label="Manager">{e.manager?.name}</Field>
        <Field label="Employment type">{humanize(e.employmentType)}</Field>
        <Field label="Work location">{e.workLocation}</Field>
        <Field label="Joined">{formatDate(e.joiningDate)}</Field>
        <Field label="Probation ends">{formatDate(e.probationEndDate)}</Field>
      </Section>
      <Section title="Contact">
        <Field label="Work email">{e.workEmail}</Field>
        <Field label="Personal email">{e.personalEmail}</Field>
        <Field label="Phone">{e.phone}</Field>
        <Field label="Date of birth">{e.dateOfBirth ? formatDate(e.dateOfBirth) : ''}</Field>
        <Field label="Address">
          {[addr?.line, addr?.city, addr?.state, addr?.postalCode, addr?.country].filter(Boolean).join(', ')}
        </Field>
      </Section>
      <Section title="Emergency contact">
        <Field label="Name">{e.emergencyContact?.name}</Field>
        <Field label="Phone">{e.emergencyContact?.phone}</Field>
        <Field label="Relation">{e.emergencyContact?.relation}</Field>
      </Section>
      <Can permission="employee:view-compensation">
        {e.compensation && (
          <Section title="Compensation">
            <Field label="Salary">{formatMoney(e.compensation.salary, e.compensation.salaryCurrency)}</Field>
            <Field label="Bonus target">
              {formatMoney(e.compensation.bonusTarget, e.compensation.salaryCurrency)}
            </Field>
            <Field label="Login role">{e.account ? humanize(e.account.role) : 'No login'}</Field>
          </Section>
        )}
      </Can>
    </Stack>
  );
}
