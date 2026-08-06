import { describe, expect, it, vi } from 'vitest'

import { oaModuleStore, updateApprovalRecord } from './oa-module-store'

vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false }))

describe('oA module memory store', () => {
  it('returns an isolated clone of the seeded state', async () => {
    const first = await oaModuleStore.getState()
    expect(Object.keys(first.modules)).toEqual(['dashboard', 'receivable', 'cash', 'salary', 'org', 'vehicle'])
    expect(first.modules.dashboard.length).toBeGreaterThan(0)
    first.modules.dashboard[0].status = '被外部修改'
    const second = await oaModuleStore.getState()
    expect(second.modules.dashboard[0].status).not.toBe('被外部修改')
  })

  it('normalizes partial replacement payloads and strips invalid collections', async () => {
    const replaced = await oaModuleStore.replaceState({
      modules: { dashboard: [{ id: 'custom', amount: 12 }], cash: 'invalid' as any } as any,
      cashBalanceRecords: 'invalid' as any,
    })
    expect(replaced).toEqual({
      modules: { dashboard: [{ id: 'custom', amount: 12 }], receivable: [], cash: [], salary: [], org: [], vehicle: [] },
      cashBalanceRecords: [],
      revision: expect.any(Number),
    })
    replaced.modules.dashboard[0].amount = 99
    expect((await oaModuleStore.getState()).modules.dashboard[0].amount).toBe(12)
  })

  it('replaces one partition without overwriting other modules and rejects stale revisions', async () => {
    const initial = await oaModuleStore.replaceState({
      modules: {
        dashboard: [{ id: 'dashboard-keep' }],
        org: [{ id: 'org-old' }],
      } as any,
      cashBalanceRecords: [{ id: 'balance-keep' }],
    })
    const saved = await oaModuleStore.replacePartition('org', [{ id: 'org-new' }], initial.revision!)
    expect(saved.modules.dashboard).toEqual([{ id: 'dashboard-keep' }])
    expect(saved.modules.org).toEqual([{ id: 'org-new' }])
    expect(saved.cashBalanceRecords).toEqual([{ id: 'balance-keep' }])
    expect(saved.revision).toBe(initial.revision! + 1)
    await expect(oaModuleStore.replacePartition('org', [], initial.revision!)).rejects.toThrow('已被其他操作更新')
  })

  it('protects locked salary rows from edits and deletion', async () => {
    const initial = await oaModuleStore.replaceState({
      modules: {
        salary: [{ id: 'salary-locked', employeeName: '已锁定员工', status: '已锁定', netSalary: 9200 }],
      } as any,
    })

    await expect(oaModuleStore.replacePartition('salary', [{ id: 'salary-locked', employeeName: '已锁定员工', status: '已锁定', netSalary: 9300 }], initial.revision!)).rejects.toThrow('已锁定，不能修改')
    await expect(oaModuleStore.replacePartition('salary', [], initial.revision!)).rejects.toThrow('已锁定，不能删除')
    await expect(oaModuleStore.replacePartition('salary', [{ id: 'salary-locked', employeeName: '已锁定员工', status: '草稿', netSalary: 9200 }], initial.revision!)).rejects.toThrow('已锁定，不能回退状态')
  })

  it('creates one payable for an approved finance-related approval', async () => {
    await oaModuleStore.replaceState({})
    const instance = {
      id: 'approval-fee-1',
      code: 'APV-1',
      businessType: 'transport_fee',
      businessId: 'fee-1',
      businessNo: 'FEE-1',
      title: '车辆保险规费',
      applicantName: '申请人',
      amount: 3600,
      submittedAt: '2026-07-16T10:00:00.000Z',
      approvedAt: '2026-07-16T11:00:00.000Z',
      formSnapshot: { supplierName: '保险公司', dueDate: '2026-07-20' },
    } as any

    await updateApprovalRecord(instance, '已确认')
    await updateApprovalRecord(instance, '已确认')

    const rows = (await oaModuleStore.getState()).modules.receivable
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      billType: '应付',
      counterparty: '保险公司',
      amount: 3600,
      paidAmount: 0,
      unpaidAmount: 3600,
      status: '未付',
      sourceApprovalId: 'approval-fee-1',
      sourceBusinessType: 'transport_fee',
      relatedBill: 'FEE-1',
    })
  })

  it('updates the receivable module row with approved payment details', async () => {
    await oaModuleStore.replaceState({})
    const instance = {
      id: 'approval-payment-1',
      code: '202607210001',
      businessType: 'payment',
      businessId: 'WECOM-202607210001',
      businessNo: '202607210001',
      title: '供应商付款',
      applicantName: '申请人',
      amount: 10252,
      submittedAt: '2026-07-21T04:46:00.000Z',
      formSnapshot: {
        counterparty: '大柴旦皖北蔬菜卤肉综合店',
        paymentDate: '2026-07-21',
        paymentMethod: '电汇',
        remark: '发票已开',
        attachmentFiles: [{ fileId: 'file-1', name: '附件1' }],
      },
    } as any

    await updateApprovalRecord(instance, '已确认')
    await updateApprovalRecord(instance, '已确认')

    expect((await oaModuleStore.getState()).modules.receivable).toEqual([
      expect.objectContaining({
        id: 'WECOM-202607210001',
        counterparty: '大柴旦皖北蔬菜卤肉综合店',
        billType: '应付',
        amount: 10252,
        unpaidAmount: 10252,
        dueDate: '2026-07-21',
        date: '2026-07-21',
        status: '未付',
        paymentMethod: '电汇',
        remark: '发票已开',
      }),
    ])
  })

  it('does not create a payable before approval and voids a reverted payable', async () => {
    await oaModuleStore.replaceState({})
    const instance = {
      id: 'approval-expense-1',
      code: 'APV-2',
      businessType: 'expense',
      businessId: 'expense-1',
      businessNo: 'EXP-1',
      title: '费用报销',
      applicantName: '员工',
      amount: 500,
      submittedAt: '2026-07-16T10:00:00.000Z',
      formSnapshot: {},
    } as any

    await updateApprovalRecord(instance, '审批中')
    expect((await oaModuleStore.getState()).modules.receivable).toEqual([])

    await updateApprovalRecord(instance, '已确认')
    await updateApprovalRecord(instance, '已撤回')
    expect((await oaModuleStore.getState()).modules.receivable[0]).toMatchObject({ status: '作废', approvalStatus: '已撤回' })
  })

  it('registers an incoming receipt once and rejects duplicate bank flows', async () => {
    await oaModuleStore.replaceState({})
    const input = {
      accountName: '工行基本户',
      amount: 1200,
      receiptDate: '2026-07-16',
      payerName: '客户甲',
      bankSerialNo: 'BANK-001',
    }
    const receipt = await oaModuleStore.registerReceipt(input)
    expect(receipt).toMatchObject({
      flowType: '来款登记',
      incomeAmount: 1200,
      recognizedAmount: 0,
      unrecognizedAmount: 1200,
      status: '未认领',
    })
    await expect(oaModuleStore.registerReceipt(input)).rejects.toThrow('银行流水号已存在')
  })

  it('posts a registered receipt to its exact cash balance account once', async () => {
    await oaModuleStore.replaceState({
      cashBalanceRecords: [{
        id: 'cash-account-register',
        balance_date: '2026-07-15',
        company_name: '测试主体',
        bank_name: '工商银行',
        account_name: '工行基本户',
        account_no_tail: '8801',
        balance_amount: 1000,
      }],
    })
    const input = {
      cashBalanceId: 'cash-account-register',
      accountName: '工行基本户',
      amount: 1200,
      receiptDate: '2026-07-16',
      payerName: '客户甲',
      bankSerialNo: 'BANK-REGISTER-001',
      sourceApprovalId: 'approval-receipt-register',
      handler: '测试会计',
    }
    const receipt = await oaModuleStore.registerReceipt(input)
    const retried = await oaModuleStore.registerReceipt(input)
    const state = await oaModuleStore.getState()
    expect(receipt).toMatchObject({
      cashBalanceId: 'cash-account-register',
      balancePostedAmount: 1200,
      openingBalance: 1000,
      currentBalance: 2200,
    })
    expect(retried.id).toBe(receipt.id)
    expect(state.cashBalanceRecords[0]).toMatchObject({ balance_amount: 2200 })
    expect(state.cashBalanceRecords[0].balanceMovements).toHaveLength(1)
  })

  it('allocates one receipt across receivables and updates settlement statuses', async () => {
    await oaModuleStore.replaceState({
      modules: {
        receivable: [
          { id: 'ar-1', code: 'AR-1', billType: '应收', amount: 700, paidAmount: 0, unpaidAmount: 700, status: '未收' },
          { id: 'ar-2', code: 'AR-2', billType: '应收', amount: 800, paidAmount: 0, unpaidAmount: 800, status: '未收' },
        ],
      } as any,
      cashBalanceRecords: [{
        id: 'cash-account-1',
        balance_date: '2026-07-15',
        company_name: '测试主体',
        bank_name: '建设银行',
        account_name: '建行一般户',
        account_no_tail: '1266',
        balance_amount: 5000,
      }],
    })
    const receipt = await oaModuleStore.registerReceipt({
      accountName: '建行一般户',
      amount: 1000,
      receiptDate: '2026-07-16',
      payerName: '客户乙',
      bankSerialNo: 'BANK-002',
    })
    const allocationInput = {
      cashBalanceId: 'cash-account-1',
      allocationBatchId: 'RA-TEST-1',
      handler: '测试会计',
      allocations: [
        { receivableId: 'ar-1', amount: 700 },
        { receivableId: 'ar-2', amount: 200 },
      ],
    }
    const result = await oaModuleStore.allocateReceipt(receipt.id, allocationInput)
    const retried = await oaModuleStore.allocateReceipt(receipt.id, allocationInput)
    expect(result.receipt).toMatchObject({ recognizedAmount: 900, unrecognizedAmount: 100, status: '部分认领' })
    expect(retried.receipt).toMatchObject({ recognizedAmount: 900, unrecognizedAmount: 100 })
    expect(result.receivables).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ar-1', paidAmount: 700, unpaidAmount: 0, status: '已结清' }),
      expect.objectContaining({ id: 'ar-2', paidAmount: 200, unpaidAmount: 600, status: '部分收款' }),
    ]))
    expect(result.cashBalance).toMatchObject({ id: 'cash-account-1', balance_amount: 6000 })
    expect(result.cashBalance.balanceMovements[0]).toMatchObject({
      receiptId: receipt.id,
      amount: 1000,
      balanceBefore: 5000,
      balanceAfter: 6000,
      receivableCodes: ['AR-1', 'AR-2'],
      allocatedAmount: 900,
    })
    expect((await oaModuleStore.getState()).cashBalanceRecords[0].balance_amount).toBe(6000)
  })

  it('rejects over-allocation without changing the receipt or receivable', async () => {
    await oaModuleStore.replaceState({ modules: { receivable: [{ id: 'ar-1', code: 'AR-1', billType: '应收', amount: 500, paidAmount: 0, unpaidAmount: 500, status: '未收' }] } as any })
    const receipt = await oaModuleStore.registerReceipt({
      accountName: '工行基本户',
      amount: 300,
      receiptDate: '2026-07-16',
      payerName: '客户丙',
      bankSerialNo: 'BANK-003',
    })
    await expect(oaModuleStore.allocateReceipt(receipt.id, {
      cashBalanceId: 'cash-account-1',
      allocationBatchId: 'RA-OVER-1',
      allocations: [{ receivableId: 'ar-1', amount: 400 }],
    })).rejects.toThrow('未认领金额')
    const state = await oaModuleStore.getState()
    expect(state.modules.cash[0]).toMatchObject({ recognizedAmount: 0, unrecognizedAmount: 300 })
    expect(state.modules.receivable[0]).toMatchObject({ paidAmount: 0, unpaidAmount: 500 })
  })

  it('turns an approved receipt registration into an unrecognized cash flow', async () => {
    await oaModuleStore.replaceState({})
    const instance = {
      id: 'approval-receipt-1',
      code: 'APV-RC-1',
      businessType: 'receipt',
      businessId: 'receipt-business-1',
      businessNo: 'RC-BIZ-1',
      title: '客户来款',
      applicantName: '财务',
      amount: 880,
      submittedAt: '2026-07-16T10:00:00.000Z',
      approvedAt: '2026-07-16T11:00:00.000Z',
      formSnapshot: { accountName: '工行基本户', payerName: '客户丁', bankSerialNo: 'BANK-004', receiptDate: '2026-07-16' },
    } as any
    await updateApprovalRecord(instance, '已确认')
    await updateApprovalRecord(instance, '已确认')
    const state = await oaModuleStore.getState()
    expect(state.modules.cash).toHaveLength(1)
    expect(state.modules.cash[0]).toMatchObject({ sourceApprovalId: 'approval-receipt-1', status: '未认领', incomeAmount: 880 })
    expect(state.modules.receivable).toEqual([])
  })

  it('creates one receivable from an approved receivable confirmation', async () => {
    await oaModuleStore.replaceState({})
    const instance = {
      id: 'approval-ar-1',
      code: 'APV-AR-1',
      businessType: 'receivable',
      businessId: 'income-1',
      businessNo: 'YS-001',
      title: '运输收入应收确认',
      applicantName: '业务员',
      amount: 1800,
      submittedAt: '2026-07-16T10:00:00.000Z',
      approvedAt: '2026-07-16T11:00:00.000Z',
      formSnapshot: { customerName: '客户甲', occurredDate: '2026-07-15', dueDate: '2026-08-15' },
    } as any
    await updateApprovalRecord(instance, '审批中')
    expect((await oaModuleStore.getState()).modules.receivable).toEqual([])
    await updateApprovalRecord(instance, '已确认')
    await updateApprovalRecord(instance, '已确认')
    expect((await oaModuleStore.getState()).modules.receivable).toEqual([
      expect.objectContaining({
        billType: '应收',
        counterparty: '客户甲',
        amount: 1800,
        paidAmount: 0,
        unpaidAmount: 1800,
        dueDate: '2026-08-15',
        status: '未收',
        sourceApprovalId: 'approval-ar-1',
      }),
    ])
  })

  it('creates a pending payment idempotently without changing cash or payable balances', async () => {
    await oaModuleStore.replaceState({
      modules: {
        receivable: [{ id: 'ap-1', code: 'AP-1', billType: '应付', amount: 600, paidAmount: 0, unpaidAmount: 600, status: '未付' }],
        cash: [{ id: 'balance-1', accountName: '工行基本户', currentBalance: 1000, date: '2026-07-15', flowType: '余额初始化', status: '正常' }],
      } as any,
    })
    const input = {
      paymentRequestNo: 'REQ-001',
      accountName: '工行基本户',
      paymentDate: '2026-07-16',
      payeeName: '供应商甲',
      allocations: [{ payableId: 'ap-1', amount: 400 }],
    }
    const first = await oaModuleStore.createPaymentInstruction(input)
    const retried = await oaModuleStore.createPaymentInstruction(input)
    expect(retried.id).toBe(first.id)
    expect(first).toMatchObject({ paymentStatus: 'PENDING', status: '待支付', paymentAmount: 400, expenseAmount: 0, currentBalance: 1000 })
    const state = await oaModuleStore.getState()
    expect(state.modules.receivable[0]).toMatchObject({ paidAmount: 0, unpaidAmount: 600 })
    await expect(oaModuleStore.createPaymentInstruction({ ...input, payeeName: '另一供应商' })).rejects.toThrow('付款请求号已被其他付款内容使用')
  })

  it('reserves payable capacity while a payment is pending', async () => {
    await oaModuleStore.replaceState({ modules: { receivable: [{ id: 'ap-1', code: 'AP-1', billType: '应付', amount: 500, paidAmount: 0, unpaidAmount: 500, status: '未付' }] } as any })
    await oaModuleStore.createPaymentInstruction({
      paymentRequestNo: 'REQ-002',
      accountName: '工行基本户',
      paymentDate: '2026-07-16',
      payeeName: '供应商甲',
      allocations: [{ payableId: 'ap-1', amount: 400 }],
    })
    await expect(oaModuleStore.createPaymentInstruction({
      paymentRequestNo: 'REQ-003',
      accountName: '工行基本户',
      paymentDate: '2026-07-16',
      payeeName: '供应商甲',
      allocations: [{ payableId: 'ap-1', amount: 200 }],
    })).rejects.toThrow('可付金额不足')
  })

  it('confirms payment once, creates cash expense and settles multiple payables', async () => {
    await oaModuleStore.replaceState({
      modules: {
        receivable: [
          { id: 'ap-1', code: 'AP-1', billType: '应付', amount: 300, paidAmount: 0, unpaidAmount: 300, status: '未付' },
          { id: 'ap-2', code: 'AP-2', billType: '应付', amount: 500, paidAmount: 0, unpaidAmount: 500, status: '未付' },
        ],
        cash: [{ id: 'balance-1', accountName: '工行基本户', currentBalance: 1000, date: '2026-07-15', flowType: '余额初始化', status: '正常' }],
      } as any,
      cashBalanceRecords: [{ id: 'cash-account-1', company_name: '测试主体', bank_name: '工商银行', account_no_tail: '62220001', balance_amount: 1000 }],
    })
    const instruction = await oaModuleStore.createPaymentInstruction({
      paymentRequestNo: 'REQ-004',
      cashBalanceId: 'cash-account-1',
      companyName: '测试主体',
      accountNo: '62220001',
      accountName: '工行基本户',
      paymentDate: '2026-07-16',
      payeeName: '供应商',
      allocations: [{ payableId: 'ap-1', amount: 300 }, { payableId: 'ap-2', amount: 200 }],
    })
    const result = await oaModuleStore.confirmPayment(instruction.id, { bankSerialNo: 'BANK-PAY-001' })
    const retried = await oaModuleStore.confirmPayment(instruction.id, { bankSerialNo: 'BANK-PAY-001' })
    expect(retried.paymentStatus).toBe('SUCCESS')
    expect(result.payment).toMatchObject({ paymentStatus: 'SUCCESS', status: '已支付', expenseAmount: 500, currentBalance: 500 })
    expect(result.payables).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ap-1', paidAmount: 300, unpaidAmount: 0, status: '已结清' }),
      expect.objectContaining({ id: 'ap-2', paidAmount: 200, unpaidAmount: 300, status: '部分付款' }),
    ]))
    expect((await oaModuleStore.getState()).cashBalanceRecords[0]).toMatchObject({ id: 'cash-account-1', balance_amount: 500 })
  })

  it('marks a payment failed without settling payables and releases its reservation', async () => {
    await oaModuleStore.replaceState({ modules: { receivable: [{ id: 'ap-1', code: 'AP-1', billType: '应付', amount: 500, paidAmount: 0, unpaidAmount: 500, status: '未付' }] } as any })
    const instruction = await oaModuleStore.createPaymentInstruction({
      paymentRequestNo: 'REQ-005',
      accountName: '工行基本户',
      paymentDate: '2026-07-16',
      payeeName: '供应商甲',
      allocations: [{ payableId: 'ap-1', amount: 500 }],
    })
    await expect(oaModuleStore.failPayment(instruction.id, '')).rejects.toThrow('失败原因不能为空')
    await expect(oaModuleStore.failPayment(instruction.id, '银行退回')).resolves.toMatchObject({ paymentStatus: 'FAILED', status: '支付失败' })
    const replacement = await oaModuleStore.createPaymentInstruction({
      paymentRequestNo: 'REQ-006',
      accountName: '工行基本户',
      paymentDate: '2026-07-16',
      payeeName: '供应商甲',
      allocations: [{ payableId: 'ap-1', amount: 500 }],
    })
    expect(replacement.paymentStatus).toBe('PENDING')
    expect((await oaModuleStore.getState()).modules.receivable[0]).toMatchObject({ paidAmount: 0, unpaidAmount: 500 })
  })

  it('moves a submitted bank payment through an idempotent success callback', async () => {
    await oaModuleStore.replaceState({
      modules: {
        receivable: [{ id: 'ap-bank', code: 'AP-BANK', billType: '应付', amount: 300, paidAmount: 0, unpaidAmount: 300, status: '未付' }],
        cash: [{ id: 'balance-bank', accountName: '工行基本户', currentBalance: 500, date: '2026-07-16', flowType: '余额初始化', status: '正常' }],
      } as any,
    })
    const instruction = await oaModuleStore.createPaymentInstruction({
      paymentRequestNo: 'REQ-BANK',
      accountName: '工行基本户',
      paymentDate: '2026-07-17',
      payeeName: '供应商',
      allocations: [{ payableId: 'ap-bank', amount: 300 }],
    })
    await expect(oaModuleStore.markPaymentSubmitted(instruction.id, {
      provider: 'mock',
      providerRequestId: 'MOCK-REQ-BANK',
      acceptedAt: '2026-07-17T10:00:00.000Z',
      rawStatus: 'ACCEPTED',
    })).resolves.toMatchObject({ paymentStatus: 'PROCESSING', status: '银行处理中' })

    const callback = { eventId: 'event-bank-1', paymentRequestNo: 'REQ-BANK', status: 'SUCCESS' as const, bankSerialNo: 'BANK-SERIAL-1' }
    await oaModuleStore.handleBankPaymentCallback(callback)
    await oaModuleStore.handleBankPaymentCallback(callback)
    const state = await oaModuleStore.getState()
    expect(state.modules.cash.find(row => row.id === instruction.id)).toMatchObject({
      paymentStatus: 'SUCCESS',
      expenseAmount: 300,
      callbackEventIds: ['event-bank-1'],
      bankSerialNo: 'BANK-SERIAL-1',
    })
    expect(state.modules.receivable[0]).toMatchObject({ paidAmount: 300, unpaidAmount: 0, status: '已结清' })
  })
})
