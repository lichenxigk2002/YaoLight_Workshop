import { App, Avatar, Button, Card, Input, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { listAdminContentComments, moderateAdminContentComment } from '@/api/contentComments';
import { formatDateTime } from '@/i18n/runtime';
import { useI18n } from '@/i18n';
import type { AdminContentComment } from '@/types/contentComments';
import styles from './ContentComments.module.scss';

const statusMeta: Record<string, { color: string; zh: string; en: string }> = {
  visible: { color: 'green', zh: '正常', en: 'Visible' },
  hidden: { color: 'orange', zh: '已隐藏', en: 'Hidden' },
  deleted: { color: 'red', zh: '已删除', en: 'Deleted' },
};

const resourceMeta: Record<string, { color: string; zh: string; en: string }> = {
  workflow_template: { color: 'purple', zh: '工作流模板', en: 'Workflow Template' },
};

interface CommentFilterState {
  keyword: string;
  status?: string;
  resourceType?: string;
}

const ContentCommentsPage = () => {
  const { message, modal } = App.useApp();
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminContentComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>();
  const [resourceType, setResourceType] = useState<string>();

  const loadData = async (
    nextPage = page,
    nextPageSize = pageSize,
    filters: CommentFilterState = { keyword, status, resourceType },
  ) => {
    try {
      setLoading(true);
      const response = await listAdminContentComments({
        page: nextPage,
        page_size: nextPageSize,
        keyword: filters.keyword.trim() || undefined,
        status: filters.status,
        resource_type: filters.resourceType,
      });
      setItems(response.list);
      setTotal(response.total);
      setPage(response.page);
      setPageSize(response.pageSize);
    } catch (error: any) {
      message.error(error.message || (isZh ? '加载评论失败' : 'Failed to load comments'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moderate = (record: AdminContentComment, action: 'hide' | 'restore' | 'delete') => {
    const actionLabel = isZh
      ? ({ hide: '隐藏', restore: '恢复', delete: '删除' }[action])
      : ({ hide: 'Hide', restore: 'Restore', delete: 'Delete' }[action]);
    let reason = '';
    modal.confirm({
      title: isZh ? `${actionLabel}这条评论？` : `${actionLabel} this comment?`,
      content: action === 'restore' ? undefined : (
        <Input.TextArea
          rows={3}
          placeholder={isZh ? '处理原因，会通知评论作者' : 'Reason sent to the comment author'}
          onChange={(event) => {
            reason = event.target.value;
          }}
        />
      ),
      onOk: async () => {
        await moderateAdminContentComment(record.id, { action, reason });
        message.success(isZh ? '评论已处理' : 'Comment updated');
        await loadData();
      },
    });
  };

  const columns: ColumnsType<AdminContentComment> = [
    {
      title: isZh ? '评论' : 'Comment',
      dataIndex: 'content',
      render: (_, record) => (
        <div className={styles.commentCell}>
          <div className={styles.commentText}>{record.content}</div>
          <div className={styles.meta}>
            {[record.location, record.deviceModel].filter(Boolean).join(' · ') || '-'}
          </div>
        </div>
      ),
    },
    {
      title: isZh ? '用户' : 'User',
      width: 180,
      render: (_, record) => (
        <Space>
          <Avatar size={28} src={record.avatarUrl || undefined}>{record.username?.slice(0, 1)}</Avatar>
          <span>{record.username}</span>
        </Space>
      ),
    },
    {
      title: isZh ? '资源' : 'Resource',
      width: 220,
      render: (_, record) => {
        const meta = resourceMeta[record.resourceType] || { color: 'default', zh: record.resourceType, en: record.resourceType };
        return (
          <div className={styles.resource}>
            <Tag color={meta.color}>{isZh ? meta.zh : meta.en}</Tag>
            <span className={styles.resourceTitle}>{record.resourceTitle || `#${record.resourceId}`}</span>
          </div>
        );
      },
    },
    {
      title: isZh ? '状态' : 'Status',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const meta = statusMeta[value] || { color: 'default', zh: value, en: value };
        return <Tag color={meta.color}>{isZh ? meta.zh : meta.en}</Tag>;
      },
    },
    {
      title: isZh ? '时间' : 'Time',
      dataIndex: 'createdAt',
      width: 170,
      render: (value: string) => formatDateTime(value, locale),
    },
    {
      title: isZh ? '操作' : 'Actions',
      width: 190,
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'visible' ? <Button size="small" onClick={() => moderate(record, 'hide')}>{isZh ? '隐藏' : 'Hide'}</Button> : null}
          {record.status !== 'visible' ? <Button size="small" onClick={() => moderate(record, 'restore')}>{isZh ? '恢复' : 'Restore'}</Button> : null}
          {record.status !== 'deleted' ? <Button size="small" danger onClick={() => moderate(record, 'delete')}>{isZh ? '删除' : 'Delete'}</Button> : null}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHero
        eyebrow={isZh ? '内容治理' : 'Content Moderation'}
        title={isZh ? '评论管理' : 'Comment Moderation'}
        description={isZh ? '集中审核、隐藏和删除平台评论，并在处理后通知评论作者。' : 'Review, hide, and delete platform comments with author notifications.'}
        tags={[isZh ? '评论审核' : 'Review', isZh ? '违规处理' : 'Moderation', isZh ? '站内通知' : 'Notifications']}
      />
      <Card>
        <div className={styles.toolbar}>
          <Input.Search
            className={styles.searchInput}
            value={keyword}
            placeholder={isZh ? '搜索评论、用户名、资源名' : 'Search comment, user, resource'}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={() => void loadData(1, pageSize)}
            allowClear
          />
          <Select
            className={styles.filterSelect}
            value={status}
            placeholder={isZh ? '状态' : 'Status'}
            onChange={(value) => setStatus(value)}
            allowClear
            options={[
              { value: 'visible', label: isZh ? '正常' : 'Visible' },
              { value: 'hidden', label: isZh ? '已隐藏' : 'Hidden' },
              { value: 'deleted', label: isZh ? '已删除' : 'Deleted' },
            ]}
          />
          <Select
            className={styles.filterSelect}
            value={resourceType}
            placeholder={isZh ? '资源类型' : 'Resource'}
            onChange={(value) => setResourceType(value)}
            allowClear
            options={[{ value: 'workflow_template', label: isZh ? '工作流模板' : 'Workflow Template' }]}
          />
          <Button onClick={() => void loadData(1, pageSize)}>{isZh ? '查询' : 'Search'}</Button>
          <Button onClick={() => {
            setKeyword('');
            setStatus(undefined);
            setResourceType(undefined);
            void loadData(1, pageSize, { keyword: '', status: undefined, resourceType: undefined });
          }}>{isZh ? '重置' : 'Reset'}</Button>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => isZh ? `共 ${value} 条` : `${value} items`,
            onChange: (nextPage, nextPageSize) => void loadData(nextPage, nextPageSize),
          }}
        />
      </Card>
    </div>
  );
};

export default ContentCommentsPage;
