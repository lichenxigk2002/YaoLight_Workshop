import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Popconfirm, Select, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import {
  cloneCrawlerRule,
  createCrawlerRule,
  deleteCrawlerRule,
  getCrawlerRule,
  listCrawlerRules,
  setCrawlerRuleStatus,
  updateCrawlerRule,
} from '@/api/crawlerRules';
import type { CrawlerRuleListItem } from '@/types/crawlerRules';
import RuleEditorDrawer from './components/RuleEditorDrawer';
import styles from './CrawlerRules.module.scss';
import { DEFAULT_RULE_FORM, detailToFormValues, formatSuccessRate, getStatusMeta, type FilterStatus, type RuleFormValues, toRulePayload } from './utils';

const { Paragraph, Text } = Typography;

export default function RulesListPage() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { canEdit } = useAdminPermission('crawler_rules');
  const [form] = Form.useForm<RuleFormValues>();
  const [rules, setRules] = useState<CrawlerRuleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listCrawlerRules({
      keyword: keyword || undefined,
      is_active: status === 'all' ? undefined : status === 'active',
      page,
      page_size: pageSize,
    })
      .then((payload) => {
        if (cancelled) return;
        setRules(payload.list);
        setTotal(payload.total);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : t('crawlerRules.loadListFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [keyword, status, page, pageSize, message, t]);

  const openCreateDrawer = () => {
    setEditingRuleId(null);
    form.setFieldsValue(DEFAULT_RULE_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = async (record: CrawlerRuleListItem) => {
    setDrawerOpen(true);
    setEditingRuleId(record.id);
    form.setFieldsValue(DEFAULT_RULE_FORM);
    try {
      const detail = await getCrawlerRule(record.id);
      form.setFieldsValue(detailToFormValues(detail));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('crawlerRules.loadDetailFailed'));
      setDrawerOpen(false);
    }
  };

  const reloadRules = async (nextPage = page) => {
    const payload = await listCrawlerRules({
      keyword: keyword || undefined,
      is_active: status === 'all' ? undefined : status === 'active',
      page: nextPage,
      page_size: pageSize,
    });
    setRules(payload.list);
    setTotal(payload.total);
  };

  const handleSaveRule = async () => {
    try {
      const values = await form.validateFields();
      const payload = toRulePayload(values);
      setSaving(true);
      if (editingRuleId) {
        await updateCrawlerRule(editingRuleId, payload);
        message.success(t('crawlerRules.updateSuccess'));
      } else {
        await createCrawlerRule(payload);
        message.success(t('crawlerRules.createSuccess'));
      }
      setDrawerOpen(false);
      setPage(1);
      await reloadRules(1);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (record: CrawlerRuleListItem) => {
    try {
      await deleteCrawlerRule(record.id);
      message.success(t('crawlerRules.deleteSuccess'));
      await reloadRules(page);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('crawlerRules.deleteFailed'));
    }
  };

  const handleToggleStatus = async (record: CrawlerRuleListItem, checked: boolean) => {
    try {
      await setCrawlerRuleStatus(record.id, checked);
      message.success(checked ? t('crawlerRules.enableSuccess') : t('crawlerRules.disableSuccess'));
      setRules((current) => current.map((item) => (item.id === record.id ? { ...item, is_active: checked } : item)));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('crawlerRules.updateStatusFailed'));
    }
  };

  const handleCloneRule = async (record: CrawlerRuleListItem) => {
    try {
      await cloneCrawlerRule(record.id);
      message.success(t('crawlerRules.cloneSuccess'));
      setPage(1);
      await reloadRules(1);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('crawlerRules.cloneFailed'));
    }
  };

  const enabledCount = rules.filter((item) => item.is_active).length;
  const usageTotal = rules.reduce((sum, item) => sum + item.usage_count, 0);
  const avgSuccessRate = rules.length > 0 ? rules.reduce((sum, item) => sum + (item.success_rate ?? 0), 0) / rules.length : 0;

  const columns: ColumnsType<CrawlerRuleListItem> = [
    {
      title: t('crawlerRules.columnName'),
      dataIndex: 'name',
      width: 260,
      render: (value: string, record) => (
        <Button className={styles.ruleNameButton} type="link" onClick={() => navigate(`/crawler-rules/${record.id}`)}>
          {value}
        </Button>
      ),
    },
    {
      title: t('crawlerRules.columnVersion'),
      dataIndex: 'version',
      width: 100,
      render: (value: string) => <span className={styles.nowrapCell}>{value}</span>,
    },
    {
      title: t('crawlerRules.columnUrlPattern'),
      dataIndex: 'url_pattern',
      width: 220,
      ellipsis: true,
      render: (value: string | null | undefined, record) => (
        <div className={styles.urlPatternCell}>
          <div className={styles.urlPatternValue} title={value || '-'}>
            {value || '-'}
          </div>
          <Text className={styles.nowrapCell} type="secondary">{record.url_pattern_type}</Text>
        </div>
      ),
    },
    {
      title: t('crawlerRules.columnStatus'),
      key: 'status',
      width: 160,
      render: (_value, record) => {
        const meta = getStatusMeta(record.is_active);
        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{meta.label}</Tag>
            <Switch size="small" checked={record.is_active} disabled={!canEdit} onChange={(checked) => void handleToggleStatus(record, checked)} />
          </Space>
        );
      },
    },
    { title: t('crawlerRules.columnUsageCount'), dataIndex: 'usage_count', width: 120 },
    {
      title: t('crawlerRules.columnSuccessRate'),
      dataIndex: 'success_rate',
      width: 120,
      render: (value: number | null | undefined) => formatSuccessRate(value),
    },
    { title: t('crawlerRules.columnUpdatedAt'), dataIndex: 'updated_at', width: 180 },
    {
      title: t('crawlerRules.columnActions'),
      key: 'actions',
      width: 320,
      render: (_value, record) => (
        <Space wrap>
          <Button type="link" onClick={() => navigate(`/crawler-rules/${record.id}`)}>
            {t('crawlerRules.actionDetail')}
          </Button>
          {canEdit ? (
            <Button type="link" onClick={() => void openEditDrawer(record)}>
              {t('crawlerRules.actionEdit')}
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="link" onClick={() => navigate(`/crawler-rules/${record.id}/test`)}>
              {t('crawlerRules.actionTest')}
            </Button>
          ) : null}
          <Button type="link" onClick={() => navigate(`/crawler-rules/${record.id}/usages`)}>
            {t('crawlerRules.actionUsages')}
          </Button>
          {canEdit ? (
            <Button type="link" onClick={() => void handleCloneRule(record)}>
              {t('crawlerRules.actionClone')}
            </Button>
          ) : null}
          {canEdit ? (
            <Popconfirm title={t('crawlerRules.deleteConfirmTitle')} description={t('crawlerRules.deleteConfirmDescription')} onConfirm={() => void handleDeleteRule(record)}>
              <Button type="link" danger>
                {t('crawlerRules.actionDelete')}
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('crawlerRules.heroEyebrow')}
        title={t('crawlerRules.heroTitle')}
        description={t('crawlerRules.heroDescription')}
        tags={[
          t('crawlerRules.heroTagTemplate'),
          t('crawlerRules.heroTagTest'),
          t('crawlerRules.heroTagReuse'),
          t('crawlerRules.heroTagMaintenance'),
        ]}
        action={
          <Space>
            <Button onClick={() => void reloadRules(page)}>{t('crawlerRules.actionRefresh')}</Button>
            {canEdit ? <Button type="primary" onClick={openCreateDrawer}>{t('crawlerRules.actionCreate')}</Button> : null}
          </Space>
        }
      />

      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('crawlerRules.metricCurrentPage')} value={rules.length} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('crawlerRules.metricActive')} value={enabledCount} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('crawlerRules.metricUsageTotal')} value={usageTotal} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('crawlerRules.metricAvgSuccessRate')} value={avgSuccessRate} precision={2} suffix="%" />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <div className={styles.toolbar}>
          <div>
            <Paragraph className={styles.toolbarTitle}>{t('crawlerRules.listTitle')}</Paragraph>
            <Paragraph className={styles.muted}>{t('crawlerRules.listDescription')}</Paragraph>
          </div>
          <div className={styles.filterBar}>
            <Input
              allowClear
              placeholder={t('crawlerRules.keywordPlaceholder')}
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onPressEnter={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
              }}
              style={{ width: 260 }}
            />
            <Select<FilterStatus>
              value={status}
              onChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
              options={[
                { value: 'all', label: t('crawlerRules.allStatuses') },
                { value: 'active', label: t('crawlerRules.onlyActive') },
                { value: 'inactive', label: t('crawlerRules.onlyInactive') },
              ]}
              style={{ width: 140 }}
            />
            <Button type="primary" onClick={() => { setPage(1); setKeyword(keywordInput.trim()); }}>
              {t('crawlerRules.actionQuery')}
            </Button>
            <Button onClick={() => { setKeywordInput(''); setKeyword(''); setStatus('all'); setPage(1); }}>
              {t('crawlerRules.actionReset')}
            </Button>
          </div>
        </div>

        <Table<CrawlerRuleListItem>
          rowKey="id"
          loading={loading}
          dataSource={rules}
          columns={columns}
          tableLayout="fixed"
          scroll={{ x: 1360 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => t('crawlerRules.paginationTotal', { total: value }),
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 20);
            },
          }}
        />
      </Card>

      <RuleEditorDrawer
        open={drawerOpen}
        editingRuleId={editingRuleId}
        saving={saving}
        canEdit={canEdit}
        form={form}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSaveRule}
      />
    </div>
  );
}
