import { AlkaidPanel } from '@/components/Alkaid'
import styles from './index.module.scss'

export default function ConversationsPage() {
  return (
    <div className={styles.container}>
      <AlkaidPanel variant="page" defaultView="conversations" />
    </div>
  )
}

