import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Popconfirm, Select, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { useAdminPermission } from '@/hooks/useAdminPermission';
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
          message.error(error instanceof Error ? error.message : '加载规则列表失败');
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
  }, [keyword, status, page, pageSize, message]);

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
      message.error(error instanceof Error ? error.message : '加载规则详情失败');
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
        message.success('规则已更新');
      } else {
        await createCrawlerRule(payload);
        message.success('规则已创建');
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
      message.success('规则已删除');
      await reloadRules(page);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除规则失败');
    }
  };

  const handleToggleStatus = async (record: CrawlerRuleListItem, checked: boolean) => {
    try {
      await setCrawlerRuleStatus(record.id, checked);
      message.success(`规则已${checked ? '启用' : '停用'}`);
      setRules((current) => current.map((item) => (item.id === record.id ? { ...item, is_active: checked } : item)));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新状态失败');
    }
  };

  const handleCloneRule = async (record: CrawlerRuleListItem) => {
    try {
      await cloneCrawlerRule(record.id);
      message.success('规则已复制');
      setPage(1);
      await reloadRules(1);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '复制规则失败');
    }
  };

  const enabledCount = rules.filter((item) => item.is_active).length;
  const usageTotal = rules.reduce((sum, item) => sum + item.usage_count, 0);
  const avgSuccessRate = rules.length > 0 ? rules.reduce((sum, item) => sum + (item.success_rate ?? 0), 0) / rules.length : 0;

  const columns: ColumnsType<CrawlerRuleListItem> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button type="link" onClick={() => navigate(`/crawler-rules/${record.id}`)}>
          {value}
        </Button>
      ),
    },
    { title: '版本', dataIndex: 'version', width: 120 },
    {
      title: 'URL 模式',
      dataIndex: 'url_pattern',
      ellipsis: true,
      render: (value: string | null | undefined, record) => (
        <div>
          <div>{value || '-'}</div>
          <Text type="secondary">{record.url_pattern_type}</Text>
        </div>
      ),
    },
    {
      title: '状态',
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
    { title: '使用次数', dataIndex: 'usage_count', width: 120 },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      width: 120,
      render: (value: number | null | undefined) => formatSuccessRate(value),
    },
    { title: '更新时间', dataIndex: 'updated_at', width: 180 },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      render: (_value, record) => (
        <Space wrap>
          <Button type="link" onClick={() => navigate(`/crawler-rules/${record.id}`)}>
            详情
          </Button>
          {canEdit ? (
            <Button type="link" onClick={() => void openEditDrawer(record)}>
              编辑
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="link" onClick={() => navigate(`/crawler-rules/${record.id}/test`)}>
              测试
            </Button>
          ) : null}
          <Button type="link" onClick={() => navigate(`/crawler-rules/${record.id}/usages`)}>
            引用
          </Button>
          {canEdit ? (
            <Button type="link" onClick={() => void handleCloneRule(record)}>
              复制
            </Button>
          ) : null}
          {canEdit ? (
            <Popconfirm title="确认删除这个规则？" description="规则会被软删除，已引用工作流请同步检查。" onConfirm={() => void handleDeleteRule(record)}>
              <Button type="link" danger>
                删除
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
        eyebrow="采集规则"
        title="采集规则中心"
        description="集中管理可复用的采集规则模板，并提供详情、测试和引用关系查看，便于统一维护和复用。"
        tags={['规则模板', '测试验证', '工作流复用', '统一维护']}
        action={
          <Space>
            <Button onClick={() => void reloadRules(page)}>刷新</Button>
            {canEdit ? <Button type="primary" onClick={openCreateDrawer}>新建规则</Button> : null}
          </Space>
        }
      />

      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title="当前页规则数" value={rules.length} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="启用中" value={enabledCount} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="累计使用次数" value={usageTotal} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="平均成功率" value={avgSuccessRate} precision={2} suffix="%" />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <div className={styles.toolbar}>
          <div>
            <Paragraph className={styles.toolbarTitle}>规则列表</Paragraph>
            <Paragraph className={styles.muted}>列表页只保留检索和管理动作，详细信息进入子页面查看。</Paragraph>
          </div>
          <div className={styles.filterBar}>
            <Input
              allowClear
              placeholder="搜索名称 / 描述 / URL 模式"
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
                { value: 'all', label: '全部状态' },
                { value: 'active', label: '仅启用' },
                { value: 'inactive', label: '仅停用' },
              ]}
              style={{ width: 140 }}
            />
            <Button type="primary" onClick={() => { setPage(1); setKeyword(keywordInput.trim()); }}>
              查询
            </Button>
            <Button onClick={() => { setKeywordInput(''); setKeyword(''); setStatus('all'); setPage(1); }}>
              重置
            </Button>
          </div>
        </div>

        <Table<CrawlerRuleListItem>
          rowKey="id"
          loading={loading}
          dataSource={rules}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
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
