<script setup>
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  bordered: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  total: {
    type: Number,
  },
  contentHeight: {
    type: Number,
  },
})
</script>

<template>
  <a-card :bind="props" :body-style="{ padding: '20px 24px 8px 24px' }">
    <div class="chartCard">
      <div class="chartTop">
        <div class="metaWrap">
          <div class="meta">
            <span class="title">{{ title }}</span>
            <span class="action">
              <slot name="action" />
            </span>
          </div>
          <div class="total">
            <slot name="total" />
          </div>
        </div>
      </div>
      <div class="content" :style="{ height: `${contentHeight}px` || 'auto' }">
        <div class="contentFixed">
          <slot />
        </div>
      </div>
      <div class="footer">
        <slot name="footer" />
      </div>
    </div>
  </a-card>
</template>

<style scoped lang="less">
.chartCard {
  position: relative;
  .chartTop {
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  .chartTopMargin {
    margin-bottom: 12px;
  }
  .chartTopHasMargin {
    margin-bottom: 20px;
  }
  .metaWrap {
    float: left;
  }
  .avatar {
    position: relative;
    top: 4px;
    float: left;
    margin-right: 20px;
    img {
      border-radius: 100%;
    }
  }
  .meta {
    height: 22px;
    // color: rgba(0,0,0,.45);
    font-size: 14px;
    line-height: 22px;
  }
  .action {
    position: absolute;
    top: 4px;
    right: 0;
    line-height: 1;
    cursor: pointer;
  }
  .total {
    height: 38px;
    margin-top: 4px;
    margin-bottom: 0;
    overflow: hidden;
    // color: rgba(0,0,0,.85);
    font-size: 30px;
    line-height: 38px;
    white-space: nowrap;
    text-overflow: ellipsis;
    word-break: break-all;
  }
  .content {
    position: relative;
    width: 100%;
    margin-bottom: 12px;
  }
  .contentFixed {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
  }
  .footer {
    margin-top: 8px;
    padding-top: 9px;
    border-top: 1px solid var(--pro-ant-color-border);
    & > * {
      position: relative;
    }
  }
  .footerMargin {
    margin-top: 20px;
  }
}
</style>
