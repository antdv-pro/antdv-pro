<script setup>
import { LikeOutlined, MessageOutlined, StarOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import Category from './components/category.vue'

const list = [
  {
    id: 'fake-list-0',
    owner: '付小小',
    title: 'Alipay',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/uMfMFlvUuceEyPpotzlq.png',
    status: 'active',
    percent: 63,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
    href: 'https://ant.design',
    updatedAt: 1693310380201,
    createdAt: 1693310380201,
    subDescription: '那是一种内在的东西， 他们到达不了，也无法触及的',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 134049,
    newUser: 1402,
    star: 160,
    like: 171,
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
    id: 'fake-list-1',
    owner: '曲丽丽',
    title: 'Angular',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/iZBVOIhGJiAnhplqjvZW.png',
    status: 'exception',
    percent: 72,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png',
    href: 'https://ant.design',
    updatedAt: 1693303180201,
    createdAt: 1693303180201,
    subDescription: '希望是一个好东西，也许是最好的，好东西是不会消亡的',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 184058,
    newUser: 1528,
    star: 153,
    like: 102,
    message: 18,
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
    percent: 71,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/dURIMkkrRFpPgTuzkwnB.png',
    href: 'https://ant.design',
    updatedAt: 1693295980201,
    createdAt: 1693295980201,
    subDescription: '生命就像一盒巧克力，结果往往出人意料',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 191811,
    newUser: 1067,
    star: 106,
    like: 172,
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
    id: 'fake-list-3',
    owner: '周星星',
    title: 'Ant Design Pro',
    avatar: 'https://gw.alipayobjects.com/zos/rmsportal/sfjbOqnsXXJgNCjCzDBL.png',
    cover: 'https://gw.alipayobjects.com/zos/rmsportal/gLaIAoVWTtLbBWZNYEMg.png',
    status: 'active',
    percent: 86,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/sfjbOqnsXXJgNCjCzDBL.png',
    href: 'https://ant.design',
    updatedAt: 1693288780201,
    createdAt: 1693288780201,
    subDescription: '城镇中有那么多的酒馆，她却偏偏走进了我的酒馆',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 152005,
    newUser: 1424,
    star: 147,
    like: 103,
    message: 20,
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
    percent: 54,
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/siCrBXXhmvTQGWPNLBow.png',
    href: 'https://ant.design',
    updatedAt: 1693281580201,
    createdAt: 1693281580201,
    subDescription: '那时候我只会想自己想要什么，从不想自己拥有什么',
    description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式，但其中往往存在很多类似的页面和组件，这些类似的组件会被抽离成一套标准规范。',
    activeUser: 141857,
    newUser: 1861,
    star: 135,
    like: 113,
    message: 13,
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
function formatTimer(timer) {
  return dayjs(timer).format('YYYY-MM-DD HH:mm:ss')
}
</script>

<template>
  <div>
    <Category />
    <a-card :bordered="false" class="mt-4">
      <a-list :data-source="list" item-layout="vertical">
        <template #renderItem="{ item }">
          <a-list-item :key="item.id">
            <template #actions>
              <span>
                <StarOutlined /> {{ item.star }}
              </span>
              <span>
                <LikeOutlined /> {{ item.like }}
              </span>
              <span>
                <MessageOutlined /> {{ item.message }}
              </span>
            </template>
            <a-list-item-meta style="margin-bottom: 0">
              <template #title>
                {{ item.title }}
              </template>
            </a-list-item-meta>
            <div class="flex flex-col gap-2">
              <div>
                <a-tag>
                  Ant Design Vue
                </a-tag>
                <a-tag>
                  设计语言
                </a-tag>
                <a-tag>
                  蚂蚁金服
                </a-tag>
              </div>
              <div>{{ item.content }}</div>
              <div class="flex items-center gap-2">
                <a-avatar :src="item.avatar" :size="22" />
                <span c-primary>
                  {{ item.owner }}
                </span>
                <span c-text-tertiary>
                  发布在
                </span>
                <a href="https://antdv-pro.com" c-primary hover="c-primary-hover">https://antdv-pro.com</a>
                <span c-text-tertiary>
                  {{ formatTimer(item.updatedAt) }}
                </span>
              </div>
            </div>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
</template>
