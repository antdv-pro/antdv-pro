# 项目介绍

## 简介

[AntdAdminPro](https://github.com/antd-tiny-vue/antdv-admin-pro)是一个基于Vue3、Vite4、ant-design-vue4、Pinia、UnoCSS和Typescript的一整套企业级中后台前端/设计解决方案，它延用了阿里react版本antd-pro的设计模式，使用了最新最流行的前端技术栈，内置了动态路由、多主题、多布局等功能，可以帮助你快速搭建企业级中后台产品原型。

## 特性

* pnpm：使用了最新的pnpm作为包管理工具，它可以大大减少node_modules的体积，加快包的安装速度，同时还可以共享依赖，减少磁盘占用。
* vite：vite作为前端开发工具，它可以大大加快项目的启动速度，同时还支持热更新，可以大大提高开发效率。
* vue3：vue3作为前端框架，基础代码全部使用script-setup的写法，代码量少维护成本低。
* ant-design-vue4：ant-design-vue4作为UI框架，admin-pro的作者也是ant-design-vue的核心成员，可提供长期的维护支持。
* pinia：pinia作为状态管理工具，它可以大大提高代码的可读性和可维护性，同时还支持Typescript。
* UnoCSS：原子化的CSS框架，减少我们去想一些通用类名带来的烦恼，提升我们的开发效率。
* 代码规范：我们封装了一套基于eslint的代码规范配置文件，开箱即用，统一不同团队所带来的问题。
* 主题：延用了react版本的antd-pro的设计规范，开发了一套基于vue的主题模式，在此基础上增加了一些新的功能，尽可能的满足各种不同的需求。
* 请求函数：基于axios封装了一套具有完善类型的请求函数，以及一些基础的拦截器的封装，只需要按照需求做对应的实现调整就能满足各种项目带来的不一样的需求。
* 移动端兼容：基础框架部分我们尽可能的对移动端的模式进行了兼容处理，但是由于我们的主要目标是企业级中后台产品，所以我们并没有对移动端做过多的适配，如果你的项目需要移动端的适配，可以参考我们的代码进行相应的调整。

## 浏览器支持


本地调试开发推荐使用最新的`Chrome`浏览器。

由于`vue3`本身对`IE`浏览器不在兼容，所以我们的项目不支持`IE`

浏览器的支持情况如下：

| <img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png" width="24px" height="24px" alt="Chrome"> | <img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png" width="24px" height="24px" alt="Firefox"> | <img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" width="24px" height="24px" alt="Edge"> | <img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png" width="24px" height="24px" alt="Safari"> | <img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/opera/opera_48x48.png" width="24px" height="24px" alt="Opera"> |
| :---------: | :---------: | :---------: | :---------: | :---------: |
| last 2 versions | last 2 versions | last 2 versions | last 2 versions | last 2 versions |


## 参与贡献

[AntdAdminPro](https://github.com/antd-tiny-vue/antdv-admin-pro)目前还在快速的迭代的过程中，本项目欢迎您的参与、共同维护、逐步完善，让我们一起打造一套更好的企业级中后台前端/设计解决方案。

:::tip 如何加入我们

目前还在不断的迭代更新中，非常欢迎大家的参与贡献，贡献的方式有很多种，比如：

1. 长期提交`PR`的同学。
2. 长期处理`issue`且活跃的同学。
3. 对文档进行长期活跃维护的同学。
:::


:::danger 参与开源需要注意以下几点：

🔴 不是所有的`PR`都会被合并，如果您是玻璃心，不建议参与我们的开源项目。

🔴 不是所有的`issue`都会被处理，我们会分析这个`issue`是否有必要解决，如果没有，我们会给出原因并关闭这个`issue`。

🔴 项目是完全开源的，遇到任何问题可以先尝试自己去解决，如果实在解决不了，可以提`issue`并提供可复现的最小`demo`，我们会尽快处理和解决。

:::

## 声明

项目采用`MIT`开源协议，本着开源免费的精神，原则上不会收取任何费用以及版本费用，可以放心使用。
