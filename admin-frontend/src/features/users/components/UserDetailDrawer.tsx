import { Avatar, Button, Col, Descriptions, Drawer, Empty, Row, Space, Statistic, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useI18n } from '@/i18n';
import type { AdminUserDetail, AdminUserStatus } from '../types';
import UserStatusTag from './UserStatusTag';
import styles from '../Users.module.scss';

const { Paragraph, Text, Title } = Typography;

interface UserDetailDrawerProps {
  open: boolean;
  loading: boolean;
  user: AdminUserDetail | null;
  onClose: () => void;
  onResetPassword: (user: AdminUserDetail) => void;
  onStatusChange: (userId: number, status: AdminUserStatus) => void;
  statusUpdating: boolean;
  canEdit: boolean;
}

export default function UserDetailDrawer({
  open,
  loading,
  user,
  onClose,
  onResetPassword,
  onStatusChange,
  statusUpdating,
  canEdit,
}: UserDetailDrawerProps) {
  const { t } = useI18n();
  const adminStatusLocked = user?.role === 'admin';

  function formatDateTime(value?: string | null) {
    return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : t('common.empty');
  }

  return (
    <Drawer title={t('users.drawerTitle')} placement="right" width={560} open={open} onClose={onClose} destroyOnClose>
      {!user && !loading ? (
        <Empty description={t('users.drawerNoDetail')} />
      ) : (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div className={styles.detailIdentity}>
              <Avatar size={64} src={user?.avatar_url ?? undefined}>
                {user?.username?.slice(0, 1).toUpperCase()}
              </Avatar>
              <div>
                <Space size={8} wrap>
                  <Title level={4} className={styles.detailTitle}>
                    {user?.username ?? t('common.loading')}
                  </Title>
                  {user ? <UserStatusTag status={user.status} /> : null}
                  {user ? <Tag color={user.role === 'admin' ? 'gold' : 'blue'}>{user.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}</Tag> : null}
                </Space>
                <Paragraph className={styles.muted}>{user?.email ?? t('common.noEmail')}</Paragraph>
                <Text type="secondary">{t('users.drawerUserNo', { userNo: user?.user_no ?? '--' })}</Text>
              </div>
            </div>
            {user ? (
              <Space direction="vertical" size={8} style={{ alignItems: 'flex-end' }}>
                {canEdit ? <Button onClick={() => onResetPassword(user)}>{t('users.actionResetPassword')}</Button> : null}
                <Space.Compact>
                  <Button
                    disabled={!canEdit || statusUpdating || user.status === 'active' || adminStatusLocked}
                    onClick={() => onStatusChange(user.id, 'active')}
                  >
                    {t('users.actionActivate')}
                  </Button>
                  <Button
                    disabled={!canEdit || statusUpdating || user.status === 'inactive' || adminStatusLocked}
                    onClick={() => onStatusChange(user.id, 'inactive')}
                  >
                    {t('users.actionInactivate')}
                  </Button>
                  <Button
                    danger
                    disabled={!canEdit || statusUpdating || user.status === 'suspended' || adminStatusLocked}
                    onClick={() => onStatusChange(user.id, 'suspended')}
                  >
                    {t('users.actionSuspend')}
                  </Button>
                </Space.Compact>
                {adminStatusLocked ? <Text type="secondary">{t('users.adminLocked')}</Text> : null}
              </Space>
            ) : null}
          </div>

          <Row gutter={[12, 12]} className={styles.detailStats}>
            <Col span={8}>
              <Statistic title={t('users.statsProjects')} value={user?.stats.project_count ?? 0} loading={loading} />
            </Col>
            <Col span={8}>
              <Statistic title={t('users.statsWorkflows')} value={user?.stats.workflow_count ?? 0} loading={loading} />
            </Col>
            <Col span={8}>
              <Statistic title={t('users.statsTasks')} value={user?.stats.task_count ?? 0} loading={loading} />
            </Col>
            <Col span={8}>
              <Statistic title={t('users.statsInvites')} value={user?.stats.invite_count ?? 0} loading={loading} />
            </Col>
            <Col span={8}>
              <Statistic title={t('users.statsPaidOrders')} value={user?.stats.paid_order_count ?? 0} loading={loading} />
            </Col>
            <Col span={8}>
              <Statistic title={t('users.statsRevenue')} value={user?.stats.total_paid ?? 0} precision={2} suffix="CNY" loading={loading} />
            </Col>
          </Row>

          <Descriptions
            bordered
            column={1}
            className={styles.detailDescriptions}
            items={[
              { key: 'real_name', label: t('users.fieldRealName'), children: user?.real_name || t('common.empty') },
              { key: 'phone', label: t('users.fieldPhone'), children: user?.phone || t('common.empty') },
              { key: 'token_balance', label: t('users.fieldStardust'), children: (user?.token_balance ?? 0).toLocaleString() },
              { key: 'has_password', label: t('users.fieldPassword'), children: user?.has_password ? t('users.fieldPasswordSet') : t('users.fieldPasswordUnset') },
              { key: 'login_count', label: t('users.fieldLoginCount'), children: user?.login_count ?? 0 },
              { key: 'last_login_at', label: t('users.fieldLastLogin'), children: formatDateTime(user?.last_login_at) },
              { key: 'last_login_ip', label: t('users.fieldLastLoginIp'), children: user?.last_login_ip || t('common.empty') },
              { key: 'created_at', label: t('users.fieldCreatedAt'), children: formatDateTime(user?.created_at) },
              { key: 'updated_at', label: t('users.fieldUpdatedAt'), children: formatDateTime(user?.updated_at) },
              {
                key: 'inviter',
                label: t('users.fieldInviter'),
                children: user?.inviter ? `${user.inviter.username} (${user.inviter.email})` : t('common.none'),
              },
            ]}
          />
        </div>
      )}
    </Drawer>
  );
}
