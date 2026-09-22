# 验收记录

日期：2026-09-15。环境：Windows、Node.js 24.16.0、Expo SDK 57。

| 检查 | 结果 |
| --- | --- |
| TypeScript 严格检查 | 通过 |
| ESLint | 通过 |
| 核心逻辑 / 真实 SQLite / 原生文本回归测试 | 22 / 22 通过 |
| 手机尺寸浏览器端到端测试 | 10 / 10 通过 |
| Android Hermes bundle | 生成成功 |
| iOS Hermes bundle | 生成成功 |
| Web bundle 与 SQLite WASM worker | 生成成功 |
| Expo 开发服务器与运行时巡检 | 通过；浏览器控制台无 warning / error |
| Expo SDK 57 在线依赖兼容检查 | 通过；Dependencies are up to date |

交互验收覆盖：50g 燕麦、250ml 牛奶、3 个鸡蛋录入，60g 荞麦面实时营养预览；历史食物使用最近 amount / unit 原子快速添加、停留列表、Toast 撤销、连续双击逐条写入、独立详情入口修改数量；食物列表在 390×844 视口保留完整营养信息且第 7 行可见；餐食首次默认折叠、四项营养汇总、多个餐食独立展开；FoodEntry 左滑只露出 84dp 删除按钮、互斥、折叠关闭、点按钮才删除且总量立即刷新；三个点菜单复制 / 清空继续工作；刷新后重新选择历史日期验证持久化，趋势指标切换和点选；320px 日历及非法日期范围；目标、自定义餐次、自定义食物、收藏、9 种强调色与明暗模式独立持久化、JSON 下载；主页面手指跟随横滑、Tab 同步、嵌套横向控件及 FoodEntry 手势隔离、纵向滚动和页面滚动位置保留。

SQLite 测试覆盖数据库重开、v2→v4 数据和设置无损升级、最新份量的日期 / 创建时间排序、并发快速添加、组合索引查询计划、事务回滚、搜索、按使用次数 / 最近时间排序、默认与自定义食物编辑、软删除、历史快照和 CSV 转义。AST 测试扫描 `app/`、`components/`、`features/`、`hooks/`，防止裸字符串重新进入非 Text 原生宿主。浏览器测试不使用模拟的食品仓储，而是运行真实 Expo SQLite WASM；额外运行时巡检遍历四个 Tab 并完成一次食物预览 / 保存，浏览器控制台无 warning、error 或 pageerror。

## 尚未执行的原生验收

本机没有 Android SDK / adb，且 Windows 不能本机构建 iOS；没有执行 APK / IPA 签名构建或真机安装。因此上表的 Android / iOS 结果指 JavaScript / Hermes 产物，不代表已生成安装包。

仓库提供 `eas.json` 的 APK 内部分发配置。后续在具备 Android 工具链或 EAS / Apple 签名环境时，按 README 构建并验证：真机冷启动、离线记录、退出重进、系统键盘避让、原生分享面板和数据库随应用升级保留。

截图在 `test-results/`（本地生成，未纳入版本控制）。重新执行测试会更新它们。
