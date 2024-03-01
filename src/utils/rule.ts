import { log } from 'node:console'
import type { Rule, RuleObject } from 'ant-design-vue/es/form'
import { useI18nLocale } from '~@/composables/i18n-locale'
import { is } from '~@/utils/regx'

const { t } = useI18nLocale()

function Required(tc: string): RuleObject {
  return { required: true, message: t(tc) }
}

function Pattern(pattern: RegExp, tc: string): RuleObject {
  return {
    pattern,
    message: t(tc),
  }
}

function Range(min: number, max: number, tc: string): RuleObject {
  return {
    min,
    max,
    message: t(tc),
  }
}

function Validate(cb: (r: Rule, val: any) => string): RuleObject {
  return {
    validator: async (rule: Rule, value: any) => {
      const rt = cb(rule, value)
      if (rt)
        return Promise.reject(t(rt))

      return Promise.resolve()
    },
  }
}

function Equal(v: any, tc: string): RuleObject {
  return Validate((_, val): string => {
    if (val !== v)
      return tc

    return ''
  })
}

function IsEmail(tc: string): RuleObject {
  return Pattern(is.email, tc)
}

function IsLetterNum(tc: string): RuleObject {
  return Pattern(is.numberAndLetter, tc)
}

export const Rules = {
  Required,
  Validate,
  Equal,
  Range,
  Pattern,
  IsEmail,
  IsLetterNum,
}
