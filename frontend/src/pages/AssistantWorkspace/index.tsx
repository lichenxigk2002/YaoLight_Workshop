import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlkaidPanel } from '@/components/Alkaid'
import styles from './index.module.scss'

export default function AssistantWorkspace() {
  const [params] = useSearchParams()
  const initialSessionId = useMemo(() => {
    const sid = params.get('sid')
    if (!sid) return null
    const n = Number(sid)
    return Number.isFinite(n) ? n : null
  }, [params])

  return (
    <div className={styles.container}>
      <AlkaidPanel variant="page" defaultView="chat" initialSessionId={initialSessionId} />
    </div>
  )
}

