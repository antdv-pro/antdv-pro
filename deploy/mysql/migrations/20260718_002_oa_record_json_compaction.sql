-- Keep record_json as the compatibility extension object while removing fields
-- that already have authoritative structured columns.

UPDATE oa_dashboard_record
SET record_json = JSON_REMOVE(
  COALESCE(record_json, JSON_OBJECT()),
  '$.id', '$.code', '$.amount', '$.status', '$.date',
  '$.financialYear', '$.financialMonth', '$.createdAt', '$.updatedAt'
)
WHERE record_json IS NOT NULL;

UPDATE finance_receivable_payable
SET record_json = JSON_REMOVE(
  COALESCE(record_json, JSON_OBJECT()),
  '$.id', '$.code', '$.counterparty', '$.billType', '$.amount',
  '$.paidAmount', '$.unpaidAmount', '$.dueDate', '$.date', '$.relatedBill',
  '$.status', '$.approvalStatus', '$.approvalInstanceId', '$.financialYear',
  '$.financialMonth', '$.remark', '$.createdBy', '$.createdAt', '$.updatedAt'
)
WHERE record_json IS NOT NULL;

UPDATE finance_cash_flow
SET record_json = JSON_REMOVE(
  COALESCE(record_json, JSON_OBJECT()),
  '$.id', '$.code', '$.accountName', '$.accountType', '$.openingBalance',
  '$.incomeAmount', '$.expenseAmount', '$.currentBalance', '$.date', '$.flowType',
  '$.relatedBill', '$.handler', '$.status', '$.approvalStatus',
  '$.approvalInstanceId', '$.financialYear', '$.financialMonth', '$.remark',
  '$.createdBy', '$.createdAt', '$.updatedAt'
)
WHERE record_json IS NOT NULL;

UPDATE hr_salary_record
SET record_json = JSON_REMOVE(
  COALESCE(record_json, JSON_OBJECT()),
  '$.id', '$.code', '$.employeeId', '$.employeeName', '$.companyName',
  '$.department', '$.position', '$.financialYear', '$.financialMonth',
  '$.attendanceDays', '$.basicSalary', '$.performanceSalary', '$.grossSalary',
  '$.attendanceSalary', '$.senioritySalary', '$.overtimeAllowance',
  '$.travelAllowance', '$.retroactiveSalary', '$.totalAmount',
  '$.socialSecurityBase', '$.companyPension', '$.companyMedical',
  '$.companyInjury', '$.companyUnemployment', '$.companySocialSecurityTotal',
  '$.personalPension', '$.personalMedical', '$.personalInjury',
  '$.personalUnemployment', '$.personalSocialSecurityTotal', '$.tax',
  '$.netSalary', '$.cashPayment', '$.payStatus', '$.status',
  '$.approvalInstanceId', '$.remark', '$.createdAt', '$.updatedAt'
)
WHERE record_json IS NOT NULL;

UPDATE oa_org_record
SET record_json = JSON_REMOVE(
  COALESCE(record_json, JSON_OBJECT()),
  '$.id', '$.code', '$.orgType', '$.name', '$.parentDepartment',
  '$.status', '$.date', '$.createdAt', '$.updatedAt'
)
WHERE record_json IS NOT NULL;

UPDATE oa_vehicle_record
SET record_json = JSON_REMOVE(
  COALESCE(record_json, JSON_OBJECT()),
  '$.id', '$.code', '$.plateNo', '$.applicant', '$.department',
  '$.totalFee', '$.status', '$.date', '$.financialYear',
  '$.financialMonth', '$.createdAt', '$.updatedAt'
)
WHERE record_json IS NOT NULL;
