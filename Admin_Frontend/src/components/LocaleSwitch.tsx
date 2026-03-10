import { Segmented } from 'antd';
import { useI18n } from '@/i18n';

export default function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <Segmented
      size="small"
      value={locale}
      onChange={(value) => setLocale(value as 'zh-CN' | 'en-US')}
      options={[
        { label: t('common.localeZh'), value: 'zh-CN' },
        { label: t('common.localeEn'), value: 'en-US' },
      ]}
    />
  );
}
