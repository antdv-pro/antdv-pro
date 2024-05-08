<script setup>
const number = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
const list = shallowRef([
  {
    name: '全部',
    key: 'all',
  },
  ...number.map((v, index) => ({
    name: `类目${v}`,
    key: `category${index + 1}`,
  })),
])
const activeList = ref([])
function handleClick(item) {
  if (item.key === 'all') {
    if (activeList.value.includes('all')) {
      activeList.value = []
      return
    }
    else {
      activeList.value = list.value.map(v => v.key)
    }
    return
  }
  if (activeList.value.includes(item.key)) {
    activeList.value = activeList.value.filter(v => v !== item.key)
    if (activeList.value.includes('all'))
      activeList.value = activeList.value.filter(v => v !== 'all')
  }
  else {
    activeList.value = [...activeList.value, item.key]
    if (activeList.value.length === list.value.length - 1)
      activeList.value = [...activeList.value, 'all']
  }
}
const authorList = shallowRef([
  {
    label: '付晓晓',
    value: '付晓晓',
  },
  {
    label: '周毛毛',
    value: '周毛毛',
  },
])
const praiseList = shallowRef([
  {
    label: '优秀',
    value: 1,
  },
  {
    label: '普通',
    value: 2,
  },
])
</script>

<template>
  <a-card :bordered="false">
    <a-form>
      <a-form-item label="所属类目">
        <div class="flex flex-wrap gap-2">
          <a-tag
            v-for="item in list"
            :key="item.key"
            cursor-pointer
            :color="activeList.includes(item.key) ? '#108ee9' : ''"
            @click="handleClick(item)"
          >
            {{ item.name }}
          </a-tag>
        </div>
      </a-form-item>
      <a-divider dashed />
      <a-form-item label="其他选项">
        <a-form-item-rest>
          <div class="flex gap-4 category-other-item">
            <a-form-item label="作者">
              <a-select placeholder="不限" style="width: 100px" :options="authorList" />
            </a-form-item>
            <a-form-item label="好评度">
              <a-select placeholder="不限" style="width: 100px" :options="praiseList" />
            </a-form-item>
          </div>
        </a-form-item-rest>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<style lang="less">
.category-other-item{
  .ant-form-item{
    margin-bottom: 0;
  }
}
</style>
