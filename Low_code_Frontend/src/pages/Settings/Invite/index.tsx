import { useEffect, useState } from 'react';
import { App, Button, Table, Typography } from 'antd';
import { CopyOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
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
    void fetchInviteLink();
    void fetchStats();
  }, []);

  useEffect(() => {
    void fetchList();
  }, [listPage, listPageSize]);

  const handleCopy = async () => {
    if (!inviteUrl) {
      msg.warning(t('settings.inviteGenerateFirst', 'Please generate an invite link first'));
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      msg.success(t('settings.inviteCopied', 'Invite link copied'));
    } catch {
      msg.error(t('settings.inviteCopyFailed', 'Copy failed'));
    }
  };

  const inviteUrlCopyable = inviteUrl
    ? {
        text: inviteUrl,
        tooltips: [
          t('settings.inviteCopy', 'Copy link'),
          t('settings.inviteCopied', 'Invite link copied'),
        ],
      }
    : false;

  const columns: ColumnsType<InviteRecord> = [
    {
      title: t('settings.inviteeUsername', 'Invitee'),
      dataIndex: 'username',
      key: 'username',
      width: 180,
      render: (value: string, record: InviteRecord) => value || record.email || '-',
    },
    {
      title: t('settings.inviteeEmail', 'Email'),
      dataIndex: 'email',
      key: 'email',
      width: 240,
    },
    {
      title: t('settings.inviteTime', 'Invite time'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroHeader}>
          <SettingsPageTitle
            title={t('settings.inviteFriends', 'Invite Friends')}
            desc={t(
              'settings.invitePageDescription',
              'Share your invite link, track invite stats, and review reward records in one compact place.',
            )}
            icon={<UserAddOutlined />}
            style={{ marginBottom: 0 }}
          />

          <div className={styles.summaryGroup}>
            <div className={styles.summaryChip}>
              <TeamOutlined className={styles.summaryIcon} />
              <div>
                <div className={styles.summaryLabel}>{t('settings.invitedCount', 'Invited count')}</div>
                <div className={styles.summaryValue}>{inviteCount}</div>
              </div>
            </div>
            <div className={styles.summaryChip}>
              <StardustIcon size={20} />
              <div>
                <div className={styles.summaryLabel}>{t('settings.inviteRewardTotal', 'Total stardust earned')}</div>
                <div className={styles.summaryValue}>{(inviteCount * 200000).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.surfaceCard}>
        <div className={styles.sectionIntro}>
          <div className={styles.eyebrow}>{t('settings.inviteFriends', 'Invite Friends')}</div>
          <h2 className={styles.sectionTitle}>{t('settings.inviteTitle', 'Invite friends, get 200K stardust each')}</h2>
          <p className={styles.sectionDesc}>
            {t(
              'settings.inviteDesc',
              'Share your exclusive invite link. When friends register, you will receive the reward.',
            )}
          </p>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <Button
              type="primary"
              className={styles.primaryButton}
              icon={<CopyOutlined />}
              loading={loading}
              onClick={fetchInviteLink}
            >
              {inviteUrl ? t('settings.inviteRefresh', 'Refresh link') : t('settings.inviteGenerate', 'Generate link')}
            </Button>
            {inviteUrl ? (
              <Button className={styles.secondaryButton} icon={<CopyOutlined />} onClick={handleCopy}>
                {t('settings.inviteCopy', 'Copy link')}
              </Button>
            ) : null}
          </div>
        </div>

        <div className={styles.inviteUrlBox}>
          <div className={styles.inviteUrlLabel}>{t('settings.inviteUrlLabel', 'Your exclusive invite link')}</div>
          {inviteUrl ? (
            <Text copyable={inviteUrlCopyable} ellipsis={{ tooltip: inviteUrl }} className={styles.inviteUrl}>
              {inviteUrl}
            </Text>
          ) : (
            <div className={styles.invitePlaceholder}>
              {t('settings.inviteGenerateFirst', 'Please generate an invite link first')}
            </div>
          )}
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>{t('settings.invitedCount', 'Invited count')}</div>
            <div className={styles.statValue}>
              {inviteCount}
              <StardustIcon size={14} style={{ marginLeft: 6, verticalAlign: '-2px' }} />
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>{t('settings.inviteRewardTotal', 'Total stardust earned')}</div>
            <div className={styles.statValue}>{(inviteCount * 200000).toLocaleString()}</div>
          </div>
        </div>
      </section>

      <section className={styles.listSection}>
        <div className={styles.listHeader}>
          <div className={styles.eyebrow}>{t('settings.inviteRecords', 'Invite records')}</div>
          <h2 className={styles.sectionTitle}>{t('settings.inviteRecords', 'Invite records')}</h2>
          <p className={styles.sectionDesc}>
            {t(
              'settings.inviteRecordsDescription',
              'Review invitees, contact details, and registration time in a table that matches the rest of settings.',
            )}
          </p>
        </div>

        <div className={styles.tableShell}>
          <Table
            loading={listLoading}
            dataSource={list}
            columns={columns}
            rowKey="id"
            size="small"
            scroll={{ x: 600 }}
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
        </div>
      </section>
    </div>
  );
}
