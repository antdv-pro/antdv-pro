import { defineComponent } from 'vue'
import { Layout, LayoutContent, LayoutHeader } from 'ant-design-vue/es'
export default defineComponent({
  name: 'ProLayout',
  setup(_, { slots }) {
    return () => {
      return (
        <Layout>
          <LayoutHeader>
            {/*  */}
          </LayoutHeader>
          <LayoutContent>{ slots.default?.() }</LayoutContent>
        </Layout>
      )
    }
  },
})
