<script>
export default {
  data() {
    return {
      tableData: [
        { id: 10001, name: 'Test1', role: 'Develop', sex: 'Man', address: 'Shenzhen' },
        { id: 10002, name: 'Test2', role: 'Test', sex: 'Man', address: 'Guangzhou' },
        { id: 10003, name: 'Test3', role: 'PM', sex: 'Man', address: 'Shanghai' },
      ],
    }
  },
}
</script>

<template>
  <div>
    <vxe-table :data="tableData">
      <vxe-column type="seq" title="Seq" width="60" />
      <vxe-column field="name" title="Name" />
      <vxe-column field="role" title="Role" />
      <vxe-colgroup title="Group1">
        <vxe-column field="sex" title="Sex" />
        <vxe-column field="address" title="Address" />
      </vxe-colgroup>
    </vxe-table>
  </div>
</template>
