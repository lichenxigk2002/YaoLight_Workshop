import { Button, Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { useAssistantUIStore } from '@/store/assistantUi';
import styles from './index.module.scss';

export default function AssistantSettings() {
  const { t } = useTranslation();
  const { density, accent, reduceMotion, setDensity, setAccent, setReduceMotion, reset } = useAssistantUIStore();

  return (
    <div className={styles.container}>
      <SettingsPageTitle
        title={t('settings.assistant')}
        desc={t('settings.assistantDesc')}
      />

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.label}>{t('settings.assistantDensity')}</div>
          <div className={styles.desc}>
            {t('settings.assistantDensityDesc')}
          </div>
          <Segmented
            block
            value={density}
            onChange={(value) => setDensity(value as 'comfortable' | 'compact')}
            options={[
              { label: t('settings.assistantDensityComfortable'), value: 'comfortable' },
              { label: t('settings.assistantDensityCompact'), value: 'compact' },
            ]}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.label}>{t('settings.assistantAccent')}</div>
          <div className={styles.desc}>
            {t('settings.assistantAccentDesc')}
          </div>
          <Segmented
            block
            value={accent ? 'on' : 'off'}
            onChange={(value) => setAccent(value === 'on')}
            options={[
              { label: t('settings.on'), value: 'on' },
              { label: t('settings.off'), value: 'off' },
            ]}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.label}>{t('settings.assistantReduceMotion')}</div>
          <div className={styles.desc}>
            {t('settings.assistantReduceMotionDesc')}
          </div>
          <Segmented
            block
            value={reduceMotion ? 'on' : 'off'}
            onChange={(value) => setReduceMotion(value === 'on')}
            options={[
              { label: t('settings.on'), value: 'on' },
              { label: t('settings.off'), value: 'off' },
            ]}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <Button danger className={styles.resetButton} onClick={reset}>
          {t('settings.assistantReset')}
        </Button>
      </div>
    </div>
  );
}
