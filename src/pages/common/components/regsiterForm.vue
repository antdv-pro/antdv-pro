<script setup lang="ts">
import { HourglassOutlined, LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons-vue'
import { reactive, shallowRef } from 'vue'
import { useInterval } from '@vueuse/core'
import { useI18nLocale } from '~/composables/i18n-locale.ts'
import { useMessage } from '~/composables/global-config.ts'
import { Rules } from '~@/utils/rule'

const emit = defineEmits(['changeState'])
function changeState(s: string) {
  emit('changeState', s)
}

const formModel = reactive({
  username: undefined,
  email: undefined,
  code: undefined,
  password: undefined,
  rePassword: undefined,
})

const formRef = shallowRef()
const message = useMessage()
const codeLoading = shallowRef(false)
const submitLoading = shallowRef(false)
const resetCounter = 60
const { t } = useI18nLocale()
const { counter, pause, reset, resume, isActive } = useInterval(1000, {
  controls: true,
  immediate: false,
  callback(count) {
    if (count) {
      if (count === resetCounter)
        pause()
    }
  },
})

async function getCode() {
  codeLoading.value = true
  try {
    await formRef.value.validate(['mobile'])
    setTimeout(() => {
      reset()
      resume()
      codeLoading.value = false
      message.success('验证码是：123456')
    }, 3000)
  }
  catch (error) {
    codeLoading.value = false
  }
}

function register() {

}
</script>

<template>
  <div>
    <div class="text-center py-6 text-2xl">
      {{ t("pages.register.tips") }}
    </div>
    <!-- 用户名 -->
    <a-form ref="formRef" :model="formModel">
      <a-form-item name="username" :rules="[
        Rules.Required('pages.login.required.username'),
        Rules.Range(6, 15, 'pages.login.range.username'),
        Rules.IsLetterNum('pages.login.pattern.username'),
      ]">
        <a-input v-model:value="formModel.username" allow-clear autocomplete="off"
          :placeholder="t('pages.register.username.placeholder')" size="large">
          <template #prefix>
            <UserOutlined />
          </template>
        </a-input>
      </a-form-item>
      <!-- 邮箱 -->
      <a-form-item name="email" :rules="[
        Rules.Required('pages.login.required.email'),
        Rules.IsEmail('pages.login.is.email'),
      ]">
        <a-input v-model:value="formModel.email" allow-clear autocomplete="off"
          :placeholder="t('pages.register.email.placeholder')" size="large">
          <template #prefix>
            <MailOutlined />
          </template>
        </a-input>
      </a-form-item>
      <!-- 密码 -->
      <a-form-item name="password" :rules="[
        Rules.Required('pages.login.required.passwd'),
        Rules.Range(8, 20, 'pages.login.valid.passwd'),
      ]">
        <a-input-password v-model:value="formModel.password" allow-clear
          :placeholder="t('pages.register.passwd.placeholder')" size="large">
          <template #prefix>
            <LockOutlined />
          </template>
        </a-input-password>
      </a-form-item>
      <!-- 二次密码 -->
      <a-form-item name="rePassword" :rules="[
        Rules.Required('pages.login.required.rePasswd'),
        Rules.Equal(formModel.password, 'pages.login.equal.rePasswd'),
      ]">
        <a-input-password v-model:value="formModel.rePassword" allow-clear
          :placeholder="t('pages.register.passwd2.placeholder')" size="large">
          <template #prefix>
            <LockOutlined />
          </template>
        </a-input-password>
      </a-form-item>
      <!-- 验证码 -->
      <a-form-item name="code" :rules="[Rules.Required('pages.login.required.code')]">
        <div flex items-center>
          <a-input v-model:value="formModel.code" style="flex: 1 1 0%; transition: width 0.3s ease 0s; margin-right: 8px;"
            allow-clear :placeholder="t('pages.register.code.placeholder')" size="large">
            <template #prefix>
              <HourglassOutlined />
            </template>
          </a-input>
          <a-button :loading="codeLoading" :disabled="isActive" size="large" @click="getCode">
            <template v-if="!isActive">
              {{ t('pages.email.getcode') }}
            </template>
            <template v-else>
              {{ resetCounter - counter }} {{ t('pages.getCaptchaSecondText') }}
            </template>
          </a-button>
        </div>
      </a-form-item>
    </a-form>
    <div>
      <a-button type="primary" block :loading="submitLoading" size="large">
        {{ t("pages.register.submit") }}
      </a-button>
      <a-button class="mt-1" type="link" block size="small" @click="changeState('login')">
        {{ t("pages.back") }}
      </a-button>
    </div>
  </div>
</template>

<style scoped lang="less"></style>
../../../utils/rule
