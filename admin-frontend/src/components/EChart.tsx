import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GraphicComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { init, use, type EChartsCoreOption, type EChartsType } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, GraphicComponent, CanvasRenderer]);

interface EChartProps {
  option: EChartsCoreOption;
  className?: string;
  style?: CSSProperties;
  loading?: boolean;
}

export default function EChart({ option, className, style, loading = false }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = init(containerRef.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    if (loading) {
      chart.showLoading('default', {
        text: '加载中',
        color: '#1677ff',
        textColor: '#667085',
        maskColor: 'rgba(255, 255, 255, 0.18)',
      });
    } else {
      chart.hideLoading();
    }

    chart.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [loading, option]);

  return <div ref={containerRef} className={className} style={style} />;
}
