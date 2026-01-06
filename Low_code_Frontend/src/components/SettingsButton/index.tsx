import { useState } from 'react';
import { Button, Popover, Space, Switch } from 'antd';
import { SettingOutlined, BulbOutlined, MoonOutlined } from '@ant-design/icons';
import { useThemeStore } from '@/store/theme';
import styles from './index.module.scss';

export default function SettingsButton() {
  const { theme, toggleTheme } = useThemeStore();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const content = (
    <div className={styles.popoverContent}>
      <div className={styles.menuItem}>
        <Space>
          {theme === 'light' ? <BulbOutlined /> : <MoonOutlined />}
          <span>主题切换</span>
        </Space>
        <Switch
          checked={theme === 'dark'}
          onChange={toggleTheme}
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<BulbOutlined />}
        />
      </div>
      {/* 预留其他功能位置 */}
      {/* <div className={styles.menuItem}>
        <Space>
          <Icon />
          <span>其他功能</span>
        </Space>
      </div> */}
    </div>
  );

  return (
    <div className={styles.settingsButton}>
      <Popover
        content={content}
        title="设置"
        trigger="hover"
        placement="topRight"
        open={open}
        onOpenChange={handleOpenChange}
        overlayClassName={styles.popover}
      >
        <Button
          icon={<SettingOutlined />}
          className={styles.button}
          size="large"
        />
      </Popover>
    </div>
  );
}

