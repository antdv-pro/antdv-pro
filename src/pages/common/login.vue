<script setup lang="ts">
import { AlipayCircleFilled, LockOutlined, MobileOutlined, TaobaoCircleFilled, UserOutlined, WeiboCircleFilled } from '@ant-design/icons-vue'
import GlobalLayoutFooter from '~/layouts/components/global-footer/index.vue'
// import { loginApi } from '~/api/common/login'
const appStore = useAppStore()
const { layoutSetting } = storeToRefs(appStore)
const router = useRouter()
const loginModel = reactive({
  username: undefined,
  password: undefined,
  mobile: undefined,
  code: undefined,
  type: 'account',
  remember: true,
})
const formRef = shallowRef()
const codeLoading = shallowRef(false)
const antdToken = useAntdToken()
const resetCounter = 60
const submitLoading = shallowRef(false)

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
const getCode = async () => {
  codeLoading.value = true
  try {
    await formRef.value.validate(['mobile'])
    setTimeout(() => {
      reset()
      resume()
      codeLoading.value = false
    }, 3000)
  }
  catch (error) {
    // TODO
    codeLoading.value = false
  }
}

const submit = async () => {
  submitLoading.value = true
  try {
    await formRef.value?.validate()
    // const { data } = await loginApi({
    //   username: 'admin',
    //   password: 'admin',
    // })
    // console.log(data?.token)

    setTimeout(() => {
      submitLoading.value = false
      router.push('/')
    }, 1000)
  }
  catch (e) {
    console.warn(e)
    submitLoading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-lang" flex="~" items-center justify-end gap-2 px-24px>
      <span flex items-center justify-center cursor-pointer text-16px @click="appStore.toggleTheme(layoutSetting.theme === 'dark' ? 'light' : 'dark')">
        <!-- 亮色和暗黑模式切换按钮 -->
        <template v-if="layoutSetting.theme === 'light'">
          <carbon-moon />
        </template>
        <template v-else>
          <carbon-sun />
        </template>
      </span>
    </div>
    <div class="login-content">
      <div class="ant-pro-form-login-cotainer">
        <div class="ant-pro-form-login-top">
          <div class="ant-pro-form-login-header">
            <span class="ant-pro-form-login-logo">
              <img src="/logo.svg">
            </span>
            <span class="ant-pro-form-login-title">
              Ant Design
            </span>
          </div>
          <div class="ant-pro-form-login-desc">
            Ant Design 是西湖区最具影响力的 Web 设计规范
          </div>
        </div>
        <div class="ant-pro-form-login-main" w-335px>
          <a-form ref="formRef" :model="loginModel">
            <a-tabs v-model:activeKey="loginModel.type" centered>
              <a-tab-pane key="account" tab="账户密码登录" />
              <a-tab-pane key="mobile" tab="手机号登录" />
            </a-tabs>
            <template v-if="loginModel.type === 'account'">
              <a-form-item name="username" :rules="[{ required: true, message: '用户名不能为空' }]">
                <a-input v-model:value="loginModel.username" allow-clear placeholder="用户名：admin or user" size="large" @pressEnter="submit">
                  <template #prefix>
                    <UserOutlined />
                  </template>
                </a-input>
              </a-form-item>
              <a-form-item name="password" :rules="[{ required: true, message: '密码不能为空' }]">
                <a-input-password v-model:value="loginModel.password" allow-clear placeholder="密码：admin" size="large" @pressEnter="submit">
                  <template #prefix>
                    <LockOutlined />
                  </template>
                </a-input-password>
              </a-form-item>
            </template>
            <template v-if="loginModel.type === 'mobile'">
              <a-form-item name="mobile" :rules="[{ required: true, message: '手机号不能为空' }]">
                <a-input v-model:value="loginModel.mobile" allow-clear placeholder="请输入手机号！" size="large" @pressEnter="submit">
                  <template #prefix>
                    <MobileOutlined />
                  </template>
                </a-input>
              </a-form-item>
              <a-form-item name="code" :rules="[{ required: true, message: '验证码不能为空' }]">
                <div flex items-center>
                  <a-input
                    v-model:value="loginModel.code" style="flex: 1 1 0%; transition: width 0.3s ease 0s; margin-right: 8px;"
                    allow-clear placeholder="请输入验证码！" size="large" @pressEnter="submit"
                  >
                    <template #prefix>
                      <LockOutlined />
                    </template>
                  </a-input>
                  <a-button :loading="codeLoading" :disabled="isActive" size="large" @click="getCode">
                    <template v-if="!isActive">
                      获取验证码
                    </template>
                    <template v-else>
                      {{ resetCounter - counter }} 秒后重新获取
                    </template>
                  </a-button>
                </div>
              </a-form-item>
            </template>
            <div class="mb-24px" flex items-center justify-between>
              <a-checkbox v-model:checked="loginModel.remember">
                自动登录
              </a-checkbox>
              <a>忘记密码 ?</a>
            </div>
            <a-button type="primary" block :loading="submitLoading" size="large" @click="submit">
              登录
            </a-button>
          </a-form>
          <div class="ant-pro-form-login-other" text-14px>
            其他登录方式:
            <AlipayCircleFilled class="icon" />
            <TaobaoCircleFilled class="icon" />
            <WeiboCircleFilled class="icon" />
          </div>
        </div>
      </div>
    </div>
    <div py-24px px-50px :data-theme="layoutSetting.theme" text-14px>
      <GlobalLayoutFooter :copyright="layoutSetting.copyright">
        <template #renderFooterLinks>
          <footer-links />
        </template>
      </GlobalLayoutFooter>
    </div>
  </div>
</template>

<style lang="less" scoped>
.login-container{
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: auto;
  background: var(--bg-color-container);
}

.login-lang {
  width: 100%;
  height: 40px;
  line-height: 44px;
}

.login-content{
  flex: 1 1;
  padding: 32px 0
}
.ant-pro-form-login-cotainer{
  display: flex;
  flex: 1 1;
  flex-direction: column;
  height: 100%;
  padding: 32px 0;
  overflow: auto;
  background: inherit
}

.ant-pro-form-login-top {
  text-align: center
}

.ant-pro-form-login-header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  line-height: 44px
}

.ant-pro-form-login-header a {
  text-decoration: none
}

.ant-pro-form-login-title {
  position: relative;
  top: 2px;
  color: var(--text-color);
  font-weight: 600;
  font-size: 33px
}

.ant-pro-form-login-logo {
  width: 44px;
  height: 44px;
  margin-right: 16px;
  vertical-align: top
}

.ant-pro-form-login-logo img {
  width: 100%
}

.ant-pro-form-login-desc {
  margin-top: 12px;
  margin-bottom: 40px;
  color: var(--text-color-1);
  font-size: 14px
}

.ant-pro-form-login-main {
  min-width: 328px;
  max-width: 500px;
  margin: 0 auto
}

.ant-pro-form-login-main {
  .ant-tabs-nav-list {
    margin: 0 auto;
    font-size: 16px;
  }
  .ant-pro-form-login-other {
    margin-top: 24px;
    line-height: 22px;
    text-align: left
  }

  .icon{
    margin-left: 8px;
    color: var(--text-color-2);
    font-size: 24px;
    vertical-align: middle;
    cursor: pointer;
    transition: color .3s;

    &:hover{
      color: v-bind('antdToken.colorPrimary');
    }
  }
}

@media(min-width: 768px){
  .login-container{
    background-image:url(https://gw.alipayobjects.com/zos/rmsportal/TVYTbAXWheQpRcWDaDMu.svg);
    background-repeat: no-repeat;
    background-position: center 110px;
    background-size: 100%;
  }

  .login-content{
    padding: 32px 0 24px;
  }

  .ant-pro-form-login-cotainer{
    padding:32px 0 24px;
    background-repeat: no-repeat;
    background-position: center 110px;
    background-size: 100%
  }
}
</style>
