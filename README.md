# SKYFORGE · 网页试玩

点开链接即可体验的 3D 战机射击 Demo。无需安装 Godot、下载客户端或注册账号。

**试玩：https://hxz09845.github.io/skyforge-play/**

![手机布局示例](preview.png)

## 玩法与操作

击毁敌机，靠近掉落物升级火力、射速和僚机。第一波选择散射、激光或僚机路线，第三波选择一次改装，完成五波后挑战首领。

手机横屏：左侧摇杆移动，自动锁敌射击，右侧按钮释放技能。电脑：WASD 移动，默认自动向前射击；F 切换鼠标瞄准与左键射击，Q 清弹，Esc 暂停。

可选安全教学，死亡或通关后可重开。装备与路线记录仅在本次游玩进程中保留。分享和全屏按钮位于页面右下角。

## 支持范围与限制

已验证桌面 Chromium 网页启动、中文显示、战斗、手机尺寸布局和触控输入模拟。原生引擎检查共 282 项通过。尚未完成 Android/iPhone 真机、Safari 与抖音内置浏览器验证。

浏览器需要 WebAssembly 和 WebGL 2。首次加载需要下载引擎与游戏资源。若抖音内不能打开外链，请复制地址到系统浏览器；本发布物是网页试玩版，未接入抖音小游戏。

## 本地预览与发布

本仓库是编译后的试玩站点。安装 Python 3 后执行：

```sh
python3 scripts/validate_site.py
python3 -m http.server 8080
```

用浏览器打开 http://localhost:8080。触控布局检查可追加 `?touch=1`。Godot 原始工程的构建使用 Godot 4.7.2、无多线程 Web 模板和 `godot --headless --export-release Web builds/web/index.html`；原始工程由项目维护者另行管理。

推送 codex/web-play 分支后，Pages 工作流校验运行资源，再部署到 GitHub Pages。此站点由 HTML 加载器、Godot JavaScript/WASM 引擎和 PCK 游戏资源组成，无后端、登录或支付功能。

## 反馈与维护

发现问题请通过 Issue 提供手机型号、浏览器、打开入口及复现步骤。参见 [贡献说明](CONTRIBUTING.md)、[路线图](ROADMAP.md)、[更新记录](CHANGELOG.md)、[安全说明](SECURITY.md)。

## 许可

本试玩站点提供个人体验。原创游戏内容权利由项目所有者保留，参见 [LICENSE](LICENSE)。Godot 及其依赖遵循各自开源许可，字体源自 Noto Sans SC，按 SIL OFL 1.1 使用；参见 [第三方说明](licenses/README.md)。
