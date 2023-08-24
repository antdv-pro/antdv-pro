export interface FirstFormState {
  paymentAccount: string
  collectionAccount: {
    type: string
    account: string
  }
  payeeName: string
  amount: number | undefined
}

export const useStepForm = defineStore('step-form', () => {
  const current = ref(0)
  const stepsLength = ref(0)
  const pwd = ref('')
  const firstFormState = ref({})
  const secondFormState = ref({})

  const setStepsLength = (length: number) => {
    stepsLength.value = length
  }

  const prev = () => {
    current.value -= 1
  }
  const next = () => {
    current.value += 1
  }
  const reset = () => {
    current.value = 0
  }
  const setPwd = (value: string) => {
    pwd.value = value
  }

  const setFirstFormState = (value: any) => {
    firstFormState.value = value
  }
  const setSecondFormState = (value: any) => {
    secondFormState.value = value
  }

  return {
    current,
    stepsLength,
    setStepsLength,
    prev,
    next,
    reset,
    pwd,
    setPwd,
    firstFormState,
    setFirstFormState,
    secondFormState,
    setSecondFormState,
  }
})
