# Refactor Commit Batches

The worktree contains unrelated configuration and deployment changes. Stage only the paths listed for each batch and review `git diff --cached` before committing.

## 1. Vehicle Permissions

Purpose: persist record creators, return server-authoritative permissions, and use the shared frontend policy.

Paths:

- `servers/services/vehicle-business/permissions.ts`
- `servers/services/vehicle-business/permissions.test.ts`
- `servers/services/vehicle-business/maintenance-records.ts`
- `servers/services/vehicle-business/maintenance-records.test.ts`
- `servers/routes/transport/operations/data.get.ts`
- `servers/routes/transport/operations/data.put.ts`
- `servers/utils/office-vehicle-store.ts`
- `servers/utils/transport-operation-store.ts`
- `src/api/office-vehicle/index.ts`
- `src/composables/transport-operation-data.ts`
- `src/pages/approval/office-vehicle/index.vue`
- `src/pages/transport/maintenance/index.vue`

Verification: `pnpm vitest run servers/services/vehicle-business/permissions.test.ts servers/services/vehicle-business/maintenance-records.test.ts servers/utils/office-vehicle-store.test.ts servers/utils/transport-operation-store.test.ts src/utils/record-permission.test.ts`

## 2. OA Structured Storage

Purpose: make typed database columns authoritative and retain JSON only for extension fields.

Paths:

- `servers/services/approval/oa-structured-record.ts`
- `servers/services/approval/oa-structured-record.test.ts`
- `servers/utils/oa-module-store.ts`

Verification: `pnpm vitest run servers/services/approval/oa-structured-record.test.ts servers/utils/oa-module-store.test.ts`

## 3. Transport Page State

Purpose: move form, query, pagination, modal, and import-dialog state out of the transport page.

Paths:

- `src/pages/transport/composables/use-transport-module-state.ts`
- `src/pages/transport/composables/use-transport-module-state.test.ts`
- `src/pages/transport/module-boundary.test.ts`
- `src/pages/transport/module.vue`

Verification: `pnpm vitest run src/pages/transport/composables/use-transport-module-state.test.ts src/pages/transport/module-boundary.test.ts src/workers/transport-import-boundary.test.ts`

## 4. OA Business Views

Purpose: isolate dashboard and finance workflow presentation from the OA orchestration page.

Paths:

- `src/pages/approval/components/finance-workflow-view.vue`
- `src/pages/approval/components/oa-dashboard-view.vue`
- `src/pages/approval/module-boundary.test.ts`
- `src/pages/approval/oa-module.vue`

Verification: `pnpm vitest run src/pages/approval/module-boundary.test.ts`

## Final Gate

Run `pnpm typecheck` and `pnpm test -- --run` after all batches are combined.

Do not include `.env*`, `coverage/`, `tmp/`, uploads, deployment artifacts, or unrelated template changes in these commits.
