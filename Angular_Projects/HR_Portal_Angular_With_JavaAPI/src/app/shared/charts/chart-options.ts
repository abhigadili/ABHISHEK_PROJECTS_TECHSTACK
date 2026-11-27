import type { EChartsCoreOption } from 'echarts/core';
export const SERIES = ['#4f46e5', '#0ea5a4', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#0284c7', '#ec4899'];
const palette = (dark: boolean) => ({ grid: dark ? '#2a3150' : '#e4e7ee', text: dark ? '#9aa4c0' : '#667085', tipBg: dark ? '#171c2e' : '#ffffff', tipText: dark ? '#e6e9f5' : '#1b2133' });
const tooltip = (c: ReturnType<typeof palette>, trigger: 'axis' | 'item') => ({ trigger, backgroundColor: c.tipBg, borderColor: c.grid, textStyle: { color: c.tipText, fontSize: 12 }, confine: true });
const short = (v: string) => (String(v).length > 14 ? String(v).slice(0, 13) + '…' : String(v));

export interface SeriesKey { key: string; label: string }
/** Bar chart (clustered or stacked) with interactive legend + tooltip. */
export function barOption(dark: boolean, data: any[], x: string, keys: SeriesKey[], stacked = false): EChartsCoreOption {
  const c = palette(dark);
  return {
    color: SERIES, textStyle: { fontFamily: 'inherit' }, animationDuration: 500,
    tooltip: tooltip(c, 'axis'), legend: keys.length > 1 ? { bottom: 0, textStyle: { color: c.text } } : undefined,
    grid: { left: 8, right: 12, top: 16, bottom: keys.length > 1 ? 36 : 8, containLabel: true },
    xAxis: { type: 'category', data: data.map((d) => d[x]), axisLabel: { color: c.text, interval: 0, formatter: short, rotate: data.length > 6 ? 30 : 0 }, axisLine: { lineStyle: { color: c.grid } } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: c.text }, splitLine: { lineStyle: { color: c.grid, type: 'dashed' } } },
    series: keys.map((k) => ({ type: 'bar', name: k.label, stack: stacked ? 's' : undefined, data: data.map((d) => d[k.key]), barMaxWidth: 44, itemStyle: { borderRadius: stacked ? 0 : [4, 4, 0, 0] } })),
  };
}
export function lineOption(dark: boolean, data: any[], x: string, keys: SeriesKey[]): EChartsCoreOption {
  const c = palette(dark);
  return {
    color: SERIES, textStyle: { fontFamily: 'inherit' }, tooltip: tooltip(c, 'axis'), legend: { bottom: 0, textStyle: { color: c.text } },
    grid: { left: 8, right: 12, top: 16, bottom: 36, containLabel: true },
    xAxis: { type: 'category', data: data.map((d) => d[x]), axisLabel: { color: c.text }, axisLine: { lineStyle: { color: c.grid } } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: c.text }, splitLine: { lineStyle: { color: c.grid, type: 'dashed' } } },
    series: keys.map((k) => ({ type: 'line', name: k.label, smooth: true, symbolSize: 7, lineStyle: { width: 2.4 }, data: data.map((d) => d[k.key]) })),
  };
}
export function donutOption(dark: boolean, data: { name: string; value: number }[]): EChartsCoreOption {
  const c = palette(dark);
  return {
    color: SERIES, textStyle: { fontFamily: 'inherit' }, tooltip: tooltip(c, 'item'), legend: { bottom: 0, textStyle: { color: c.text } },
    series: [{ type: 'pie', radius: ['52%', '78%'], center: ['50%', '45%'], padAngle: 2, itemStyle: { borderRadius: 4 }, label: { show: false }, emphasis: { label: { show: true, fontWeight: 'bold', color: c.tipText } }, data }],
  };
}
