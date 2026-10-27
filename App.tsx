import {
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { useRef, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';

/** 提供一次性的血糖读取、JSON 导出和系统分享页面。 */
export default function App() {
  /** 控制读取和分享期间的按钮禁用状态。 */
  const [isExporting, setIsExporting] = useState(false);
  /** 向用户展示当前步骤、读取条数或实际错误。 */
  const [status, setStatus] = useState(
    '点击按钮读取“健康”中的全部可读血糖记录。\n导出时间统一为北京时间（+08:00）。',
  );
  /** 立即拦截连续点击，避免状态更新前重复启动导出。 */
  const exportingRef = useRef(false);

  /** 请求血糖读取权限，导出全部可读样本并打开系统分享面板。 */
  async function handleExport(): Promise<void> {
    if (exportingRef.current) {
      return;
    }

    exportingRef.current = true;
    setIsExporting(true);
    setStatus('正在检查健康数据…');

    try {
      // 必须在支持 HealthKit 的真机原生开发包中运行。
      if (!isHealthDataAvailable()) {
        throw new Error('当前设备无法使用健康数据，请在 iPhone 真机开发包中运行。');
      }

      // 只请求血糖读取权限；历史范围由用户在系统授权页面选择。
      setStatus('请允许读取血糖数据；如系统询问历史范围，请选择全部历史。');
      /** 只表示授权交互是否完成，不能用它判断用户是否允许读取。 */
      const didRequestAuthorization = await requestAuthorization({
        toRead: ['HKQuantityTypeIdentifierBloodGlucose'],
      });
      if (!didRequestAuthorization) {
        throw new Error('健康数据授权请求未完成，请重新点击按钮。');
      }

      // limit 为 0 表示全量读取，不添加日期和来源筛选。
      setStatus('正在读取全部血糖记录…');
      /** HealthKit 按指定 mmol 单位返回的全部可读原始样本。 */
      const samples = await queryQuantitySamples(
        'HKQuantityTypeIdentifierBloodGlucose',
        {
          limit: 0,
          // 原生查询按 HKSampleSortIdentifierStartDate 升序返回。
          ascending: true,
          // 此版本要求带葡萄糖摩尔质量的单位字符串，不能直接传 mmol/L。
          unit: 'mmol<180.15588000005408>/l',
        },
      );

      // HealthKit 不公开读取权限是否被拒绝，空结果不能视为导出成功。
      if (samples.length === 0) {
        setStatus('未读取到血糖记录。请确认“健康”中有血糖数据，并已允许本 App 读取。');
        return;
      }

      setStatus(`已读取 ${samples.length} 条血糖记录，正在生成 JSON 文件…`);
      /** 按采样开始时间升序排列、仅保留 t/v/u 的导出记录。 */
      const records = samples.map((sample) => ({
        // 将 UTC 时刻平移八小时后取日期部分，再明确标记固定的 +08:00。
        t: `${new Date(sample.startDate.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19)}+08:00`,
        // 保留 HealthKit 转换后的数值精度，不做额外舍入或合并。
        v: sample.quantity,
        u: 'mmol/L',
      }));

      /** 供系统分享读取的本次 JSON 缓存文件。 */
      const file = new File(Paths.cache, `blood-glucose-${Date.now()}.json`);
      file.create();
      // File.write 默认使用 UTF-8，文件顶层直接写入数组。
      file.write(JSON.stringify(records, null, 2));

      // 只说明文件已生成，分享面板关闭并不代表用户已经保存文件。
      setStatus(
        `已读取 ${records.length} 条血糖记录，已生成 ${file.name}。\n请在系统分享面板中选择“存储到文件”或 AirDrop。`,
      );
      await shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
      });
    } catch (error: unknown) {
      // 保留实际失败原因，让读取、写文件和分享错误直接暴露。
      setStatus(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // 成功、失败或取消分享后均允许用户重新点击。
      exportingRef.current = false;
      setIsExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        {/* 单个系统按钮启动完整导出流程，执行中禁止重复点击。 */}
        <Button
          title={isExporting ? '正在处理…' : '读取并导出血糖数据'}
          onPress={handleExport}
          disabled={isExporting}
        />
        {/* 状态文字可以选中，便于复制实际错误。 */}
        <Text style={styles.status} accessibilityLiveRegion="polite" selectable>
          {status}
        </Text>
      </View>
    </SafeAreaView>
  );
}

/** 单页面所需的最小布局样式。 */
const styles = StyleSheet.create({
  /** 页面安全区域使用白底并占满屏幕。 */
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  /** 为导出按钮和状态文字提供居中布局及四周留白。 */
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  /** 用于显示读取进度、文件信息和实际错误。 */
  status: {
    color: '#111',
    fontSize: 16,
    lineHeight: 24,
  },
});
