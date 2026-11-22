# v1.0.3 · 适配鲸鲸 4.1.8

> **18+ 成人向状态模拟。** 只给成年人自己的私聊/角色扮演使用。

## 更新

- 适配基础软件 **4.1.8**：
  - `Store.buildContext` 注入有效；
  - `createRuntime` / `createRouter` 钩子有效；
  - 面板 `/api/libido/state` 不变。
- 启动器换成 4.1.8 三栏版：
  - **补丁 / 图片 / 生理**；
  - 多文件、框架依赖构建，Defender 扫描无威胁。
- 安装器基础版本提示改为 4.1.8。

## 安装

1. 先装鲸鲸 4.1.8；
2. 下载 ZIP 解压，双击 `install.cmd`；
3. 完全退出鲸鲸再打开；
4. 左侧「生理」栏 / `http://127.0.0.1:8787/libido-patch/`。

`data/whale-libido.json`、`data/whale-libido-config.json`、`config.json` 不会被覆盖。
