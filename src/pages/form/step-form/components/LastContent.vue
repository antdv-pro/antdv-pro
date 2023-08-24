<script setup lang="ts">
import { FirstFormState_Field } from '~/pages/form/step-form/util.ts'
import { useStepForm } from '~/stores/step-form.ts'

const stepFormStore = useStepForm()
const { firstFormState } = storeToRefs(stepFormStore)

const again = () => {
  stepFormStore.reset()
}
</script>

<template>
  <div class="w-40% m-a">
    <a-result
      status="success"
      title="操作成功"
      sub-title="预计两小时内到账"
    >
      <template #extra>
        <a-button type="primary" @click="again">
          再转一笔
        </a-button>
        <a-button key="card">
          查看账单
        </a-button>
      </template>
    </a-result>

    <div class="ant-result-content">
      <div class="ant-descriptions-view">
        <table>
          <tbody>
            <template v-for="(value, key) in firstFormState" :key="key">
              <tr
                class="ant-descriptions-row"
              >
                <td
                  class="ant-descriptions-item-label pb-16px align-top flex"
                >
                  <span>{{ FirstFormState_Field[key] }} :</span>
                  <span v-if="FirstFormState_Field[key] === '转账金额' ">
                    <span class="ant-descriptions-item-content"><span class="text-xl pl-2">{{ value }}</span> 元</span>
                  </span>
                  <span v-else class="ant-descriptions-item-content pl-2">{{ value.account ?? value }}</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.ant-result-content {
  margin-top: 24px;
  padding: 24px 40px;
  background-color: #fafafa;

  .ant-descriptions-view {
    width: 100%;
    border-radius: 2px;

    table {
      width: 100%;
      table-layout: fixed;
    }

  }
}

.ant-descriptions-item-label {
  box-sizing: border-box;
  background-color: #fafafa;
  color: rgba(0, 0, 0, .85);
  font-weight: 400;
  font-size: 14px;
  line-height: 1.5715;
  text-align: start;

}

.ant-descriptions-item-content {
  display: table-cell;
  flex: 1 1;
  color: rgba(0, 0, 0, .85);
  font-weight: 400;
  line-height: 1.5715;
  word-break: break-word;
  overflow-wrap: break-word;

}
</style>
