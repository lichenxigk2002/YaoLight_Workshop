import { useEffect, useState } from 'react';
import { Switch, Spin, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { CheckCircleOutlined } from '@ant-design/icons';
import { userApi } from '@/api/user';
import NotificationBellIcon from '@/components/Icons/NotificationBellIcon';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import styles from './index.module.scss';

/** 通知类型 key 与展示配置 */
const NOTIFICATION_TYPES = [
  {
    key: 'task_completed',
    labelKey: 'settings.notificationTaskCompleted',
    descKey: 'settings.notificationTaskCompletedDesc',
    Icon: CheckCircleOutlined,
  },
] as const;

export default function SettingsNotifications() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const data = await userApi.getNotificationPreferences();
      setPrefs(data ?? {});
    } catch {
      message.error(t('settings.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrefs();
  }, []);

  const handleChange = async (key: string, enabled: boolean) => {
    const next = { ...prefs, [key]: enabled };
    setPrefs(next);
    setSaving(true);
    try {
      await userApi.updateNotificationPreferences(next);
      message.success(t('common.ok'));
    } catch {
      message.error(t('settings.saveFailed'));
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <SettingsPageTitle
        title={t('settings.notificationConfig')}
        desc={t('settings.notificationConfigDesc')}
        icon={<NotificationBellIcon size={28} color="currentColor" />}
      />

      <section className={styles.section}>
        {loading ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : (
          <ul className={styles.list}>
            {NOTIFICATION_TYPES.map(({ key, labelKey, descKey, Icon }) => (
              <li key={key} className={styles.item}>
                <div className={styles.itemIcon}>
                  <Icon />
                </div>
                <div className={styles.itemContent}>
                  <span className={styles.itemLabel}>{t(labelKey)}</span>
                  <p className={styles.itemDesc}>{t(descKey)}</p>
                </div>
                <div className={styles.itemAction}>
                  <Switch
                    checked={prefs[key] !== false}
                    onChange={(checked) => handleChange(key, checked)}
                    loading={saving}
                    className={styles.switch}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
