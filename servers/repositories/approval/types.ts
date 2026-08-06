export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'CANCELED'
export type TaskStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TRANSFERRED' | 'CANCELED'
export type ApprovalAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REVOKE' | 'TRANSFER' | 'CC' | 'EXTERNAL_SYNC' | 'ARCHIVE'
export type BusinessStatus = 'DRAFT' | 'APPROVAL_PENDING' | 'APPROVAL_APPROVED' | 'APPROVAL_REJECTED' | 'APPROVAL_REVOKED'

export interface ApprovalNodeTemplate {
  id: string
  name: string
  order: number
  approverType: 'USER' | 'ROLE'
  approverIds: Array<string | number>
}

export interface ApprovalTemplate {
  id: string
  name: string
  businessTypes: string[]
  enabled: boolean
  nodes: ApprovalNodeTemplate[]
  createdAt: string
  updatedAt: string
}

export interface ApprovalNode {
  id: string
  instanceId: string
  templateNodeId: string
  name: string
  order: number
  approverType: 'USER' | 'ROLE'
  approverIds: Array<string | number>
  status: TaskStatus
}

export interface ApprovalInstance {
  id: string
  code: string
  templateId: string
  approvalType: string
  businessModule?: string
  businessType: string
  businessId: string
  businessNo: string
  title: string
  applicantId: string | number
  applicantName: string
  deptId?: string | number
  deptName?: string
  amount?: number
  status: ApprovalStatus
  businessStatus: BusinessStatus
  currentNodeId?: string
  currentNodeName?: string
  formSnapshot: Record<string, any>
  payload: Record<string, any>
  ccUserIds: Array<string | number>
  createdAt: string
  updatedAt: string
  submittedAt: string
  approvedAt?: string
  rejectedAt?: string
  revokedAt?: string
  businessAppliedAt?: string
}

export interface ApprovalTask {
  id: string
  instanceId: string
  nodeId: string
  nodeName: string
  assigneeId: string | number
  assigneeName: string
  status: TaskStatus
  action?: ApprovalAction
  comment?: string
  actedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ApprovalLog {
  id: string
  instanceId: string
  taskId?: string
  action: ApprovalAction
  operatorId: string | number
  operatorName: string
  comment?: string
  fromUserId?: string | number
  toUserId?: string | number
  createdAt: string
}

export interface ApprovalCc {
  id: string
  instanceId: string
  userId: string | number
  userName: string
  read: boolean
  createdAt: string
}

export interface BusinessRecord {
  businessType: string
  businessId: string
  businessNo: string
  title: string
  businessStatus: BusinessStatus
  approvalStatus?: ApprovalStatus
  approvalInstanceId?: string
  updatedAt: string
}

export interface SubmitApprovalPayload {
  templateId?: string
  approvalType?: string
  businessModule?: string
  businessType: string
  businessId: string
  businessNo: string
  title: string
  applicantId: string | number
  applicantName: string
  deptId?: string | number
  deptName?: string
  amount?: number
  formData?: Record<string, any>
  ccUserIds?: Array<string | number>
}

export interface UpsertExternalApprovalPayload {
  externalKey: string
  approvalType: string
  businessType: string
  businessNo: string
  title: string
  applicantId: string | number
  applicantName: string
  deptId?: string | number
  deptName?: string
  amount?: number
  status: Exclude<ApprovalStatus, 'DRAFT'>
  submittedAt: string
  completedAt?: string
  formData: Record<string, any>
  ccUserIds?: Array<string | number>
}

export interface ActionPayload {
  taskId: string
  operatorId: string | number
  operatorName: string
  comment?: string
}

export interface TransferPayload extends ActionPayload {
  toUserId: string | number
  toUserName: string
}
