<script setup>
import { AccessEnum } from '~@/utils/constant'

const { hasAccess, roles } = useAccess()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div>
      当前用户拥有权限列表 <a class="c-primary"> {{ roles?.join(',') }}</a>
    </div>

    所有用户均可查看
    细粒度控制到按钮级别

    <a-alert message="使用Access组件" />
    <a-space>
      <Access :access="[AccessEnum.USER, AccessEnum.ADMIN]">
        <a-button>普通用户</a-button>
      </Access>
      <Access :access="AccessEnum.ADMIN">
        <a-button type="primary">
          管理员
        </a-button>
      </Access>
    </a-space>
    <a-alert message="使用useAccess组合式Api" />
    <a-space>
      <a-button v-if="hasAccess([AccessEnum.USER, AccessEnum.ADMIN])">
        普通用户
      </a-button>
      <a-button v-if="hasAccess(AccessEnum.ADMIN)" type="primary">
        管理员
      </a-button>
    </a-space>
    <a-alert message="使用v-access指令" />
    <a-space>
      <a-button v-access="[AccessEnum.USER, AccessEnum.ADMIN]">
        普通用户
      </a-button>
      <a-button v-access="AccessEnum.ADMIN" type="primary">
        管理员
      </a-button>
    </a-space>
  </div>
</template>
