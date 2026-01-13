import React from 'react';
import { Modal, Tabs, Typography, Tag, Space, Collapse, Image, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './CrawlerPreviewModal.module.scss';

const { Paragraph, Text } = Typography;

interface CrawlerPreviewModalProps {
  open: boolean;
  onClose: () => void;
  crawlerTest: {
    previewOpen: boolean;
    setPreviewOpen: (open: boolean) => void;
    previewData: any;
  };
}

/**
 * 爬虫节点预览模态框组件
 */
export const CrawlerPreviewModal: React.FC<CrawlerPreviewModalProps> = ({
  open,
  onClose,
  crawlerTest,
}) => {
  const { t } = useTranslation();

  if (!crawlerTest.previewData) {
    return (
      <Modal
        title={t('node.config.crawler.previewTitle')}
        open={open}
        onCancel={onClose}
        footer={null}
        width={700}
        centered
        maskClosable={false}
        styles={{ body: { padding: '0 24px 24px' } }}
      >
        <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
          {t('node.config.crawler.noPreviewData')}
        </div>
      </Modal>
    );
  }

  const crawlerData = crawlerTest.previewData?.crawler?.data;
  const mode = crawlerData?.mode || crawlerData?.extractMode;
  let rawData = crawlerData?.data || crawlerData?.value || crawlerData;

  if (!Array.isArray(rawData) && rawData && typeof rawData === 'object') {
    if (Array.isArray(rawData.images)) {
      rawData = rawData.images;
    } else if (Array.isArray(rawData.list)) {
      rawData = rawData.list;
    } else if (Array.isArray(rawData.items)) {
      rawData = rawData.items;
    } else if (Array.isArray(rawData.results)) {
      rawData = rawData.results;
    }
  }

  const isImageMode = mode === 'images';
  let extractedImages: string[] = [];

  if (Array.isArray(rawData)) {
    extractedImages = rawData
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          return (
            item.src ||
            item.url ||
            item.link ||
            item.img ||
            item.image ||
            item.href ||
            item.data
          );
        }
        return null;
      })
      .filter(
        (url: any) =>
          typeof url === 'string' &&
          (url.startsWith('http') ||
            url.startsWith('https') ||
            url.startsWith('data:image') ||
            url.startsWith('//') ||
            url.startsWith('/'))
      );
  } else if (
    typeof rawData === 'string' &&
    (rawData.startsWith('http') ||
      rawData.startsWith('data:image') ||
      rawData.startsWith('/'))
  ) {
    extractedImages = [rawData];
  }

  const hasImages = extractedImages.length > 0;

  const items = [
    {
      key: 'overview',
      label: t('node.config.crawler.overview'),
      children: (
        <div className={styles.contentArea}>
          <div className={styles.statusContainer}>
            <Text type="secondary" className={styles.statusTitle}>
              {t('node.config.executionStatus')}
            </Text>
            <div className={styles.statusContent}>
              <div>
                <Text style={{ marginRight: 8, fontSize: 13 }}>
                  {t('node.types.crawler')}
                </Text>
                <Tag
                  color={
                    crawlerTest.previewData?.crawler?.success ? 'success' : 'error'
                  }
                >
                  {crawlerTest.previewData?.crawler?.success
                    ? t('node.execution.success')
                    : t('node.execution.failed')}
                </Tag>
              </div>
              {crawlerTest.previewData?.dataclean && (
                <div>
                  <Text style={{ marginRight: 8, fontSize: 13 }}>
                    {t('node.types.dataclean')}
                  </Text>
                  <Tag
                    color={
                      crawlerTest.previewData?.dataclean?.success
                        ? 'success'
                        : 'error'
                    }
                  >
                    {crawlerTest.previewData?.dataclean?.success
                      ? t('node.execution.success')
                      : t('node.execution.failed')}
                  </Tag>
                </div>
              )}
            </div>
            {(crawlerTest.previewData?.crawler?.error ||
              crawlerTest.previewData?.dataclean?.error) && (
              <div className={styles.errorContainer}>
                <Text type="danger" style={{ fontSize: 12 }}>
                  {crawlerTest.previewData?.crawler?.error ||
                    crawlerTest.previewData?.dataclean?.error}
                </Text>
              </div>
            )}
          </div>
          <Collapse defaultActiveKey={['summary']} size="small" ghost>
            <Collapse.Panel
              header={t('node.config.crawler.dataSummary')}
              key="summary"
            >
              <div style={{ paddingLeft: 8 }}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <Text type="secondary">{t('node.config.crawler.mode')}</Text>
                    <Text>
                      {crawlerTest.previewData?.crawler?.data?.mode ||
                        crawlerTest.previewData?.crawler?.data?.extractMode ||
                        t('node.config.crawler.unknown')}
                    </Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <Text type="secondary">
                      {t('node.config.crawler.selector')}
                    </Text>
                    <Text code>
                      {crawlerTest.previewData?.crawler?.data?.selector_used ||
                        crawlerTest.previewData?.crawler?.data?.selector ||
                        t('node.config.crawler.notUsed')}
                    </Text>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <Text type="secondary">
                      {t('node.config.crawler.resultCount')}
                    </Text>
                    <Text strong>
                      {crawlerTest.previewData?.crawler?.data?.count ??
                        (Array.isArray(rawData) ? rawData.length : 1)}
                    </Text>
                  </div>
                </Space>
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('node.config.crawler.textSample')}
                  </Text>
                  <div
                    style={{
                      marginTop: 8,
                      background: 'var(--bg-secondary)',
                      padding: 12,
                      borderRadius: 4,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    <Paragraph ellipsis={{ rows: 8, expandable: true }} style={{ marginBottom: 0 }}>
                      {crawlerTest.previewData?.dataclean?.data
                        ? typeof crawlerTest.previewData.dataclean.data === 'string'
                          ? crawlerTest.previewData.dataclean.data
                          : JSON.stringify(
                              crawlerTest.previewData.dataclean.data,
                              null,
                              2
                            )
                        : crawlerTest.previewData?.crawler?.data?.text ??
                          JSON.stringify(
                            crawlerTest.previewData?.crawler?.data?.value ||
                              crawlerTest.previewData?.crawler?.data?.data ||
                              crawlerTest.previewData?.crawler?.data,
                            null,
                            2
                          )}
                    </Paragraph>
                  </div>
                </div>
              </div>
            </Collapse.Panel>
          </Collapse>
        </div>
      ),
    },
    {
      key: 'cleaned',
      label: t('node.config.crawler.cleaned'),
      children: (
        <div
          style={{
            maxHeight: '60vh',
            overflow: 'auto',
            background: 'var(--bg-secondary)',
            borderRadius: 4,
            padding: 12,
          }}
        >
          {crawlerTest.previewData?.dataclean?.data ? (
            typeof crawlerTest.previewData.dataclean.data === 'string' ? (
              <Paragraph
                style={{ fontSize: 13, marginBottom: 0, whiteSpace: 'pre-wrap' }}
              >
                {crawlerTest.previewData.dataclean.data}
              </Paragraph>
            ) : (
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontFamily: 'Consolas, monospace',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                }}
              >
                {JSON.stringify(crawlerTest.previewData.dataclean.data, null, 2)}
              </pre>
            )
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              {t('node.config.crawler.noCleanResult')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'json',
      label: t('node.config.crawler.rawJson'),
      children: (
        <div className={styles.jsonViewer}>
          <pre className={styles.jsonPre}>
            {JSON.stringify(crawlerTest.previewData, null, 2)}
          </pre>
        </div>
      ),
    },
  ];

  if (isImageMode || hasImages) {
    items.push({
      key: 'images',
      label: t('node.config.crawler.imagePreview'),
      children: (
        <div style={{ maxHeight: '60vh', overflow: 'auto', padding: 12 }}>
          {hasImages ? (
            <Image.PreviewGroup>
              <Space size={[8, 8]} wrap>
                {extractedImages.map((src: string, index: number) => (
                  <Image
                    key={index}
                    width={100}
                    height={100}
                    src={src}
                    style={{
                      objectFit: 'cover',
                      borderRadius: 4,
                      border: '1px solid var(--border-secondary)',
                    }}
                    fallback="https://via.placeholder.com/100x100?text=Error"
                  />
                ))}
              </Space>
            </Image.PreviewGroup>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
              }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('node.config.crawler.noImageLinks')}
              />
              <div
                style={{
                  marginTop: 16,
                  maxWidth: '80%',
                  fontSize: 12,
                  color: '#999',
                  textAlign: 'center',
                }}
              >
                <p>{t('node.config.crawler.imageExtractTip')}</p>
                <p>{t('node.config.crawler.checkRawJsonTip')}</p>
              </div>
            </div>
          )}
        </div>
      ),
    });
  }

  return (
    <Modal
      title={t('node.config.crawler.previewTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      centered
      maskClosable={false}
      styles={{ body: { padding: '0 24px 24px' } }}
    >
      <Tabs
        defaultActiveKey={isImageMode ? 'images' : 'overview'}
        size="small"
        items={items}
      />
    </Modal>
  );
};

