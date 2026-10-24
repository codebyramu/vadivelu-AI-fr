import React, { useEffect, useRef } from 'react';

interface SonicWaveformVisualizerProps {
  analyserNode?: AnalyserNode | null;
  isActive?: boolean;
  state?: 'listening' | 'speaking' | 'processing' | 'idle';
  className?: string;
}

export const SonicWaveformVisualizer: React.FC<SonicWaveformVisualizerProps> = ({
  analyserNode,
  isActive = false,
  state = 'idle',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const dataArray = analyserNode ? new Uint8Array(analyserNode.frequencyBinCount) : null;

    const render = () => {
      time += 0.04;

      // Handle retina displays
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.28;

      ctx.clearRect(0, 0, width, height);

      // Get real audio frequency data if available
      let audioPower = 0;
      if (analyserNode && dataArray) {
        analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        audioPower = sum / (dataArray.length * 255); // 0 to 1
      }

      // If active without direct audio analyser, simulate gentle or active pulse
      if (isActive && audioPower === 0) {
        if (state === 'speaking') {
          audioPower = 0.35 + Math.sin(time * 3) * 0.2 + Math.cos(time * 7) * 0.15;
        } else if (state === 'listening') {
          audioPower = 0.2 + Math.sin(time * 2) * 0.1;
        } else if (state === 'processing') {
          audioPower = 0.25 + Math.sin(time * 5) * 0.15;
        }
      }

      const pulseFactor = Math.max(0, Math.min(1.5, audioPower));

      // 1. Draw concentric ripples (background rings)
      const ringCount = 14;
      const maxRadius = Math.min(width, height) * 0.46;
      const radiusStep = (maxRadius - baseRadius * 0.5) / ringCount;

      for (let i = 0; i < ringCount; i++) {
        const ringRadius = baseRadius * 0.6 + i * radiusStep + Math.sin(time + i * 0.4) * (2 + pulseFactor * 5);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);

        // Alpha calculation: inner rings brighter, outer rings fade into deep blue
        const distFromCenter = i / ringCount;
        let alpha = (1 - distFromCenter * 0.8) * 0.35;
        if (state === 'speaking' || state === 'listening') {
          alpha += pulseFactor * 0.25;
        }

        ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(0.85, Math.max(0.08, alpha))})`;
        ctx.lineWidth = i % 2 === 0 ? 1.5 : 1;
        ctx.shadowColor = '#0ea5e9';
        ctx.shadowBlur = i % 3 === 0 ? 8 + pulseFactor * 12 : 2;
        ctx.stroke();
      }

      // 2. Draw prominent center glowing core circle
      const coreRadius = baseRadius + Math.sin(time * 1.5) * 2 + pulseFactor * 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18 + pulseFactor * 15;
      ctx.stroke();

      // Core inner ambient glow
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
      grad.addColorStop(0, 'rgba(14, 165, 233, 0.08)');
      grad.addColorStop(0.7, 'rgba(14, 165, 233, 0.03)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // 3. Draw horizontal sonic frequency waveform across the center
      const wavePoints = 80;
      const waveWidth = width * 0.82;
      const startX = (width - waveWidth) / 2;
      const stepX = waveWidth / wavePoints;

      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 12 + pulseFactor * 14;

      // Draw vertical waveform spikes (like in screenshot 1)
      for (let i = 0; i <= wavePoints; i++) {
        const x = startX + i * stepX;
        const normDist = 1 - Math.abs((i - wavePoints / 2) / (wavePoints / 2)); // 0 at edges, 1 at center
        const bellCurve = Math.pow(normDist, 2.2);

        let spikeHeight = 4;
        if (analyserNode && dataArray && dataArray.length > 0) {
          const freqIndex = Math.floor((i / wavePoints) * (dataArray.length * 0.6));
          const val = dataArray[freqIndex] / 255;
          spikeHeight = val * 120 * bellCurve + 4;
        } else {
          // Synthetic ambient wave
          const wave1 = Math.sin(time * 2.5 + i * 0.2);
          const wave2 = Math.cos(time * 1.8 + i * 0.35);
          const activeAmp = (state === 'speaking' || state === 'listening' || state === 'processing')
            ? (25 + pulseFactor * 70)
            : 12;
          spikeHeight = Math.abs(wave1 * wave2) * activeAmp * bellCurve + 3;
        }

        // Draw vertical spike
        ctx.beginPath();
        ctx.moveTo(x, centerY - spikeHeight);
        ctx.lineTo(x, centerY + spikeHeight);

        const spikeAlpha = 0.2 + bellCurve * 0.75 + pulseFactor * 0.2;
        ctx.strokeStyle = `rgba(186, 230, 253, ${Math.min(1, spikeAlpha)})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Draw continuous horizontal center glow line
      ctx.beginPath();
      ctx.moveTo(startX, centerY);
      for (let i = 0; i <= wavePoints; i++) {
        const x = startX + i * stepX;
        const normDist = 1 - Math.abs((i - wavePoints / 2) / (wavePoints / 2));
        const bellCurve = Math.pow(normDist, 1.8);
        const yOffset = Math.sin(time * 3 + i * 0.25) * (4 + pulseFactor * 14) * bellCurve;
        ctx.lineTo(x, centerY + yOffset);
      }
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 15;
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isActive, state]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={680}
        height={680}
        className="w-full max-w-[540px] aspect-square pointer-events-none select-none"
      />
    </div>
  );
};
