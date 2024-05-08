<script setup>
import Category from './components/category.vue'

const list = [
  {
    id: 'fake-list-0',
    owner: '付小小',
    title: 'Alipay',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/uMfMFlvUuceEyPpotzlq.png',
    status: 'active',
    percent: 77,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
    href: 'https://ant.design',
    updatedAt: 1693311806623,
    createdAt: 1693311806623,
    subDescription: '那是一种内在的东西， 他们到达不了，也无法触及的',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 151434,
    newUser: 1224,
    star: 168,
    like: 114,
    message: 14,
    content: '段落示意：蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。',
    members: [
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
        name: '曲丽丽',
        id: 'member1',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
        name: '王昭君',
        id: 'member2',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
        name: '董娜娜',
        id: 'member3',
      },
    ],
  },
  {
    id: 'fake-list-1',
    owner: '曲丽丽',
    title: 'Angular',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/iZBVOIhGJiAnhplqjvZW.png',
    status: 'exception',
    percent: 92,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png',
    href: 'https://ant.design',
    updatedAt: 1693304606623,
    createdAt: 1693304606623,
    subDescription: '希望是一个好东西，也许是最好的，好东西是不会消亡的',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 127745,
    newUser: 1714,
    star: 158,
    like: 133,
    message: 19,
    content: '段落示意：蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。',
    members: [
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
        name: '曲丽丽',
        id: 'member1',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
        name: '王昭君',
        id: 'member2',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
        name: '董娜娜',
        id: 'member3',
      },
    ],
  },
  {
    id: 'fake-list-2',
    owner: '林东东',
    title: 'Ant Design',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/dURIMkkrRFpPgTuzkwnB.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/iXjVmWVHbCJAyqvDxdtx.png',
    status: 'normal',
    percent: 62,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/dURIMkkrRFpPgTuzkwnB.png',
    href: 'https://ant.design',
    updatedAt: 1693297406623,
    createdAt: 1693297406623,
    subDescription: '生命就像一盒巧克力，结果往往出人意料',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 163034,
    newUser: 1139,
    star: 129,
    like: 141,
    message: 15,
    content: '段落示意：蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。',
    members: [
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
        name: '曲丽丽',
        id: 'member1',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
        name: '王昭君',
        id: 'member2',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
        name: '董娜娜',
        id: 'member3',
      },
    ],
  },
  {
    id: 'fake-list-3',
    owner: '周星星',
    title: 'Ant Design Pro',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sfjbOqnsXXJgNCjCzDBL.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/gLaIAoVWTtLbBWZNYEMg.png',
    status: 'active',
    percent: 96,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/sfjbOqnsXXJgNCjCzDBL.png',
    href: 'https://ant.design',
    updatedAt: 1693290206623,
    createdAt: 1693290206623,
    subDescription: '城镇中有那么多的酒馆，她却偏偏走进了我的酒馆',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 129450,
    newUser: 1222,
    star: 191,
    like: 169,
    message: 14,
    content: '段落示意：蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。',
    members: [
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
        name: '曲丽丽',
        id: 'member1',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
        name: '王昭君',
        id: 'member2',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
        name: '董娜娜',
        id: 'member3',
      },
    ],
  },
  {
    id: 'fake-list-4',
    owner: '吴加好',
    title: 'Bootstrap',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/siCrBXXhmvTQGWPNLBow.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/gLaIAoVWTtLbBWZNYEMg.png',
    status: 'exception',
    percent: 71,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/siCrBXXhmvTQGWPNLBow.png',
    href: 'https://ant.design',
    updatedAt: 1693283006623,
    createdAt: 1693283006623,
    subDescription: '那时候我只会想自己想要什么，从不想自己拥有什么',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 157918,
    newUser: 1827,
    star: 120,
    like: 134,
    message: 17,
    content: '段落示意：蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。',
    members: [
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
        name: '曲丽丽',
        id: 'member1',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
        name: '王昭君',
        id: 'member2',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
        name: '董娜娜',
        id: 'member3',
      },
    ],
  },
  {
    id: 'fake-list-5',
    owner: '朱偏右',
    title: 'React',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/kZzEzemZyKLKFsojXItE.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/iXjVmWVHbCJAyqvDxdtx.png',
    status: 'normal',
    percent: 79,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/kZzEzemZyKLKFsojXItE.png',
    href: 'https://ant.design',
    updatedAt: 1693275806623,
    createdAt: 1693275806623,
    subDescription: '那是一种内在的东西， 他们到达不了，也无法触及的',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 187255,
    newUser: 1645,
    star: 200,
    like: 198,
    message: 15,
    content: '段落示意：蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。',
    members: [
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
        name: '曲丽丽',
        id: 'member1',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
        name: '王昭君',
        id: 'member2',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
        name: '董娜娜',
        id: 'member3',
      },
    ],
  },
  {
    id: 'fake-list-6',
    owner: '鱼酱',
    title: 'Vue',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ComBAopevLwENQdKWiIn.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/iZBVOIhGJiAnhplqjvZW.png',
    status: 'active',
    percent: 88,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/ComBAopevLwENQdKWiIn.png',
    href: 'https://ant.design',
    updatedAt: 1693268606623,
    createdAt: 1693268606623,
    subDescription: '希望是一个好东西，也许是最好的，好东西是不会消亡的',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 137325,
    newUser: 1106,
    star: 123,
    like: 155,
    message: 19,
    content: '段落示意：蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。',
    members: [
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
        name: '曲丽丽',
        id: 'member1',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
        name: '王昭君',
        id: 'member2',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
        name: '董娜娜',
        id: 'member3',
      },
    ],
  },
  {
    id: 'fake-list-7',
    owner: '乐哥',
    title: 'Webpack',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/nxkuOJlFJuAUhzlMTCEe.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/uMfMFlvUuceEyPpotzlq.png',
    status: 'exception',
    percent: 86,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/nxkuOJlFJuAUhzlMTCEe.png',
    href: 'https://ant.design',
    updatedAt: 1693261406623,
    createdAt: 1693261406623,
    subDescription: '生命就像一盒巧克力，结果往往出人意料',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 194936,
    newUser: 1036,
    star: 133,
    like: 175,
    message: 11,
    content: '段落示意：蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。蚂蚁金服设计平台 ant.design，用最小的工作量，无缝接入蚂蚁金服生态，提供跨越设计与开发的体验解决方案。',
    members: [
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
        name: '曲丽丽',
        id: 'member1',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
        name: '王昭君',
        id: 'member2',
      },
      {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
        name: '董娜娜',
        id: 'member3',
      },
    ],
  },
]
</script>

<template>
  <div>
    <Category />
    <div class="mt-4">
      <a-list :data-source="list" :grid="{ gutter: 16, xs: 1, sm: 2, md: 4, lg: 4, xl: 4, xxl: 4 }">
        <template #renderItem="{ item }">
          <a-list-item style="padding: 0">
            <a-card hoverable>
              <template #cover>
                <img :src="item.cover">
              </template>
              <a-card-meta :title="item.title">
                <template #description>
                  <div class="h-44px">
                    <a-typography-paragraph
                      :ellipsis="{ rows: 2 }"
                      :content="item.subDescription"
                    />
                  </div>
                </template>
              </a-card-meta>
              <div class="flex h-20px mt-16px mb--4px line-height-20px justify-between">
                <span c-text-tertiary>19 分钟前</span>
                <div>
                  <!--                  -->
                  <a-avatar-group>
                    <template v-for="avatar in item.members" :key="avatar.id">
                      <a-avatar :src="avatar.avatar" :size="22" />
                    </template>
                  </a-avatar-group>
                </div>
              </div>
            </a-card>
          </a-list-item>
        </template>
      </a-list>
    </div>
  </div>
</template>
