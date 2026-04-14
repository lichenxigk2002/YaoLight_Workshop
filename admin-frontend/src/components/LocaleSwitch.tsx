import { DownOutlined, GlobalOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space } from 'antd';
import { useI18n } from '@/i18n';
import styles from './LocaleSwitch.module.scss';

export default function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n();
  
    return (
    <Dropdown
      trigger={['click']}
      overlayClassName={styles.dropdown}
      menu={{
        selectable: true,
        selectedKeys: [locale],
        onClick: ({ key }) => setLocale(key as 'zh-CN' | 'en-US'),
        items: [
          { key: 'zh-CN', label: t('common.localeZh') },
          { key: 'en-US', label: t('common.localeEn') },
        ],
      }}
    >
      <Button type="text" className={styles.trigger}>
        <Space size={6}>
          <GlobalOutlined />
          <span>{locale === 'zh-CN' ? t('common.localeZh') : t('common.localeEn')}</span>
          <DownOutlined className={styles.chevron} />
        </Space>
      </Button>
    </Dropdown>
  );
}
