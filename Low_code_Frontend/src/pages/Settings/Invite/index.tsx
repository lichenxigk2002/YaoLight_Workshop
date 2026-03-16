import { useEffect, useState } from 'react';
import { App, Button, Card, Table, Typography } from 'antd';
import { UserAddOutlined, CopyOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { userApi, type InviteRecord } from '@/api/user';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { StardustIcon } from '@/components/Icons';
import styles from './index.module.scss';

const { Text } = Typography;

export default function Invite() {
  const { t } = useTranslation();
  const { message: msg } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCount, setInviteCount] = useState(0);
  const [list, setList] = useState<InviteRecord[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [listLoading, setListLoading] = useState(false);

  const fetchInviteLink = async () => {
    try {
      setLoading(true);
      const res = await userApi.getInviteLink();
      setInviteUrl(res.inviteUrl || '');
    } catch (error: any) {
      msg.error(error.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await userApi.getInviteStats();
      setInviteCount(res.inviteCount ?? 0);
    } catch (error: any) {
      console.error(error);
    }
  };

  const fetchList = async () => {
    try {
      setListLoading(true);
      const res = await userApi.getInviteList({ page: listPage, pageSize: listPageSize });
      setList(res?.list ?? []);
      setListTotal(res?.total ?? 0);
    } catch (error: any) {
      msg.error(error.message || t('common.operationFailed'));
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchInviteLink();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchList();
  }, [listPage, listPageSize]);

  const handleCopy = async () => {
    if (!inviteUrl) {
      msg.warning(t('settings.inviteGenerateFirst', '请先生成邀请链接'));
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      msg.success(t('settings.inviteCopied', '邀请链接已复制到剪贴板'));
    } catch {
      msg.error(t('settings.inviteCopyFailed', '复制失败'));
    }
  };

  const columns = [
    {
      title: t('settings.inviteeUsername', '被邀请人'),
      dataIndex: 'username',
      key: 'username',
      render: (v: string, r: InviteRecord) => v || r.email || '-',
    },
    {
      title: t('settings.inviteeEmail', '邮箱'),
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: t('settings.inviteTime', '邀请时间'),
      dataIndex: 'created_at',
      key: 'created_at',
    },
  ];

  return (
    <div className={styles.container}>
      <SettingsPageTitle title={t('settings.inviteFriends', '邀请好友')} />

      <Card bordered={false} className={styles.inviteCard}>
        <div className={styles.inviteHeader}>
          <UserAddOutlined className={styles.inviteIcon} />
          <div>
            <Text strong style={{ fontSize: 16 }}>
              {t('settings.inviteTitle', '邀请好友，各得 20 万星尘')}
            </Text>
            <div className={styles.inviteDesc}>
              {t('settings.inviteDesc', '分享您的专属链接，好友注册成功后您将获得 20 万星尘奖励')}
            </div>
          </div>
        </div>

        <div className={styles.inviteActions}>
          <Button
            type="primary"
            icon={<CopyOutlined />}
            loading={loading}
            onClick={fetchInviteLink}
          >
            {inviteUrl ? t('settings.inviteRefresh', '刷新链接') : t('settings.inviteGenerate', '生成邀请链接')}
          </Button>
          {inviteUrl && (
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              {t('settings.inviteCopy', '复制链接')}
            </Button>
          )}
        </div>

        {inviteUrl && (
          <div className={styles.inviteUrlBox}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('settings.inviteUrlLabel', '您的专属邀请链接')}
            </Text>
            <Text code copyable={{ text: inviteUrl }} ellipsis className={styles.inviteUrl}>
              {inviteUrl}
            </Text>
          </div>
        )}
      </Card>

      <Card bordered={false} className={styles.statsCard}>
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <TeamOutlined className={styles.statIcon} />
            <div>
              <Text type="secondary">{t('settings.invitedCount', '已邀请人数')}</Text>
              <div className={styles.statValue}>
                {inviteCount} <StardustIcon size={14} style={{ marginLeft: 4, verticalAlign: '-2px' }} />
              </div>
            </div>
          </div>
          <div className={styles.statItem}>
            <StardustIcon size={24} />
            <div>
              <Text type="secondary">{t('settings.inviteRewardTotal', '累计获得星尘')}</Text>
              <div className={styles.statValue}>{(inviteCount * 200000).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </Card>

      <Card bordered={false} title={t('settings.inviteRecords', '邀请记录')} className={styles.listCard}>
        <Table
          loading={listLoading}
          dataSource={list}
          columns={columns}
          rowKey="id"
          pagination={{
            current: listPage,
            pageSize: listPageSize,
            total: listTotal,
            showSizeChanger: true,
            showTotal: (total) => t('settings.totalRecords', { total }),
            onChange: (page, size) => {
              setListPage(page);
              setListPageSize(size || 10);
            },
          }}
        />
      </Card>
    </div>
  );
}
