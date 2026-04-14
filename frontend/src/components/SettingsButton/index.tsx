import { useEffect, useRef, useState } from 'react';
import { Button, Popover, Space, Switch } from 'antd';
import { SettingOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useThemeStore } from '@/store/theme';
import styles from './index.module.scss';

export default function SettingsButton() {
  const { theme, toggleTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const BUTTON_SIZE = 48;
  const SAFE_MARGIN = 24;

  const initialPos = () => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    const saved = localStorage.getItem('settingsButtonPos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          x: Math.max(SAFE_MARGIN, Math.min(parsed.x, window.innerWidth - BUTTON_SIZE - SAFE_MARGIN)),
          y: Math.max(SAFE_MARGIN, Math.min(parsed.y, window.innerHeight - BUTTON_SIZE - SAFE_MARGIN)),
        };
      } catch {
        // fall through
      }
    }
    return {
      x: window.innerWidth - BUTTON_SIZE - SAFE_MARGIN,
      y: window.innerHeight - BUTTON_SIZE - SAFE_MARGIN,
    };
  };

  const [pos, setPos] = useState<{ x: number; y: number }>(initialPos());
  const [collapsed, setCollapsed] = useState(true);
  const collapseTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const startMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const originPosRef = useRef<{ x: number; y: number }>(pos);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      clearCollapseTimer();
      setCollapsed(false);
    } else {
      queueCollapse();
    }
  };

  const content = (
    <div className={styles.popoverContent}>
      <div className={styles.menuItem}>
        <Space>
          {theme === 'light' ? <SunOutlined /> : <MoonOutlined />}
          <span>主题切换</span>
        </Space>
        <Switch
          checked={theme === 'dark'}
          onChange={toggleTheme}
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<SunOutlined />}
        />
      </div>
      {/* 预留其他功能位置 */}
      {/* <div className={styles.menuItem}>
        <Space>
          <Icon />
          <span>其他功能</span>
        </Space>
      </div> */}
    </div>
  );

  const clampPos = (x: number, y: number) => {
    const maxX = (typeof window !== 'undefined' ? window.innerWidth : 0) - BUTTON_SIZE - SAFE_MARGIN;
    const maxY = (typeof window !== 'undefined' ? window.innerHeight : 0) - BUTTON_SIZE - SAFE_MARGIN;
    return {
      x: Math.max(SAFE_MARGIN, Math.min(x, maxX)),
      y: Math.max(SAFE_MARGIN, Math.min(y, maxY)),
    };
  };

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  };

  const queueCollapse = () => {
    clearCollapseTimer();
    collapseTimerRef.current = window.setTimeout(() => setCollapsed(true), 1200);
  };

  const handleMouseEnter = () => {
    clearCollapseTimer();
    setCollapsed(false);
  };

  const handleMouseLeave = () => {
    if (!open && !draggingRef.current) {
      queueCollapse();
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    clearCollapseTimer();
    setCollapsed(false);
    startMouseRef.current = { x: e.clientX, y: e.clientY };
    originPosRef.current = pos;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp, { once: true });
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startMouseRef.current.x;
    const dy = e.clientY - startMouseRef.current.y;
    const next = clampPos(originPosRef.current.x + dx, originPosRef.current.y + dy);
    setPos(next);
  };

  const snapToEdge = (p: { x: number; y: number }) => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0;
    const h = typeof window !== 'undefined' ? window.innerHeight : 0;
    const distLeft = p.x - SAFE_MARGIN;
    const distRight = w - SAFE_MARGIN - BUTTON_SIZE - p.x;
    const distTop = p.y - SAFE_MARGIN;
    const distBottom = h - SAFE_MARGIN - BUTTON_SIZE - p.y;
    const SNAP_DIST = 36;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist > SNAP_DIST) return p;
    if (minDist === distLeft) return { x: SAFE_MARGIN, y: p.y };
    if (minDist === distRight) return { x: w - SAFE_MARGIN - BUTTON_SIZE, y: p.y };
    if (minDist === distTop) return { x: p.x, y: SAFE_MARGIN };
    return { x: p.x, y: h - SAFE_MARGIN - BUTTON_SIZE };
  };

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    draggingRef.current = false;
    const snapped = snapToEdge(pos);
    setPos(snapped);
    try {
      localStorage.setItem('settingsButtonPos', JSON.stringify(snapped));
    } catch {}
    queueCollapse();
  };

  useEffect(() => {
    const onResize = () => {
      setPos((p) => clampPos(p.x, p.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const computeCollapsedTransform = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0;
    const h = typeof window !== 'undefined' ? window.innerHeight : 0;
    const distLeft = pos.x - SAFE_MARGIN;
    const distRight = w - SAFE_MARGIN - BUTTON_SIZE - pos.x;
    const distTop = pos.y - SAFE_MARGIN;
    const distBottom = h - SAFE_MARGIN - BUTTON_SIZE - pos.y;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist === distLeft) return 'translateX(-12px)';
    if (minDist === distRight) return 'translateX(12px)';
    if (minDist === distTop) return 'translateY(-12px)';
    return 'translateY(12px)';
  };

  return (
    <div
      className={styles.settingsButton}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={onMouseDown}
      style={{
        top: pos.y,
        left: pos.x,
        transform: collapsed ? computeCollapsedTransform() : 'none',
        opacity: collapsed ? 0.6 : 1,
      }}
    >
      <Popover
        content={content}
        title="设置"
        trigger="hover"
        placement="topRight"
        open={open}
        onOpenChange={handleOpenChange}
      >
        <Button
          icon={<SettingOutlined style={{ color: theme === 'dark' ? '#ffffff' : undefined }} />}
          className={styles.button}
          size="large"
        />
      </Popover>
    </div>
  );
}

