import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { ReactNode } from 'react';
import { FormSelect, FormTextField } from '@/components/forms/fields';
import type { EmployeeFormValues } from '@/schemas/employee';

type V = EmployeeFormValues;

/**
 * React's answer to Angular's FormArray: `useFieldArray`. It owns a list of row objects inside the form, gives each row a stable
 * `id` (use it as the React key — NEVER the index, or inputs would keep stale values after a removal), and exposes
 * append / remove / insert / move. Every row field is registered by path (`education.2.degree`), so each row has its own error.
 */
function ArraySection({
  title,
  hint,
  addLabel,
  onAdd,
  children,
  empty,
  error,
}: {
  title: string;
  hint?: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
  empty: boolean;
  error?: string;
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <div>
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          {hint && (
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          )}
        </div>
        <Button size="small" startIcon={<AddIcon />} onClick={onAdd}>
          {addLabel}
        </Button>
      </Stack>
      {empty && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          None added.
        </Typography>
      )}
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  );
}

function Row({
  index,
  label,
  onRemove,
  children,
}: {
  index: number;
  label: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <Paper sx={{ p: 2 }} data-testid={`${label}-row`}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label} #{index + 1}
        </Typography>
        <IconButton size="small" aria-label={`Remove ${label} ${index + 1}`} onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
        {children}
      </Box>
    </Paper>
  );
}

export function EmergencyContactsSection() {
  const {
    control,
    formState: { errors },
  } = useFormContext<V>();
  const { fields, append, remove } = useFieldArray({ control, name: 'emergencyContacts' });
  return (
    <ArraySection
      title="Emergency contacts"
      hint="The first contact is saved to the server; additional ones are stored in this browser."
      addLabel="Add contact"
      onAdd={() => append({ name: '', phone: '', relation: '' })}
      empty={fields.length === 0}
      error={errors.emergencyContacts?.root?.message ?? errors.emergencyContacts?.message}
    >
      {fields.map((f, i) => (
        <Row key={f.id} index={i} label="Contact" onRemove={() => remove(i)}>
          <FormTextField<V> name={`emergencyContacts.${i}.name`} label="Name" />
          <FormTextField<V> name={`emergencyContacts.${i}.phone`} label="Phone" />
          <FormTextField<V> name={`emergencyContacts.${i}.relation`} label="Relation" />
        </Row>
      ))}
    </ArraySection>
  );
}

export function EducationSection() {
  const { control } = useFormContext<V>();
  const { fields, append, remove } = useFieldArray({ control, name: 'education' });
  return (
    <ArraySection
      title="Education history"
      addLabel="Add education"
      onAdd={() => append({ institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '' })}
      empty={fields.length === 0}
    >
      {fields.map((f, i) => (
        <Row key={f.id} index={i} label="Education" onRemove={() => remove(i)}>
          <FormTextField<V> name={`education.${i}.institution`} label="Institution" />
          <FormTextField<V> name={`education.${i}.degree`} label="Degree" />
          <FormTextField<V> name={`education.${i}.fieldOfStudy`} label="Field of study" />
          <FormTextField<V> name={`education.${i}.startYear`} label="Start year" placeholder="2015" />
          <FormTextField<V> name={`education.${i}.endYear`} label="End year" placeholder="2019" />
        </Row>
      ))}
    </ArraySection>
  );
}

export function ExperienceSection() {
  const { control } = useFormContext<V>();
  const { fields, append, remove } = useFieldArray({ control, name: 'experience' });
  return (
    <ArraySection
      title="Previous work experience"
      addLabel="Add experience"
      onAdd={() => append({ company: '', title: '', startDate: '', endDate: '', description: '' })}
      empty={fields.length === 0}
    >
      {fields.map((f, i) => (
        <Row key={f.id} index={i} label="Experience" onRemove={() => remove(i)}>
          <FormTextField<V> name={`experience.${i}.company`} label="Company" />
          <FormTextField<V> name={`experience.${i}.title`} label="Job title" />
          <FormTextField<V> name={`experience.${i}.startDate`} label="Start date" type="date" />
          <FormTextField<V> name={`experience.${i}.endDate`} label="End date" type="date" />
          <FormTextField<V> name={`experience.${i}.description`} label="Description" />
        </Row>
      ))}
    </ArraySection>
  );
}

export function SkillsSection() {
  const { control } = useFormContext<V>();
  const skills = useFieldArray({ control, name: 'skills' });
  const certs = useFieldArray({ control, name: 'certifications' });
  return (
    <Stack spacing={3}>
      <ArraySection
        title="Skills"
        addLabel="Add skill"
        onAdd={() => skills.append({ name: '', level: 'INTERMEDIATE' })}
        empty={skills.fields.length === 0}
      >
        {skills.fields.map((f, i) => (
          <Row key={f.id} index={i} label="Skill" onRemove={() => skills.remove(i)}>
            <FormTextField<V> name={`skills.${i}.name`} label="Skill" />
            <FormSelect<V>
              name={`skills.${i}.level`}
              label="Level"
              options={[
                { value: 'BEGINNER', label: 'Beginner' },
                { value: 'INTERMEDIATE', label: 'Intermediate' },
                { value: 'ADVANCED', label: 'Advanced' },
              ]}
            />
          </Row>
        ))}
      </ArraySection>
      <ArraySection
        title="Certifications"
        addLabel="Add certification"
        onAdd={() => certs.append({ name: '', issuer: '', year: '' })}
        empty={certs.fields.length === 0}
      >
        {certs.fields.map((f, i) => (
          <Row key={f.id} index={i} label="Certification" onRemove={() => certs.remove(i)}>
            <FormTextField<V> name={`certifications.${i}.name`} label="Certification" />
            <FormTextField<V> name={`certifications.${i}.issuer`} label="Issuer" />
            <FormTextField<V> name={`certifications.${i}.year`} label="Year" />
          </Row>
        ))}
      </ArraySection>
    </Stack>
  );
}
