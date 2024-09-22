<script lang="tsx">
import type { Component } from 'vue'
import { loadingMap } from '~#/loading-enum.js'

export default defineComponent({
  name: 'BaseLoading',
  props: {
    text: {
      type: String,
      default: '正在加载中...',
    },
    textColor: {
      type: String,
      default: '#79bbff',
    },
    background: {
      type: String,
      default: 'rgba(0, 0, 0, .5)',
    },
    modal: {
      type: Boolean,
      default: true,
    },
    spin: {
      type: String,
      default: 'chase',
    },
    full: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const renderBasicLoading = () => {
      const { spin, textColor } = props
      return h(loadingMap.get(spin) as Component, { color: textColor } as any)
    }

    return () => {
      const { background, modal, full, text, textColor } = props
      return (
        <div
          style={modal ? { background } : {}}
          class={{ 'loading-container': true, 'is-fullscreen': full }}
        >
          <div class="loading-wrapper">
            {renderBasicLoading() }
            <div class="text" style={{ color: textColor }}>
              {text}
            </div>
          </div>
        </div>
      )
    }
  },
})
</script>

<style lang="less" scoped>
.loading-container {
  position: absolute;
  inset: 0;
  z-index: 9999;

  &.is-fullscreen {
    position: fixed;
  }

  .loading-wrapper {
    position: absolute;
    top: 50%;
    width: 100%;
    margin-top: -21px;
    text-align: center;

    .text {
      width: 100%;
      margin: 8px 0;
    }

    .loading-icon {
      animation: rotating 1.5s linear infinite;
    }
  }
}
@keyframes rotating {
  0% {
    transform: rotate(0);
  }

  100% {
    transform: rotate(1turn);
  }
}
</style>
