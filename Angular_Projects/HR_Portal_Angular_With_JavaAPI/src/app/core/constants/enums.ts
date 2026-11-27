/** Enum values the OpenAPI schema leaves as plain strings (taken from the backend's Java enums) - used as dropdown options. */
const opt = (a: string[]) => a.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));
export const EMPLOYEE_STATUS = opt(['ACTIVE', 'INACTIVE', 'ON_NOTICE', 'RESIGNED', 'TERMINATED']);
export const PROJECT_STATUS = opt(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);
export const USER_STATUS = opt(['ACTIVE', 'INACTIVE']);
export const BILLING_MODEL = opt(['TIME_AND_MATERIAL', 'FIXED_PRICE', 'RETAINER', 'NON_BILLABLE']);
export const GENDER = opt(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']);
export const EMPLOYMENT_TYPE = opt(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);
export const MARITAL = opt(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']);
export const CYCLE_TYPE = opt(['ANNUAL', 'HALF_YEARLY', 'QUARTERLY', 'PROBATION']);
export const GOAL_TYPE = opt(['GOAL', 'OKR']);
export const HOLIDAY_TYPE = opt(['MANDATORY', 'OPTIONAL', 'RESTRICTED']);
export const WORK_MODE = opt(['OFFICE', 'WFH']);
export const CUSTOMER_STATUS = opt(['ACTIVE', 'INACTIVE']);
/** Field-name based defaults applied by SchemaField when the schema has no enum. Keyed by "<operationId>:<field>" or just "<field>" for universally-typed names. */
export const FIELD_OPTIONS: Record<string, { value: string; label: string }[]> = {
  'project.status:status': PROJECT_STATUS, 'employee.status:status': EMPLOYEE_STATUS, 'auth.status:status': USER_STATUS,
  billingModel: BILLING_MODEL, gender: GENDER, employmentType: EMPLOYMENT_TYPE, maritalStatus: MARITAL,
};
