<script setup lang="ts">
import { AxiosError } from 'axios'
import { reactive, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useNotification } from '~/composables/global-config.ts'
import { useAuthorization } from '~/composables/authorization.ts'
import type { LoginParams } from '~/api/common/login.ts'
import { loginApi } from '~/api/common/login.ts'
import { getQueryParam } from '~/utils/tools.ts'
import { useI18nLocale } from '~/composables/i18n-locale.ts'
import { Rules } from '~@/utils/rule'

const emit = defineEmits(['changeState'])
function changeState(s: string) {
  emit('changeState', s)
}

const { t } = useI18nLocale()
const formRef = shallowRef()
const notification = useNotification()
const submitLoading = shallowRef(false)
const token = useAuthorization()
const router = useRouter()
const errorAlert = shallowRef(false)

const formModel = reactive({
  username: undefined,
  password: undefined,
  remember: false,
})

async function submit() {
  submitLoading.value = true
  try {
    await formRef.value?.validate()
    const params: LoginParams = {
      username: formModel.username,
      password: formModel.password,
    } as unknown as LoginParams

    const { data } = await loginApi(params)
    token.value = data?.token
    notification.success({
      message: '登录成功',
      description: '欢迎回来！',
      duration: 3,
    })
    // 获取当前是否存在重定向的链接，如果存在就走重定向的地址
    const redirect = getQueryParam('redirect', '/')
    router.push({
      path: redirect,
      replace: true,
    })
  }
  catch (e) {
    if (e instanceof AxiosError)
      errorAlert.value = true
    submitLoading.value = false
  }
}
</script>

<template>
  <div>
    <div class="text-center py-6 text-2xl">
      {{ t("pages.login.tips") }}
    </div>
    <a-form ref="formRef" :model="formModel">
      <a-form-item
        name="username" :rules="[
          Rules.Required('pages.login.required.username'),
        ]"
      >
        <a-input
          v-model:value="formModel.username" allow-clear
          autocomplete="off"
          :placeholder="t('pages.login.username.placeholder')" size="large" @press-enter="submit"
        >
          <template #prefix>
            <UserOutlined />
          </template>
        </a-input>
      </a-form-item>
      <a-form-item
        name="password" :rules="[
          Rules.Required('pages.login.required.passwd'),
        ]"
      >
        <a-input-password
          v-model:value="formModel.password" allow-clear
          :placeholder="t('pages.login.password.placeholder')" size="large" @press-enter="submit"
        >
          <template #prefix>
            <LockOutlined />
          </template>
        </a-input-password>
      </a-form-item>
    </a-form>
    <div class="mb-24px flex-between">
      <a-checkbox v-model:checked="formModel.remember">
        {{ t("pages.login.rememberMe") }}
      </a-checkbox>
      <a @click="changeState('forgotpwd')">{{ t("pages.login.forgotpwd") }}</a>
    </div>
    <div>
      <a-button type="primary" block :loading="submitLoading" size="large" @click="submit">
        {{ t("pages.login.submit") }}
      </a-button>
      <a-button
        class="mt-2" type="link" block size="small"
        @click="changeState('register')"
      >
        {{ t("pages.login.register") }}
      </a-button>
    </div>
  </div>
</template>

<style scoped lang="less">

</style>
