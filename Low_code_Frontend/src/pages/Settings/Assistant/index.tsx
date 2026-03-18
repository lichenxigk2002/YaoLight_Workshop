import { Button, Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { useAssistantUIStore } from '@/store/assistantUi';
import styles from './index.module.scss';

export default function AssistantSettings() {
  const { i18n } = useTranslation();
  const { density, accent, reduceMotion, setDensity, setAccent, setReduceMotion, reset } = useAssistantUIStore();
  const isZh = i18n.language === 'zh-CN';

  return (
    <div className={styles.container}>
      <SettingsPageTitle
        title={isZh ? '瑶光 AI 助手' : 'YaoLight AI Assistant'}
        desc={
          isZh
            ? '调整助手界面的密度、强调方式和动效节奏，让它更贴合你的使用习惯。'
            : 'Adjust density, emphasis, and motion so the assistant feels calmer and more natural to use.'
        }
      />

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.label}>{isZh ? '信息密度' : 'Density'}</div>
          <div className={styles.desc}>
            {isZh
              ? '影响会话列表、消息区和输入区的疏密程度。'
              : 'Controls how spacious the conversation list, messages, and composer feel.'}
          </div>
          <Segmented
            block
            value={density}
            onChange={(value) => setDensity(value as 'comfortable' | 'compact')}
            options={[
              { label: isZh ? '舒适' : 'Comfortable', value: 'comfortable' },
              { label: isZh ? '紧凑' : 'Compact', value: 'compact' },
            ]}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.label}>{isZh ? '强调色' : 'Accent'}</div>
          <div className={styles.desc}>
            {isZh
              ? '只在焦点、选中和少量关键交互里保留强调。'
              : 'Keeps emphasis limited to focus, selection, and a few important interactions.'}
          </div>
          <Segmented
            block
            value={accent ? 'on' : 'off'}
            onChange={(value) => setAccent(value === 'on')}
            options={[
              { label: isZh ? '开启' : 'On', value: 'on' },
              { label: isZh ? '关闭' : 'Off', value: 'off' },
            ]}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.label}>{isZh ? '减少动效' : 'Reduce motion'}</div>
          <div className={styles.desc}>
            {isZh
              ? '减少平滑滚动和位移动画，只保留必要反馈。'
              : 'Reduces scrolling and movement animation while keeping essential feedback.'}
          </div>
          <Segmented
            block
            value={reduceMotion ? 'on' : 'off'}
            onChange={(value) => setReduceMotion(value === 'on')}
            options={[
              { label: isZh ? '开启' : 'On', value: 'on' },
              { label: isZh ? '关闭' : 'Off', value: 'off' },
            ]}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <Button danger className={styles.resetButton} onClick={reset}>
          {isZh ? '恢复默认' : 'Reset to default'}
        </Button>
      </div>
    </div>
  );
}
