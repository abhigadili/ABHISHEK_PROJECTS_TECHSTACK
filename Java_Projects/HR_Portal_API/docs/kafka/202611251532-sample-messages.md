# Sample messages (captured from the running system)

Taken from the real topics while testing (ids are random UUIDs; names are test data).

## employee.created
```json
{
  "metadata": {
    "eventId": "d240af18-a7ed-4fcc-8a42-cfcedce9005d",
    "eventType": "employee.created",
    "version": 1,
    "timestamp": "2026-11-25T08:53:38.444720480Z",
    "correlationId": "e0e49462-40e0-4606-a16b-cb9e577cd86d",
    "sourceService": "hr-employee-service"
  },
  "employeeId": "157eaa40-a3e5-44d6-926c-96e6417eeed6",
  "employeeCode": "EMP00001",
  "firstName": "Priya",
  "lastName": "Sharma",
  "workEmail": "priya.sharma@acme.test",
  "departmentId": "881f0ced-284f-487a-8bb3-e632adf6227a",
  "designationId": "d4218733-bba9-4be5-aa90-73a783674d3f",
  "locationId": "c7079255-d271-40f1-a782-a0c0aa2ac35d",
  "jobGradeId": "de200c13-85c3-4715-940b-f1ae201ca3a0",
  "joiningDate": "2025-01-15",
  "status": "ACTIVE"
}
```

## leave.approved
```json
{
  "metadata": {
    "eventId": "4e880992-e8be-4074-8ad8-82eb0e50b95e",
    "eventType": "leave.approved",
    "version": 1,
    "timestamp": "2026-11-25T09:06:59.337639377Z",
    "correlationId": "6b1bea1a-3ee6-4328-82fa-154caa981239",
    "sourceService": "hr-leave-service"
  },
  "employeeId": "bf7f7bd2-148a-4f61-8448-b5f39d99d9f9",
  "applicationId": "e71bf5d4-58f9-432f-94db-14a3ac5637ee",
  "leaveType": "Casual Leave",
  "fromDate": "2026-11-30",
  "toDate": "2026-12-01",
  "days": 2.0,
  "decidedBy": "157eaa40-a3e5-44d6-926c-96e6417eeed6",
  "comment": "enjoy"
}
```

## payroll.processed
```json
{
  "metadata": {
    "eventId": "af6e998e-e9ca-4be5-ad8a-8e871c4a0b7c",
    "eventType": "payroll.processed",
    "version": 1,
    "timestamp": "2026-11-25T09:32:00.106421346Z",
    "correlationId": "bececcb7-4992-47e5-8c3c-b61142a82312",
    "sourceService": "hr-payroll-service"
  },
  "runId": "9c2e137d-3525-4479-b2b7-d8fad8f083e9",
  "month": "2026-11",
  "employeeCount": 2,
  "totalGross": 67499.94,
  "totalNet": 23061.88,
  "lines": [
    {
      "employeeId": "157eaa40-a3e5-44d6-926c-96e6417eeed6",
      "departmentId": "881f0ced-284f-487a-8bb3-e632adf6227a",
      "gross": 38095.2,
      "deductions": 38095.2,
      "net": 0.0
    },
    {
      "employeeId": "bf7f7bd2-148a-4f61-8448-b5f39d99d9f9",
      "departmentId": "881f0ced-284f-487a-8bb3-e632adf6227a",
      "gross": 29404.74,
      "deductions": 6342.86,
      "net": 23061.88
    }
  ]
}
```

## notification.requested
```json
{
  "metadata": {
    "eventId": "4ba66da9-775b-4744-9513-390850b3ac21",
    "eventType": "notification.requested",
    "version": 1,
    "timestamp": "2026-11-25T08:53:39.144693564Z",
    "correlationId": "57b83a90-113b-49a6-87d5-2aecc25f3226",
    "sourceService": "hr-auth-service"
  },
  "employeeId": "bf7f7bd2-148a-4f61-8448-b5f39d99d9f9",
  "recipientEmail": "rahul.verma@acme.test",
  "type": "ACCOUNT_PROVISIONED",
  "templateCode": "ACCOUNT_PROVISIONED",
  "params": {
    "name": "Rahul",
    "username": "emp00002"
  },
  "channels": [
    "IN_APP",
    "EMAIL"
  ],
  "referenceType": "USER",
  "referenceId": "ca11a6d2-7b14-4fa7-b325-4c9f2bd0b6b6",
  "dedupKey": "provision:bf7f7bd2-148a-4f61-8448-b5f39d99d9f9"
}
```
