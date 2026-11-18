# Launcher tabs

这是给鲸鲸 **4.1.2** 启动器加三栏的成品：

- `补丁` → `http://127.0.0.1:<port>/patch/`
- `图片` → `http://127.0.0.1:<port>/image-patch/`
- `生理` → `http://127.0.0.1:<port>/libido-patch/`

`files/` 是 **多文件、框架依赖** 构建（`WhaleLauncher.exe` + `.dll` + WebView2/NAudio DLL），
不是单文件自解压 exe；这样 Defender 不会把它当成自解压木马。

## 说明

- 三栏放在导航最上面（状态之后），不用滚到底部找；
- `补丁` / `图片` 页来自前面的补丁；没有装对应补丁时只显示“未连接”，不影响启动器；
- `生理` 页读取 `/api/libido/state`；
- 启动器代码基于上游 4.1.2，在 `MainWindow.xaml.cs` 里加导航项，并新增三个 `Views/*Page.xaml`。

## 重新构建

```powershell
# 先取上游 4.1.2
git clone --branch v4.1.2 https://github.com/Banan1cee/whale_girl.git whale_girl
# 将本仓库 launcher/ 下三个页面与 MainWindow 导航改动合入上游 launcher
dotnet publish launcher/WhaleLauncher.csproj -c Release -o out `
  -p:PublishSingleFile=false -p:SelfContained=false
```

安装器会把 `files/` 复制到鲸鲸根目录，并备份原来的 `WhaleLauncher.exe`。
