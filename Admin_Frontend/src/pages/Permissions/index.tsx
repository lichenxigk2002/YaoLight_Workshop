import PlaceholderPage from '@/pages/_shared/PlaceholderPage';
import { useI18n } from '@/i18n';

export default function PermissionsPage() {
  const { t } = useI18n();

  return (
    <PlaceholderPage
      eyebrow={t('permissions.eyebrow')}
      title={t('permissions.title')}
      description={t('permissions.description')}
      tags={[t('permissions.tagRoles'), t('permissions.tagMatrix'), t('permissions.tagAdmins'), t('permissions.tagPlaceholder')]}
      cards={[
        {
          title: t('permissions.cardAdminsTitle'),
          description: t('permissions.cardAdminsDescription'),
          bullets: [
            t('permissions.cardAdminsBullet1'),
            t('permissions.cardAdminsBullet2'),
            t('permissions.cardAdminsBullet3'),
            t('permissions.cardAdminsBullet4'),
          ],
        },
        {
          title: t('permissions.cardPermissionsTitle'),
          description: t('permissions.cardPermissionsDescription'),
          bullets: [
            t('permissions.cardPermissionsBullet1'),
            t('permissions.cardPermissionsBullet2'),
            t('permissions.cardPermissionsBullet3'),
            t('permissions.cardPermissionsBullet4'),
          ],
        },
      ]}
    />
  );
}
