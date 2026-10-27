# 血糖导出 · Glucose Export

一个基于 Expo 和 React Native 的 iPhone 工具，用于读取 Apple「健康」中的血糖记录，导出为 JSON 文件，并通过系统分享面板保存到「文件」或使用 AirDrop 分享。

目前仅支持 iOS，需要自行构建安装。血糖读取和文件生成均在设备本地完成，项目不包含数据上传逻辑。

## 环境要求

- Node.js 20.19.4 或更高版本、npm。
- macOS、Xcode、CocoaPods。
- 可用于 HealthKit 的 Apple 开发签名。
- 已连接电脑、解锁并开启开发者模式的 iPhone。

项目包含原生 HealthKit 模块，无法通过 Expo Go 运行。

## 安装与运行

1. 安装依赖：

   ```sh
   npm ci
   ```

2. 在 `app.json` 中将 `ios.bundleIdentifier` 的示例值 `com.example.glucoseexport` 改为自己的唯一 Bundle ID。

3. 生成并打开 iOS 工程：

   ```sh
   npx expo prebuild --platform ios
   open ios/*.xcworkspace
   ```

   在 Xcode 的 **Signing & Capabilities** 中启用 **Automatically manage signing**，并选择自己的 Team。仓库不预设 `ios.appleTeamId`，本机签名配置保存在被 Git 忽略的 `ios/` 工程中。

4. 编译开发包，选择连接的 iPhone 并安装：

   ```sh
   npm run ios
   ```

开发包依赖电脑上的 Metro 服务，手机和电脑需要能够通过局域网连接。后续启动开发服务：

```sh
npm start
```

如需内置 JavaScript、无需 Metro 的 Release 包：

```sh
npm run ios -- --configuration Release
```

也可以直接在 Xcode 中选择连接的 iPhone 构建运行。修改 Bundle ID 或原生配置后，执行 `npx expo prebuild --platform ios` 更新工程；`ios/` 由 Expo 生成，不纳入版本控制。

## 使用与导出格式

1. 确认需要导出的血糖记录已经同步到 iPhone 的「健康」。
2. 点击「读取并导出血糖数据」，在系统页面中允许读取血糖；如可选择历史范围，请选择全部历史。
3. 等待读取完成，在系统分享面板中保存或分享 JSON 文件。

文件名为 `blood-glucose-<导出时间戳>.json`，顶层是数组，每条记录只有 `t`、`v`、`u`。以下为示例数据：

```json
[
  { "t": "2026-10-27T08:31:00+08:00", "v": 5.3, "u": "mmol/L" },
  { "t": "2026-10-27T08:32:00+08:00", "v": 5.4, "u": "mmol/L" }
]
```

- `t`：采样开始时间，统一转换为北京时间 `+08:00`，精确到秒。
- `v`：HealthKit 转换为 mmol/L 后的数字，不做额外四舍五入。
- `u`：固定为 `mmol/L`。
- 按采样开始时间升序导出全部可读样本，不限制日期或来源，不去重、不汇总。

HealthKit 不公开用户是否拒绝读取权限。空结果时 App 会提示检查数据和权限，不会生成空文件并提示成功。文件生成后关闭分享面板，也不代表文件已经保存；可以再次点击按钮重新导出。

## 开发与检查

主要依赖为 Expo SDK 54、React Native 0.81.5、React 19.1.0、HealthKit 16.2.0 和 Nitro Modules 0.35.0；完整依赖版本由 `package-lock.json` 锁定。

- `App.tsx`：血糖授权、查询、JSON 导出和分享页面。
- `app.json`：应用标识、HealthKit 权限及 Expo 插件配置。
- `plugins/with-ios-scene.cjs`：在 prebuild 时为 Expo SDK 54 模板补充单窗口 UIScene 入口。

```sh
npm run typecheck
npx expo install --check
```

实际导出需要在含血糖记录的 iPhone 上验证：检查文件可正常打开，条数、最早和最新时间与读取结果一致，并抽样核对「健康」中的数值。

本机环境配置、签名文件和 `blood-glucose-*.json` 导出文件已加入 `.gitignore`，请勿将个人健康数据提交到仓库。

## 许可证

采用 [MIT 许可证](LICENSE)，参见 [MIT 许可证原文](https://opensource.org/license/mit)。
