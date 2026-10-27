/** Expo 提供的原生 AppDelegate 修改入口。 */
const { withAppDelegate } = require('expo/config-plugins');

/** 为固定的 Expo SDK 54 模板补上 iOS 27 要求的单窗口场景入口。 */
/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = function withIosScene(config) {
  return withAppDelegate(config, (appDelegateConfig) => {
    /** Expo 生成的 Swift 应用入口源码。 */
    let source = appDelegateConfig.modResults.contents;

    // 重复执行 prebuild 时保留已经生成的场景入口。
    if (source.includes('class SceneDelegate: UIResponder, UIWindowSceneDelegate')) {
      return appDelegateConfig;
    }

    /** SDK 54 模板中需要移到场景连接阶段的旧窗口初始化代码。 */
    const legacyStartup = `    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)`;

    // 模板不匹配时直接报错，避免生成不能启动的原生工程。
    if (!source.includes(legacyStartup)) {
      throw new Error('Expo AppDelegate 模板不匹配，无法配置 iOS 场景入口。');
    }

    // 应用启动时只准备 Expo 引擎，窗口由系统连接场景后创建。
    source = source
      .replace(
        '  var reactNativeFactory: RCTReactNativeFactory?',
        `  var reactNativeFactory: RCTReactNativeFactory?

  /// 保存应用启动参数，供场景连接时启动 React Native 页面。
  var initialLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?`,
      )
      .replace(
        '    let delegate = ReactNativeDelegate()',
        '    self.initialLaunchOptions = launchOptions\n\n    let delegate = ReactNativeDelegate()',
      )
      .replace(legacyStartup, '    // UIWindow 在 SceneDelegate 中绑定系统创建的 UIWindowScene。');

    // 将场景类写入同一 Swift 文件，自动归属现有 App target。
    source += `

/// 承接系统的单窗口场景，满足 iOS 27 的启动要求。
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  /// 当前场景展示 React Native 页面的窗口。
  var window: UIWindow?

  /// 在系统连接窗口场景后创建窗口，并使用已准备好的 Expo 引擎启动页面。
  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    // 该应用只声明一个 UIWindowScene，缺少引擎或窗口时直接暴露初始化错误。
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory else {
      fatalError("无法创建血糖导出页面：窗口场景或 Expo 引擎未准备好。")
    }

    // 使用场景创建窗口，同时交给 Expo 的现有窗口访问链路。
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.initialLaunchOptions
    )
  }
}
`;

    appDelegateConfig.modResults.contents = source;
    return appDelegateConfig;
  });
};
