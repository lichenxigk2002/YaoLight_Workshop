import { Outlet } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { useI18n } from '@/i18n';

export default function PermissionsLayout() {
  const { t } = useI18n();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHero
        eyebrow={t('permissions.eyebrow')}
        title={t('permissions.title')}
        description={t('permissions.description')}
        tags={[t('permissions.tagRoles'), t('permissions.tagMatrix'), t('permissions.tagAdmins')]}
      />
      <Outlet />
    </div>
  );
}
