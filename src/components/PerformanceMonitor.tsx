import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Activity, Minimize2, Maximize2, Cpu, Eye, Zap, Layers, BarChart2 } from 'lucide-react';

export interface PerfMetricPoint {
  time: string;
  fps: number;
  drawCalls: number;
  renderMs: number;
}

interface PerformanceMonitorProps {
  data: PerfMetricPoint[];
  currentFps: number;
  currentDrawCalls: number;
  currentRenderMs: number;
}

type MetricView = 'all' | 'fps' | 'drawCalls' | 'renderMs';

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  data,
  currentFps,
  currentDrawCalls,
  currentRenderMs,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeMetric, setActiveMetric] = useState<MetricView>('all');

  // Compute summary stats
  const avgFps = data.length > 0 ? Math.round(data.reduce((a, b) => a + b.fps, 0) / data.length) : currentFps;
  const avgDrawCalls = data.length > 0 ? Math.round(data.reduce((a, b) => a + b.drawCalls, 0) / data.length) : currentDrawCalls;
  const maxRenderMs = data.length > 0 ? Math.max(...data.map((d) => d.renderMs)).toFixed(1) : currentRenderMs.toFixed(1);

  // Status indicators
  const fpsStatus = currentFps >= 55 ? 'excellent' : currentFps >= 35 ? 'good' : 'warning';
  const fpsColor = fpsStatus === 'excellent' ? '#10B981' : fpsStatus === 'good' ? '#F59E0B' : '#EF4444';

  if (isMinimized) {
    return (
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-850 backdrop-blur-md border border-slate-700/80 hover:border-cyan-500/50 px-3.5 py-2 rounded-xl shadow-xl transition-all group cursor-pointer text-left"
          title="展开性能监控面板"
        >
          <Activity className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform animate-pulse" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold" style={{ color: fpsColor }}>
              {currentFps} FPS
            </span>
            <span className="text-slate-500 text-xs">|</span>
            <span className="text-xs font-mono text-amber-400">
              {currentDrawCalls} DC
            </span>
            <span className="text-slate-500 text-xs">|</span>
            <span className="text-xs font-mono text-cyan-400">
              {currentRenderMs.toFixed(1)}ms
            </span>
          </div>
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-30 w-84 sm:w-96 bg-slate-900/92 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-all text-slate-100 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              实时渲染性能遥测
              <span className="text-[10px] font-normal text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                Recharts
              </span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="最小化面板"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Real-time Metric Cards */}
      <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-950/20">
        {/* FPS */}
        <div
          onClick={() => setActiveMetric('fps')}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            activeMetric === 'fps'
              ? 'bg-emerald-950/30 border-emerald-500/40 shadow-sm'
              : 'bg-slate-850/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-slate-400 font-medium">帧率 FPS</span>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: fpsColor }}
            />
          </div>
          <div className="text-base font-extrabold font-mono text-emerald-400 leading-none">
            {currentFps}
            <span className="text-[10px] font-normal text-slate-500 ml-0.5">fps</span>
          </div>
          <div className="text-[9px] text-slate-500 mt-1">均值 {avgFps}</div>
        </div>

        {/* Draw Calls */}
        <div
          onClick={() => setActiveMetric('drawCalls')}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            activeMetric === 'drawCalls'
              ? 'bg-amber-950/30 border-amber-500/40 shadow-sm'
              : 'bg-slate-850/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-slate-400 font-medium">绘制批次</span>
            <Layers className="w-2.5 h-2.5 text-amber-400" />
          </div>
          <div className="text-base font-extrabold font-mono text-amber-400 leading-none">
            {currentDrawCalls}
            <span className="text-[10px] font-normal text-slate-500 ml-0.5">calls</span>
          </div>
          <div className="text-[9px] text-slate-500 mt-1">均值 {avgDrawCalls}</div>
        </div>

        {/* Render Time */}
        <div
          onClick={() => setActiveMetric('renderMs')}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            activeMetric === 'renderMs'
              ? 'bg-cyan-950/30 border-cyan-500/40 shadow-sm'
              : 'bg-slate-850/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-slate-400 font-medium">渲染耗时</span>
            <Cpu className="w-2.5 h-2.5 text-cyan-400" />
          </div>
          <div className="text-base font-extrabold font-mono text-cyan-400 leading-none">
            {currentRenderMs.toFixed(1)}
            <span className="text-[10px] font-normal text-slate-500 ml-0.5">ms</span>
          </div>
          <div className="text-[9px] text-slate-500 mt-1">峰值 {maxRenderMs}ms</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between px-3 pt-1 pb-1 text-[11px]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveMetric('all')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
              activeMetric === 'all'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            综合波形
          </button>
          <button
            onClick={() => setActiveMetric('fps')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
              activeMetric === 'fps'
                ? 'bg-emerald-600/40 text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            FPS
          </button>
          <button
            onClick={() => setActiveMetric('drawCalls')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
              activeMetric === 'drawCalls'
                ? 'bg-amber-600/40 text-amber-300 font-bold border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Draw Calls
          </button>
          <button
            onClick={() => setActiveMetric('renderMs')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
              activeMetric === 'renderMs'
                ? 'bg-cyan-600/40 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            耗时 (ms)
          </button>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          {data.length} pts
        </span>
      </div>

      {/* Chart Section */}
      <div className="h-36 px-2 pt-1 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeMetric === 'all' ? (
            <LineChart data={data} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="time" hide />
              <YAxis
                yAxisId="fps"
                domain={[0, 75]}
                stroke="#64748B"
                fontSize={9}
                tickCount={4}
              />
              <YAxis
                yAxisId="calls"
                orientation="right"
                domain={[0, 'auto']}
                stroke="#64748B"
                fontSize={9}
                tickCount={4}
                hide
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
                labelStyle={{ color: '#94A3B8' }}
              />
              <ReferenceLine yAxisId="fps" y={60} stroke="#10B981" strokeDasharray="3 3" opacity={0.4} />
              <Line
                yAxisId="fps"
                type="monotone"
                dataKey="fps"
                name="FPS 帧率"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="calls"
                type="monotone"
                dataKey="drawCalls"
                name="Draw Calls"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="calls"
                type="monotone"
                dataKey="renderMs"
                name="耗时 (ms)"
                stroke="#06B6D4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : activeMetric === 'fps' ? (
            <AreaChart data={data} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="fpsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="time" hide />
              <YAxis domain={[20, 70]} stroke="#64748B" fontSize={9} tickCount={4} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                }}
              />
              <ReferenceLine y={60} stroke="#10B981" strokeDasharray="3 3" opacity={0.6} label={{ value: '60 FPS', fill: '#10B981', fontSize: 9 }} />
              <Area
                type="monotone"
                dataKey="fps"
                name="FPS 帧率"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#fpsGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          ) : activeMetric === 'drawCalls' ? (
            <AreaChart data={data} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 'auto']} stroke="#64748B" fontSize={9} tickCount={4} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                }}
              />
              <Area
                type="monotone"
                dataKey="drawCalls"
                name="Draw Calls"
                stroke="#F59E0B"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#callGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <AreaChart data={data} margin={{ top: 5, right: 8, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="msGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 'auto']} stroke="#64748B" fontSize={9} tickCount={4} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '11px',
                }}
              />
              <ReferenceLine y={16.6} stroke="#EF4444" strokeDasharray="3 3" opacity={0.5} label={{ value: '16.6ms 警戒线', fill: '#EF4444', fontSize: 9 }} />
              <Area
                type="monotone"
                dataKey="renderMs"
                name="渲染耗时 (ms)"
                stroke="#06B6D4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#msGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Benchmark Evaluation */}
      <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Zap className="w-3 h-3 text-emerald-400" />
          <span>
            {currentFps >= 55
              ? '性能评级：卓越 (满帧 60FPS 极佳流畅)'
              : currentFps >= 40
              ? '性能评级：良好 (适合主流移动设备)'
              : '性能提示：当前场景可能存在渲染负载'}
          </span>
        </div>
        <span className="font-mono text-slate-500">
          WebGL 2.0
        </span>
      </div>
    </div>
  );
};
