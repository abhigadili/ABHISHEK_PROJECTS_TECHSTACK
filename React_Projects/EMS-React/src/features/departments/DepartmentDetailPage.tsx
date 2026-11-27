import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useGetDepartmentQuery, useListEmployeesQuery } from '@/store/api/emsApi';
import { useApi } from '@/hooks/useApi';
import { departmentApi } from '@/services/departmentApi';
import { useDepartmentFilter } from '@/hooks/useDepartments';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { EmployeeCard } from '@/components/common/EmployeeCard';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Can } from '@/components/common/Can';
import { errorMessage } from '@/api/errors';
import { formatDate } from '@/utils/format';

export default function DepartmentDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [, setDeptFilter] = useDepartmentFilter();
  const { data: dept, isLoading, isError, error, refetch } = useGetDepartmentQuery(id);
  const employees = useListEmployeesQuery({ departmentId: id, limit: 100, status: 'ACTIVE' });
  const teams = useApi((_signal, deptId: number) => departmentApi.teams(deptId), {
    immediate: true,
    args: [id],
  });

  if (isLoading) return <Loading page />;
  if (isError || !dept) return <ErrorMessage message={errorMessage(error)} onRetry={refetch} />;

  const filterEmployees = () => {
    setDeptFilter(id);
    navigate(`/employees?departmentId=${id}`);
  }; // department filter kept across screens

  return (
    <>
      <PageHeader
        title={dept.name}
        subtitle={`${dept.code} · created ${formatDate(dept.createdAt)}`}
        actions={
          <>
            <Button variant="outlined" onClick={filterEmployees}>
              Open in employee list
            </Button>
            <Button
              component={RouterLink}
              variant="outlined"
              to="/organization"
              onClick={() => setDeptFilter(id)}
            >
              Org chart
            </Button>
            <Can permission="department:manage">
              <Button component={RouterLink} to={`/departments/${id}/edit`} variant="contained">
                Edit
              </Button>
            </Can>
          </>
        }
      />
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <StatusBadge status={dept.isActive ? 'ACTIVE' : 'INACTIVE'} />
              <Chip size="small" label={`${dept.headcount} active staff`} />
            </Stack>
            <Typography>{dept.description || 'No description.'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Head:{' '}
              {dept.headEmployeeId ? (
                <RouterLink to={`/employees/${dept.headEmployeeId}`}>{dept.headName}</RouterLink>
              ) : (
                'not assigned'
              )}
            </Typography>
            {teams.data && teams.data.length > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Teams: {teams.data.map((t) => `${t.name} (${t.memberCount})`).join(', ')}
              </Typography>
            )}
          </CardContent>
        </Card>
        <Typography variant="h6">Employees</Typography>
        {employees.isLoading ? (
          <Loading />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' },
            }}
          >
            {(employees.data?.items ?? []).map((e) => (
              <EmployeeCard key={e.id} employee={e} onSelect={(eid) => navigate(`/employees/${eid}`)} />
            ))}
            {employees.data?.items.length === 0 && (
              <Typography color="text.secondary">No active employees in this department.</Typography>
            )}
          </Box>
        )}
      </Stack>
    </>
  );
}
