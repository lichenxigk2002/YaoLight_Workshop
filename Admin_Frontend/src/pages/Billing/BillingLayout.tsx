import { Outlet } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import styles from './Billing.module.scss';

export default function BillingLayout() {
  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="计费运营"
        title="邀请与计费运营"
        description="统一查看邀请增长、订单状态、Token 流水和用户配额；支持补救配额与管理员赠送，均记入流水。"
        tags={['邀请数据', '订单', 'Token 流水', '配额调整', '补救配额', '管理员赠送']}
      />
      <Outlet />
    </div>
  );
}
