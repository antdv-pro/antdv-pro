<div align="center"> 
<a href="https://github.com/antdv-pro/antdv-pro"> 
<img alt="Wendy Panel" width="300" height="300" src="./public/wendy.png">
</a> 
<br>

![GitHub](https://img.shields.io/github/license/dstgo/wendy-pro)

<h1>Wendy Panel</h1>

</div>

**English** | [简体中文](./README.md)



## Introduce

Wendy Panel is a distributed Don't Starve Together management panel, used to manage dedicated servers of [Don't Starve Together on Steam](https://store.steampowered.com/app/322330/_/), based on the modern front-end project [antdv -pro](https://github.com/antdv-pro/antdv-pro) implementation, which is based on technologies such as Vue3, Vite4, ant-design-vue4, Pinia, UnoCSS and Typescript. Through Wendy Panel, you can quickly build a Don't Starve server management platform and make it very convenient to maintain and manage. This is the ultimate solution for the Don't Starve server management platform.



Document: [Home | Wendy Panel (dstgo.cn)](https://wendy.dstgo.cn/)

Backend: [dstgo/wilson: open source distributed Game Server web manager](https://github.com/dstgo/wilson)

Daemon: [dstgo/wigfrid](https://github.com/dstgo/wigfrid)



## Features

- **Containerization**: Each dedicated server is a container instance. The instances run in isolation from each other and do not interfere with each other.
- **Resource Limitation**: By limiting the resource usage of the container, you can avoid excessive consumption of host resources by instances.
- **Elastic Management**: Flexible allocation of resources for instances and hot update of resource specifications.
- **Distributed**: Distributed management of containers on multiple machine nodes.
- **Open Interface**: Open interface support for third parties to call.



## Development

```bash
# Install dependencies
pnpm install

# Startup project
pnpmdev
```



## contribute

1. Fork to your own warehouse
2. Submit the modified code
3. Push to your own warehouse
4. Submit PR to this warehouse
5. Wait for pr to be merged
