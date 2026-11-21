# v1.0.2 · 适配鲸鲸 4.1.7.1

> **18+ 成人向状态模拟。** 只给成年人自己的私聊/角色扮演使用。

## 更新

- 适配基础软件 **4.1.7.1**：
  - `Store.buildContext` 注入仍有效；
  - `createRuntime` / `createRouter` 钩子仍有效；
  - 面板 API `/api/libido/state` 不变。
- 启动器换成 4.1.7.1 三栏版：
  - **补丁 / 图片 / 生理**；
  - 多文件、框架依赖构建，Defender 扫描无威胁。
- 安装器基础版本提示改为 4.1.7.1。
- 状态引擎、面板和提示词规则不变。

## 安装

1. 先装鲸鲸 4.1.7.1；
2. 下载 ZIP 解压，双击 `install.cmd`；
3. 完全退出鲸鲸再打开；
4. 左侧「生理」栏 / `http://127.0.0.1:8787/libido-patch/`。

## 数据

`data/whale-libido.json`、`data/whale-libido-config.json`、`config.json` 不会被覆盖。
安装前建议备份整个 `data/`。
