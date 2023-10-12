<div align="center"> 
<a href="https://github.com/antdv-pro/antdv-pro"> 
<img alt="Wendy Panel" width="300" height="300" src="./public/wendy.png">
</a> 
<br>

![GitHub](https://img.shields.io/github/license/dstgo/wendy-pro)

<h1>Wendy Panel</h1>

</div>

[English](./README.en.md) | **简体中文**




## 介绍

Wendy Panel是一个分布式饥荒管理面板，用于管理[Steam上的饥荒联机版](https://store.steampowered.com/app/322330/_/)的专用服务器，基于现代化的前端项目[antdv-pro](https://github.com/antdv-pro/antdv-pro)实现，后者基于于Vue3、Vite4、ant-design-vue4、Pinia、UnoCSS和Typescrip等技术。通过Wendy Panel可以快速搭建饥荒服务器管理平台，并非常方便的进行维护和管理，这是饥荒服务器管理平台的最终解决方案。



文档地址：[Home | Wendy Panel (dstgo.cn)](https://wendy.dstgo.cn/)

后端项目：[dstgo/wilson: open source distributed Game Server web manager](https://github.com/dstgo/wilson)

守护进程：[dstgo/wigfrid](https://github.com/dstgo/wigfrid)



## 特性

- **容器化**：每一个专用服务器就是一个容器实例，实例之间相互运行隔离，互不干扰。
- **资源限制**：通过限制容器的资源使用，可以避免实例对宿主机的资源的过度消耗。
- **弹性管理**：实例的资源弹性分配，资源规格热更新。
- **分布式**：分布式管理多个机器节点上的容器。
- **开放接口**：开放接口支持，以供第三方进行调用。



## 开发

```bash
# 安装依赖
pnpm install

# 启动项目
pnpm dev
```



## 贡献

1. fork到自己仓库
2. 提交修改的代码
3. 推送到自己的仓库
4. 向本仓库提交pr
5. 等待pr被merge

