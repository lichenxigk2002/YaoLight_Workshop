import { Button, Segmented } from 'antd'
import { useAssistantUIStore } from '@/store/assistantUi'
import styles from './index.module.scss'

export default function AssistantSettings() {
  const { density, accent, reduceMotion, setDensity, setAccent, setReduceMotion, reset } = useAssistantUIStore()

  return (
    <div className={styles.container}>
      <div className={styles.title}>瑶光星AI助手 · 外观与交互</div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.label}>信息密度</div>
          <div className={styles.desc}>影响会话列表行高、消息间距与输入区紧凑度。</div>
          <Segmented
            value={density}
            onChange={(v) => setDensity(v as any)}
            options={[
              { label: '舒适', value: 'comfortable' },
              { label: '紧凑', value: 'compact' },
            ]}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.label}>强调色</div>
          <div className={styles.desc}>仅用于关键交互点缀（焦点、徽标、选中态）。</div>
          <Segmented
            value={accent ? 'on' : 'off'}
            onChange={(v) => setAccent(v === 'on')}
            options={[
              { label: '开启', value: 'on' },
              { label: '关闭', value: 'off' },
            ]}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.label}>减少动效</div>
          <div className={styles.desc}>关闭平滑滚动与位移动画，保留必要渐变。</div>
          <Segmented
            value={reduceMotion ? 'on' : 'off'}
            onChange={(v) => setReduceMotion(v === 'on')}
            options={[
              { label: '开启', value: 'on' },
              { label: '关闭', value: 'off' },
            ]}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <Button danger onClick={reset}>
          恢复默认
        </Button>
      </div>
    </div>
  )
}

