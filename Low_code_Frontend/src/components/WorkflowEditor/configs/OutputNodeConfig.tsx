import React, { useEffect, useMemo, useState } from 'react';
import { Form, Input, Segmented, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  FileTextOutlined,
  FileMarkdownOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  CodeOutlined,
  ShareAltOutlined,
  SwapOutlined,
  ClockCircleOutlined,
  ApartmentOutlined,
  AreaChartOutlined,
  DotChartOutlined,
  PieChartOutlined,
  BarChartOutlined,
  HeatMapOutlined,
  BarsOutlined,
  DownloadOutlined,
  ApiOutlined,
} from '@ant-design/icons';

// 导入以触发默认注册（注册式架构：格式/目标可扩展）
import '../outputProviders';
import { outputProviderRegistry } from '../outputProviders';
import { ProviderPicker, type ProviderPickerOption } from './ProviderPicker';
import { SegmentedSwitch } from '../providers/parts/SwitchPart';
import styles from './AINodeConfig.module.scss';

const { Text } = Typography;

export const OutputNodeConfig: React.FC = () => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const formats = outputProviderRegistry.getAllFormats();
  const destinations = outputProviderRegistry.getAllDestinations();

  const watchedFormat = Form.useWatch('format', form) || 'json';
  const watchedChartType = Form.useWatch('chartType', form) || 'scatter';
  const watchedDestination = Form.useWatch('destination', form) || 'file';

  type CategoryId = 'doc' | 'diagram' | 'chart';

  const iconForFormat = (backendValue: string) => {
    switch (backendValue) {
      case 'json':
        return <CodeOutlined />;
      case 'markdown':
      case 'md':
        return <FileMarkdownOutlined />;
      case 'text':
      case 'txt':
        return <FileTextOutlined />;
      case 'pdf':
        return <FilePdfOutlined />;
      case 'docx':
      case 'word':
        return <FileWordOutlined />;
      case 'mermaid':
        return <ApartmentOutlined />;
      case 'timeline':
        return <ClockCircleOutlined />;
      case 'sankey':
        return <SwapOutlined />;
      case 'network':
        return <ShareAltOutlined />;
      case 'chart':
      case 'chart_svg':
        return <AreaChartOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  const formatCategorySections = useMemo(() => {
    const groups = new Map<string, { id: string; label: string; order: number; items: ProviderPickerOption[] }>();
    for (const f of formats) {
      const catId = f.category?.id || 'other';
      const catLabel = f.category?.label || '其他';
      const catOrder = f.category?.order ?? 999;
      const g = groups.get(catId) || { id: catId, label: catLabel, order: catOrder, items: [] };
      g.items.push({
        value: f.backendValue,
        title: f.label,
        description: f.description,
        icon: iconForFormat(f.backendValue),
      });
      groups.set(catId, g);
    }
    return Array.from(groups.values())
      .sort((a, b) => a.order - b.order)
      .map((g) => ({
        id: g.id,
        label: g.label,
        items: g.items.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')),
      }));
  }, [formats]);

  const chartTypeOptions = useMemo<ProviderPickerOption[]>(
    () => [
      { value: 'line', title: t('node.config.output.chartTypes.line'), icon: <AreaChartOutlined /> },
      { value: 'bar', title: t('node.config.output.chartTypes.bar'), icon: <BarChartOutlined /> },
      { value: 'scatter', title: t('node.config.output.chartTypes.scatter'), icon: <DotChartOutlined /> },
      { value: 'histogram', title: t('node.config.output.chartTypes.histogram'), icon: <BarsOutlined /> },
      { value: 'heatmap', title: t('node.config.output.chartTypes.heatmap'), icon: <HeatMapOutlined /> },
      { value: 'pie', title: t('node.config.output.chartTypes.pie'), icon: <PieChartOutlined /> },
    ],
    [t]
  );

  const destinationOptions = useMemo<ProviderPickerOption[]>(() => {
    // 当前后端 destination 只是意图；都会生成 artifacts。这里只暴露 file/api。
    const opts: ProviderPickerOption[] = [
      { value: 'file', title: t('node.config.output.destinationFile'), icon: <DownloadOutlined /> },
      { value: 'api', title: t('node.config.output.destinationApi'), icon: <ApiOutlined /> },
    ];
    // 如果未来 registry 注册了更多 destination，再在这里扩展为分组/更多卡片
    void destinations;
    return opts;
  }, [destinations, t]);

  const getFormatByBackendValue = (backendValue: string) =>
    formats.find((f) => f.backendValue === backendValue);

  const selectedFormat = getFormatByBackendValue(watchedFormat);
  void selectedFormat;

  const categoryForFormat = (format: string): CategoryId => {
    const f = getFormatByBackendValue(format);
    const cid = (f?.category?.id || 'doc') as CategoryId;
    if (cid === 'doc' || cid === 'diagram' || cid === 'chart') return cid;
    return 'doc';
  };

  const [activeCategory, setActiveCategory] = useState<CategoryId>(() => categoryForFormat(watchedFormat));

  // 当 format 被外部恢复/切换时，同步一级类目
  useEffect(() => {
    setActiveCategory(categoryForFormat(watchedFormat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFormat]);

  // 当切到 chart 一级类目时，自动把 format 固定为 chart
  useEffect(() => {
    if (activeCategory !== 'chart') return;
    if (watchedFormat !== 'chart') {
      form.setFieldValue('format', 'chart');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const categoryLabels: Record<CategoryId, string> = {
    doc: t('node.config.output.categories.doc'),
    diagram: t('node.config.output.categories.diagram'),
    chart: t('node.config.output.categories.chart'),
  };

  const formatOptionsByCategory = useMemo(() => {
    const map: Record<CategoryId, ProviderPickerOption[]> = { doc: [], diagram: [], chart: [] };
    for (const sec of formatCategorySections) {
      const id = sec.id as CategoryId;
      if (id === 'doc' || id === 'diagram' || id === 'chart') {
        map[id] = sec.items;
      }
    }
    return map;
  }, [formatCategorySections]);

  return (
    <div className={styles.configContainer}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('node.config.output.format')}</div>
        <div className={styles.sectionDescription}>
          {t('node.config.output.formatDesc')}
        </div>
        <div style={{ marginBottom: 10 }}>
          <Segmented
            block
            motion={undefined}
            value={activeCategory}
            onChange={(v) => {
              const cid = v as CategoryId;
              setActiveCategory(cid);
              const options = formatOptionsByCategory[cid] || [];
              // 切换一级类目时，如果当前 format 不在该类目，则自动切到该类目的第一个 format
              if (!options.some((o) => o.value === watchedFormat) && options.length > 0) {
                form.setFieldValue('format', options[0].value);
              }
            }}
            className={styles.modeSegmented}
            options={[
              { value: 'doc', label: categoryLabels.doc },
              { value: 'diagram', label: categoryLabels.diagram },
              { value: 'chart', label: categoryLabels.chart },
            ]}
          />
        </div>

        {activeCategory === 'chart' ? (
          <>
            {/* chart 类目：二级直接展示图表类型（避免出现只有一张 Chart(SVG) 卡片） */}
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
              {t('node.config.output.chartType')}
            </div>
            <div className={styles.sectionDescription} style={{ marginTop: -6 }}>
              {t('node.config.output.chartTypeDesc')}
            </div>
            <Form.Item name="chartType" initialValue="scatter" style={{ marginBottom: 10 }}>
              <ProviderPicker
                mode="cards"
                options={chartTypeOptions}
                value={watchedChartType}
                onChange={(v) => form.setFieldValue('chartType', v)}
              />
            </Form.Item>
            <Form.Item
              label={t('node.config.output.chartTitle')}
              name="chartTitle"
              style={{ marginBottom: 0 }}
            >
              <Input placeholder={t('node.config.output.chartTitlePlaceholder')} />
            </Form.Item>
            {/* format 字段仍然存在，用于后端 provider 选择；这里隐藏并由 activeCategory 自动维护 */}
            <Form.Item name="format" initialValue="chart" style={{ display: 'none' }}>
              <Input />
            </Form.Item>
          </>
        ) : (
          <Form.Item name="format" initialValue="json" style={{ marginBottom: 0 }}>
            <ProviderPicker
              mode="cards"
              options={formatOptionsByCategory[activeCategory] || []}
              value={watchedFormat}
              onChange={(v) => {
                if (v === 'csv') return;
                form.setFieldValue('format', v);
              }}
            />
          </Form.Item>
        )}

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.format !== curr?.format}>
          {({ getFieldValue }) => {
            const f = getFormatByBackendValue(getFieldValue('format'));
            if (!f?.description) return null;
            return (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary">{f.description}</Text>
              </div>
            );
          }}
        </Form.Item>
      </div>

      {/* chartType 已合并到“导出格式”区块里，避免出现两组卡片 */}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('node.config.output.destination')}</div>
        <div className={styles.sectionDescription}>
          {t('node.config.output.destinationDesc')}
        </div>
        <Form.Item name="destination" initialValue="file" style={{ marginBottom: 0 }}>
          <ProviderPicker
            mode="cards"
            options={destinationOptions}
            value={watchedDestination}
            onChange={(v) => form.setFieldValue('destination', v)}
          />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.destination !== curr?.destination}>
          {({ getFieldValue }) => {
            const dest = getFieldValue('destination');
            if (dest !== 'api') return null;
            return (
              <div style={{ marginTop: 10 }}>
                <Text type="secondary">
                  {t('node.config.output.exportApiTip')}<br />
                  <Text code>{'/api/tasks/:id/artifacts'}</Text>
                </Text>
              </div>
            );
          }}
        </Form.Item>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {t('node.config.output.emailSectionTitle')}
        </div>
        <div className={styles.sectionDescription}>
          {t('node.config.output.emailSectionDesc')}
        </div>
        <Form.Item
          name="sendEmail"
          initialValue={false}
          style={{ marginBottom: 0 }}
        >
          <SegmentedSwitch
            checkedChildren={t('workflowEditor.enable') || '开启'}
            unCheckedChildren={t('workflowEditor.disable') || '关闭'}
          />
        </Form.Item>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('node.config.output.fileName')}</div>
        <div className={styles.sectionDescription}>
          {t('node.config.output.fileNameTip')}
        </div>
        <Form.Item name="fileName" style={{ marginBottom: 0 }}>
          <Input placeholder={t('node.config.output.fileNamePlaceholder')} />
        </Form.Item>
      </div>
    </div>
  );
};

