<script setup>
import { CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons-vue'

defineProps({
  gap: {
    type: Number,
  },
  subTotal: {
    type: Number,
  },
  total: {
    type: [Number, String],
  },
  status: {
    type: String,
  },
  title: {
    type: String,
  },
})
</script>

<template>
  <div class="numberInfo">
    <div class="numberInfoTitle" :title="title">
      {{ title }}
    </div>

    <div class="numberInfoSubTitle">
      <slot name="subTitle" />
    </div>
    <div class="numberInfoValue" :style="gap ? { marginTop: gap } : {}">
      <span>
        {{ total?.toLocaleString() }}
      </span>

      <span v-if="status || subTotal" class="subTotal">
        {{ subTotal }}
        <CaretUpOutlined v-if="status && status === 'up'" />
        <CaretDownOutlined v-else />
      </span>
    </div>
  </div>
</template>

<style scoped lang="less">
.numberInfo {
  .suffix {
    margin-left: 4px;
    color: var(--text-color);
    font-size: 16px;
    font-style: normal;
  }
  .numberInfoSubTitle {
    height: 22px;
    overflow: hidden;
    // color: rgba(0,0,0,.45);
    font-size: 14px;
    line-height: 22px;
    white-space: nowrap;
    text-overflow: ellipsis;
    word-break: break-all;
  }
  .numberInfoValue {
    margin-top: 4px;
    overflow: hidden;
    font-size: 0;
    white-space: nowrap;
    text-overflow: ellipsis;
    word-break: break-all;
    & > span {
      display: inline-block;
      height: 32px;
      margin-right: 32px;
      // color: rgba(0,0,0,.85);
      font-size: 24px;
      line-height: 32px;
    }
    .subTotal {
      margin-right: 0;
      // color: rgba(0,0,0,.45);
      font-size: 16px;
      vertical-align: top;
      .anticon {
        margin-left: 4px;
        font-size: 12px;
        transform: scale(0.82);
      }
      :deep(.anticon-caret-up) {
        color: #f5222d;
      }
      :deep(.anticon-caret-down) {
        color: #52c41a;
      }
    }
  }
}
.numberInfolight {
  .numberInfoValue {
    & > span {
      color: var(--text-color);
    }
  }
}
</style>
