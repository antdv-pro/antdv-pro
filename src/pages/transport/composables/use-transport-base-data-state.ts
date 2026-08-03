export function useTransportBaseDataState() {
  return {
    activeBaseDataTab: ref('company'),
    baseDataModalOpen: ref(false),
    baseDataSubmitting: ref(false),
    baseDataEditingCode: ref(''),
    baseDataForm: reactive<Record<string, string>>({}),
    baseDataVersion: ref(0),
    routeCoordinateResolving: reactive({ loading: false, unloading: false }),
    routeCoordinateSourceAddress: reactive({ loading: '', unloading: '' }),
  }
}
