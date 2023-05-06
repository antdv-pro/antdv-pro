# 开始使用

## 环境要求

- [NodeJS](https://nodejs.org/en) >= 16.0.0
- [Pnpm](https://pnpm.io/zh/)(建议最新版本) >= 7.0.0
- [Git](https://git-scm.com/)


## 代码获取

1. 可以直接去`github`进行下载。
2. 可以直接`git clone`代码进行开发。
3. 可以使用`fork`代码到自己的仓库进行开发。
4. 可以使用`degit`进行下载(⭐️推荐)。

我们这里只演示第四种的使用方式：

```bash

# 安装degit
npm  i -g degit

# 拉取代码
degit antd-tiny-vue/antdv-admin-pro [your project name]

# 切换到项目目录
cd [your project name]

# 安装依赖

pnpm install
```

## 开发工具配置


### VSCode(⭐️推荐)


本项目推荐使用VSCode进行开发，需要安装的插件如下：

- [Vue Language Features (Volar) ](https://marketplace.visualstudio.com/items?itemName=Vue.volar) - Vue服务插件
- [TypeScript Vue Plugin (Volar) ](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) - Vue 的TS服务插件
- [Volar Takeover Mode](https://cn.vuejs.org/guide/typescript/overview.html#volar-takeover-mode) - Volar Takeover 模式配置
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - 代码规范工具
- [UnoCSS](https://marketplace.visualstudio.com/items?itemName=antfu.unocss) - unocss 写法提示插件

1. 配置对当前项目的`eslint`的自动保存。

在你的项目根目录下创建一个`.vscode/settings.json`的文件（如果存在这个文件，直接修改即可）。

```json
{
  "editor.codeActionsOnSave": {
        "source.fixAll": false, // 关闭全局自定义格式化
        "source.fixAll.eslint": true, // 开启eslint保存自动格式化
    },
}
```

开启后在修改代码后保存，会自动格式化代码。如果不能格式化，请检查是否与全局配置的`setting.json`文件冲突。

2. 代码爆红问题

如果你的代码爆红，可以尝试以下几种方式解决：

* 没有开启volar takeover模式。
* 没有禁用vetur插件。
* 重启vscode进入任意一个vue文件查看右下角是否显示`vue takeover`的标识，不显示代表没有配置成功

### WebStorm

使用最新版本的`webstorm`对`vue3 + ts5.x`的支持目前仍然存在一些问题，建议使用`VSCode`进行开发。

在webstorm中只需要配置eslint即可，在Settings中搜索：`Eslint`，然后做如下的配置：

![idea](/images/webstorm.png)

这样就完成了webstorm的保存项目自动格式化的功能。

## 目录结构

