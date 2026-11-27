import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useRef, useState, type FormEvent } from 'react';

/** CONTROLLED: React state is the single source of truth; every keystroke goes through onChange → setState → re-render. */
function ControlledForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const invalid = email !== '' && !/^\S+@\S+\.\S+$/.test(email);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!invalid) setSubmitted(email);
  };
  return (
    <form onSubmit={onSubmit}>
      <Stack spacing={1}>
        <TextField
          label="Email (controlled)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={invalid}
          helperText={invalid ? 'Not a valid email' : `Live value: "${email}"`}
        />
        <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
          Submit
        </Button>
        {submitted && <Alert severity="success">Submitted {submitted}</Alert>}
      </Stack>
    </form>
  );
}

/** UNCONTROLLED: the DOM keeps the value; we read it on demand through a ref. Less re-rendering, less control. */
function UncontrolledForm() {
  const ref = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(ref.current?.value ?? '');
  };
  return (
    <form onSubmit={onSubmit}>
      <Stack spacing={1}>
        <TextField
          label="Email (uncontrolled)"
          inputRef={ref}
          defaultValue=""
          helperText="React does not know the value until submit"
        />
        <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
          Submit
        </Button>
        {submitted !== null && <Alert severity="success">Read from the DOM: {submitted || '(empty)'}</Alert>}
      </Stack>
    </form>
  );
}

export default function FormsDemo() {
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Real EMS forms use React Hook Form (mostly uncontrolled under the hood, re-rendering only what
        changed) with Zod. These two show the two underlying models. See{' '}
        <code>docs/react-concepts/10-controlled-and-uncontrolled-components.md</code>.
      </Alert>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Controlled (useState)
          </Typography>
          <ControlledForm />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Uncontrolled (useRef)
          </Typography>
          <UncontrolledForm />
        </CardContent>
      </Card>
    </Stack>
  );
}
