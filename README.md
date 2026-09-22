# NutriTrack / 饮食记录

一个简体中文、离线优先的 Android / iOS 饮食日记。记录食物与份量，自动计算热量和营养，用趋势图回看自己的饮食变化。不需要账号，不连接业务服务器。

## 快速运行

需要 Node.js 24 LTS（测试使用内置 `node:sqlite`）、npm，以及手机或模拟器。

```sh
npm ci
npm start
```

使用支持 Expo SDK 57 的 Expo Go 扫描终端二维码。电脑和手机需要能相互访问；首次开发加载需要电脑运行 Metro。独立安装并离线长期使用请构建下方的安装包。

```sh
npm run android   # 已启动的 Android 模拟器，或连接的手机
npm run ios       # macOS + Xcode + iOS 模拟器
npm run web       # 可选浏览器预览，仍使用 SQLite WASM
```

技术版本采用 Expo 官方 SDK 57 模板及其兼容表：Expo 57、React Native 0.86、React 19.2、TypeScript 严格模式、Expo Router、expo-sqlite、react-native-gesture-handler、Reanimated、react-native-svg、react-native-pager-view 和 react-native-tab-view。`package-lock.json` 固定实际依赖，勿单独升级 React Native。参考 [SDK 57 文档](https://docs.expo.dev/versions/v57.0.0/) 和 [SQLite 文档](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)。

## 构建可安装 App

仓库包含 `eas.json`，`preview` 构建生成 Android APK，`production` 生成商店发布产物。首次需使用自己的 Expo 账号完成 EAS 项目关联。

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

Android 构建完成后下载 APK 安装；iOS 真机内部安装需要 Apple 开发者账号、签名及设备注册。此仓库未包含签名凭据，也未上传到商店。Windows 无法本机构建 iOS，可以使用 EAS 或 macOS。

本地 Android 构建需自行安装匹配的 Android SDK / JDK：

```sh
npx expo run:android
# macOS:
npx expo run:ios
```

包名为 `app.nutritrack.diary`，正式发布前可改为自己的唯一标识。独立安装包内包含 JS 代码，首次初始化与之后记饮食均不需要网络。

## 已实现

- 今天及任意历史日期：本地日历、昨天 / 今天 / 前一天 / 后一天；每日和每餐合计，空状态。
- 今天页的餐次默认独立折叠并显示热量与三大营养汇总；展开后可点食物编辑，也可左滑单条记录露出删除按钮。
- 5 个默认餐次；新增、改名、排序、归档自定义餐次。
- 20 种演示食物；按名称和品牌搜索，紧凑分页列表、最近吃过、收藏、我的食物；默认食物和自定义食物都支持编辑与软删除。
- 自定义食物创建 / 编辑 / 软删除；每 100g、每 100ml、每份营养标签，默认单位及单位重量。
- g、ml、个、份换算和实时预览；修改数量 / 单位 / 餐次，通过详情删除记录。
- 从餐次进入食物列表时，点吃过的食物会按最新记录的数量和单位直接添加并留在列表；首次食用仍进入详情，右侧箭头始终可手动调整。
- 热量、蛋白质、碳水、脂肪及饱和脂肪、纤维、糖、钠快照。
- 7 / 30 / 90 天及自定义范围（最多 366 天），四指标 SVG 曲线，点击数据点、日均、记录天数、最高 / 最低。
- 可选每日目标与进度，空目标不显示进度；超额显示差值。
- 复制所选日期的前一天饮食，确认后追加；重复复制会重复追加。
- 浅色 / 深色 / 跟随系统；蓝、靛蓝、紫、橙、红、绿、中性灰 7 种独立持久化强调色；扩展营养显示设置。
- 四个主页面可跟随手指横滑切换，底部 Tab 同步；嵌套横向筛选和趋势图会接管手势，页面滚动位置在切换后保留。
- JSON 全量导出、CSV 饮食记录导出；原生分享面板，浏览器下载。
- SQLite 初始化、事务迁移、索引、查询串行队列、失败重试。

初始安装只创建食物库与餐次，不写入虚假的个人饮食记录。示例数值不能代表所有品牌、烹饪方式或食材，请以实际包装为准。示例食物的扩展营养未采集，初始值为 0，不应解读为经检测不含该营养素；自定义食物可填写完整标签。

## 目录

```text
app/                  Expo Router 路由和四个 Tab
components/           主题 UI、横滑 Tab、营养摘要、日历、SVG 图表
features/foods/       搜索和食物列表
hooks/                App Context、按查询键读取、互斥保存操作
database/             SQL 适配接口、队列、迁移、独立演示数据
repositories/         应用数据访问与 FoodDataProvider
services/             营养计算、日期统计、导出及原生分享
types/                严格类型的数据模型
utils/                本地日期工具
theme/                中性色表面、7 种强调色及系统字体
i18n/                 zh-CN 字符串字典
tests/                核心逻辑和真实 SQLite 测试
tests/e2e/            手机尺寸浏览器交互验收
scripts/              带 SQLite 所需响应头的本地预览服务器
```

状态使用 React Context，保存后增加 `revision` 使相关查询失效；日期保存在内存，用户设置保存在 SQLite。查询按日期、日期范围或 40 条食物分页读取。全部食物按使用次数、最近记录时间、名称排序；“最近吃过”只按最近记录时间排序。使用次数来自 `FoodEntry` 数量，编辑原记录不会新增使用次数，复制和新增记录会计数。

## 数据库与历史保护

数据库文件为应用私有目录的 `nutritrack.db`。

| 表            | 内容                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| Food          | 名称、品牌、营养基准、营养字段、默认单位、每份重量、液体密度、收藏、软删除和时间戳   |
| MealType      | 名称、顺序、默认标记、软删除和创建时间                                               |
| FoodEntry     | 日期、食物 / 餐次 ID、数量、单位、换算重量、全部营养快照、热量来源、原食物 JSON 快照 |
| NutritionGoal | 当前每日目标；空值表示未设置                                                         |
| AppSettings   | 主题和扩展营养显示等键值设置                                                         |

所有记录使用本地 `YYYY-MM-DD` 日期，不通过 UTC 截取日期，避免中国时区午夜错日。时间戳使用 ISO UTC。FoodEntry 持有完整营养快照，修改 Food 不会重算历史；编辑旧记录的份量仍使用旧食物快照。

删除食物（包括示例食物和自定义食物）/ 餐次只写入 `deletedAt`。历史仍可读，归档餐次在有记录的日期显示，可以进入条目更换餐次。默认餐次允许改名和排序，不可删除。删除饮食记录才物理删除对应 FoodEntry。

WAL、外键约束、日期 / 食物 / 餐次索引均在初始化建立。v3 增加 `(foodId, createdAt DESC)` 索引；v4 追加 `(foodId, date DESC, createdAt DESC, id DESC)`，供最近一次份量查询使用。所有业务 SQL 通过一个队列执行，事务失败回滚；用户输入以参数绑定传入。迁移与全量导出在事务内完成。

## 营养算法

`services/nutrition.ts` 统一处理换算，不在 UI 内分散公式。

1. g：重量为数量本身。
2. ml：数量 × `gramsPerMl`。默认 1；需要时按实际密度修改。
3. 个 / 份：数量 × `gramsPerUnit`。第一版“个”和“份”共用同一个重量，可为不同规格建立不同食物。
4. 将营养标签的 `baseAmount`、`baseUnit` 同样转克，摄入营养 = 标签营养 × 摄入克数 / 标签基准克数。
5. `calories !== null` 优先用标签热量（包括明确填写的 0）；否则蛋白质 × 4 + 碳水 × 4 + 脂肪 × 9，快照标记 `estimated`。

例如牛奶按每 100ml 标注，250ml 使用 2.5 倍；鸡蛋每个 50g，3 个按 150g。数据库保留 JS 数值精度，仅显示时热量取整数，宏量营养保留一位小数。目标条限制在 0–100%，数值继续显示真实摄入。

趋势只查询指定范围，然后补齐日期。未记录日期显示曲线缺口，均值、最高和最低只统计有记录日期；有明确 0 kcal 记录的日期参与统计。较长范围图表可横向滚动。

## 增加迁移

在 `database/migrations.ts` 的 `migrations` 数组末尾增加一项 SQL，不修改已经发布的迁移。`PRAGMA user_version` 是版本号，当前为 4。每次启动读取版本并按顺序升级，迁移和种子数据在同一事务执行。失败回滚、保留数据并显示重试；新版数据库不能由旧版应用静默打开。为每次新迁移补充旧版升级测试。

## 增加食物来源

实现 `repositories/FoodDataProvider.ts` 中的 `search` / `searchWithUsage` / `get` 接口。当前 LocalFoodProvider 用一条参数化 SQL 聚合 `COUNT(FoodEntry.id)` 和 `MAX(FoodEntry.createdAt)`，页面不在 JavaScript 中重复排序。未来可以添加远程、条码或 AI Provider；先将选中的外部食物以稳定 ID 落地本地 Food 表，再创建 FoodEntry，以满足外键和离线快照。页面的食物查询入口为 `repo.foods`，在线聚合和缓存应放在该边界，不放进页面。

## 检查与验收

本次执行结果及原生验收边界见 [VERIFICATION.md](./VERIFICATION.md)。

```sh
npm run check                 # TypeScript、ESLint、核心测试
npx expo install --check      # Expo 依赖兼容检查，需要网络或离线缓存
npx expo export --platform all # Android / iOS / Web JS 产物
npx playwright install chromium
npx playwright test           # 先 export，测试自动启动本地静态预览
```

单元和集成测试使用 Node 内置真实 SQLite，不用内存对象模拟 SQL，覆盖换算、目标、统计、历史快照、CRUD、日期隔离、复制、软删除、v2→v4 无损升级、最新份量索引、并发快速添加、SQL 使用频率排序、事务回滚和关闭重开文件。AST 回归测试会拒绝原生宿主组件中的裸文本。E2E 采用 Chromium 的 390×844 视口和 Expo SQLite WASM，并验证 9 种强调色、餐食独立折叠、快速添加与撤销、FoodEntry 左滑互斥删除、手指跟随横滑、Tab 同步、嵌套手势和滚动位置保留；它不替代原生键盘、系统分享、真机重启或签名安装验收。

Web SQLite 在 Expo 中属于实验支持，需 `SharedArrayBuffer`、WASM 和跨源隔离响应头。`metro.config.js` 和本地 `scripts/serve-web.mjs` 已配置。手机 App 的 SQLite 不依赖这些浏览器设置。长期使用以原生安装为主。

## 数据与后续计划

数据不会主动上传。卸载 App 会清除本地记录，建议定期从设置导出。JSON 包含食物、餐次、营养快照、目标和设置；CSV 适合查看和分析。目前没有一键导入恢复界面。

后续可在现有数据边界增加账号 / 同步、HealthKit / Health Connect、条码、在线数据库、AI 识别、JSON 导入恢复及多规格单位。第一版不含登录、服务器、支付、社交或广告。
