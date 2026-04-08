import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CloudServerOutlined, ApartmentOutlined } from '@ant-design/icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import styles from './index.module.scss';

export default function Help() {
  const { t } = useTranslation();

  return (
    <div className={styles.wrap}>
      <SettingsPageTitle title={t('help.title')} desc={t('help.intro')} />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('help.quickLinks')}</h2>
        <ul className={styles.list}>
          <li className={styles.item}>
            <CloudServerOutlined className={styles.itemIcon} />
            <div className={styles.itemContent}>
              <Link to="/settings/models" className={styles.itemLink}>
                {t('settings.modelProviders')}
              </Link>
              <p className={styles.itemDesc}>{t('help.modelProviders')}</p>
            </div>
          </li>
          <li className={styles.item}>
            <ApartmentOutlined className={styles.itemIcon} />
            <div className={styles.itemContent}>
              <Link to="/" className={styles.itemLink}>
                {t('dashboard.title')}
              </Link>
              <p className={styles.itemDesc}>{t('help.workflow')}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
