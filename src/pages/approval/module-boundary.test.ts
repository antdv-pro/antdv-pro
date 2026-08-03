import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('oA module component boundaries', () => {
  it('uses dedicated route entries for each OA business category', () => {
    const routes = fs.readFileSync(path.resolve('src/router/dynamic-routes.ts'), 'utf8')
    expect(routes).toContain('~/pages/approval/oa/dashboard.vue')
    expect(routes).toContain('~/pages/approval/oa/receivable-payable.vue')
    expect(routes).toContain('~/pages/approval/oa/cash.vue')
    expect(routes).toContain('~/pages/approval/oa/salary.vue')
    expect(routes).toContain('redirect: \'/system/organization\'')
    expect(routes).not.toContain('~/pages/approval/oa/organization.vue')
    expect(routes).not.toContain('component: () => import(\'~/pages/approval/oa-module.vue\')')
  })

  it('keeps large business views in dedicated components', () => {
    const source = fs.readFileSync(path.resolve('src/pages/approval/oa-module.vue'), 'utf8')
    expect(source).toContain('import OrgManagementView from \'./components/org-management-view.vue\'')
    expect(source).toContain('import CashBalanceView from \'./components/cash-balance-view.vue\'')
    expect(source).toContain('import OaBusinessTable from \'./components/oa-business-table.vue\'')
    expect(source).toContain('import OaDashboardView from \'./components/oa-dashboard-view.vue\'')
    expect(source).toContain('import FinanceWorkflowView from \'./components/finance-workflow-view.vue\'')
    expect(source).toContain('orgRows.value.filter(isSalaryEligibleEmployee)')
    expect(source).toContain('[\'dashboard\', \'receivable\', \'cash\', \'salary\', \'vehicle\'] as ModuleKey[]')
    expect(source).not.toContain('[\'dashboard\', \'receivable\', \'cash\', \'salary\', \'org\', \'vehicle\'] as ModuleKey[]')
    expect(source).not.toContain('<a-card title="组织树"')
    expect(source).not.toContain('<a-card title="现金余额管理"')
    expect(source).not.toContain('<template v-for="column in currentColumns"')
    expect(source).not.toContain('<a-card title="快速入口"')
    expect(source).not.toContain('<section class="finance-workflow"')
    expect(source.split('\n').length).toBeLessThanOrEqual(4700)
  })

  it('uses automatic salary generation and one direct-entry surface', () => {
    const source = fs.readFileSync(path.resolve('src/pages/approval/oa-module.vue'), 'utf8')
    const table = fs.readFileSync(path.resolve('src/pages/approval/components/oa-business-table.vue'), 'utf8')

    expect(source).toContain('generateSalaryPeriodApi(period)')
    expect(source).toContain('在职人员工资表按月自动生成')
    expect(source).not.toContain('导入工资表')
    expect(source).not.toContain('生成本月工资表')
    expect(source).not.toContain('salaryBatchOpen')
    expect(table).toContain('[\'actualAttendanceDays\', \'subsidy\', \'overtimePay\']')
  })

  it('keeps office vehicle summaries and period expenses in separate tabs', () => {
    const source = fs.readFileSync(path.resolve('src/pages/approval/office-vehicle/index.vue'), 'utf8')
    expect(source).toContain('<a-tab-pane key="vehicles" tab="车辆汇总">')
    expect(source).toContain('<a-tab-pane key="expenses" tab="本月费用">')
    expect(source).toContain('办公用车汇总表')
    expect(source).not.toContain('dataIndex: \'expenseOverview\'')
    expect(source).toContain(':data-source="filteredExpenseRows"')
    expect(source).toContain('exportOfficeVehicleExpensesApi(buildExpenseQuery())')
    expect(source).toContain('window.open(url.href, \'_blank\', \'noopener,noreferrer\')')
    expect(source).not.toContain('message.info(record.attachmentName)')
    expect(source).not.toContain('<span>{{ record.brandModel }} · {{ record.vehicleType || \'未分类\' }}</span>')
    expect(source).not.toContain('<strong>{{ record.departmentName || \'-\' }}</strong><span>')
    expect(source).toContain('到期日期：{{ record.nearestLicense.expiryDate }}')
    expect(source).toContain('到期日期：{{ record.nearestInsurance.endDate }}')
    expect(source).not.toContain('dataIndex: \'reminderOverview\'')
    expect(source).not.toContain('tab="到期提醒"')
    expect(source).not.toContain('label="提醒类型"')
  })
})
