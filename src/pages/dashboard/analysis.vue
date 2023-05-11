<script setup lang="ts">
import { test200, test401, test500, testDelete, testPost, testPut } from '~/api/test'
const { locale, setLocale, t } = useI18nLocale()
const { token } = useAntdToken()
</script>

<template>
  <div p-2>
    {{ token.colorPrimary }}
    <a-radio-group :value="locale" @update:value="setLocale">
      <a-radio-button key="en-US" value="en-US">
        English
      </a-radio-button>
      <a-radio-button key="zh-CN" value="zh-CN">
        中文
      </a-radio-button>
    </a-radio-group>
    {{ t("pages.login.accountLogin.tab") }}
    <a-space wrap>
      <a-button @click="test200">
        200请求测试
      </a-button>
      <a-button @click="test401">
        401请求测试
      </a-button>
      <a-button @click="test500">
        500请求测试
      </a-button>
      <a-button @click="testPut">
        put请求测试
      </a-button>
      <a-button @click="testPost">
        post请求测试
      </a-button>
      <a-button @click="testDelete">
        delete请求测试
      </a-button>
    </a-space>

    <a-date-picker />
    <a-time-picker />
    <a-range-picker style="width: 200px" />
    <a-table />
  </div>
</template>
