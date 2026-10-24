import React, { useEffect, useRef } from 'react';

interface SonicWaveformVisualizerProps {
  analyserNode?: AnalyserNode | null;
  isActive?: boolean;
  state?: 'listening' | 'speaking' | 'processing' | 'idle';
  isDarkTheme?: boolean;
  className?: string;
}

export const SonicWaveformVisualizer: React.FC<SonicWaveformVisualizerProps> = ({
  analyserNode,
  isActive = false,
  state = 'idle',
  isDarkTheme = true,
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
      time += 0.035;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.27;

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
          audioPower = 0.32 + Math.sin(time * 3) * 0.18 + Math.cos(time * 6) * 0.12;
        } else if (state === 'listening') {
          audioPower = 0.18 + Math.sin(time * 2.2) * 0.08;
        } else if (state === 'processing') {
          audioPower = 0.24 + Math.sin(time * 4) * 0.12;
        }
      }

      const pulseFactor = Math.max(0, Math.min(1.4, audioPower));

      // Pure Monochrome Tokens:
      // Dark mode: Full pure white sound waves over black
      // Light mode: Full pure black sound waves over white
      const ringColorBase = isDarkTheme ? '255, 255, 255' : '0, 0, 0';
      const shadowColor = isDarkTheme ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
      const coreStrokeColor = isDarkTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.85)';
      const coreAuraColor = isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
      const spikeColorBase = isDarkTheme ? '255, 255, 255' : '0, 0, 0';
      const centerLineStroke = isDarkTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.85)';

      // 1. Draw concentric ripples (background rings)
      const ringCount = 12;
      const maxRadius = Math.min(width, height) * 0.45;
      const radiusStep = (maxRadius - baseRadius * 0.5) / ringCount;

      for (let i = 0; i < ringCount; i++) {
        const ringRadius = baseRadius * 0.6 + i * radiusStep + Math.sin(time + i * 0.4) * (1.5 + pulseFactor * 4);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);

        const distFromCenter = i / ringCount;
        let alpha = (1 - distFromCenter * 0.85) * (isDarkTheme ? 0.32 : 0.24);
        if (state === 'speaking' || state === 'listening') {
          alpha += pulseFactor * 0.2;
        }

        ctx.strokeStyle = `rgba(${ringColorBase}, ${Math.min(0.75, Math.max(0.06, alpha))})`;
        ctx.lineWidth = i % 2 === 0 ? 1.25 : 0.9;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = i % 3 === 0 ? 6 + pulseFactor * 8 : 1.5;
        ctx.stroke();
      }

      // 2. Draw center glowing core circle
      const coreRadius = baseRadius + Math.sin(time * 1.5) * 1.8 + pulseFactor * 6;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.strokeStyle = coreStrokeColor;
      ctx.lineWidth = 2.0;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 10 + pulseFactor * 10;
      ctx.stroke();

      // Core inner ambient glow
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
      grad.addColorStop(0, coreAuraColor);
      grad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // 3. Draw horizontal sonic frequency waveform across the center
      const wavePoints = 72;
      const waveWidth = width * 0.78;
      const startX = (width - waveWidth) / 2;
      const stepX = waveWidth / wavePoints;

      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 8 + pulseFactor * 8;

      // Draw vertical waveform spikes
      for (let i = 0; i <= wavePoints; i++) {
        const x = startX + i * stepX;
        const normDist = 1 - Math.abs((i - wavePoints / 2) / (wavePoints / 2));
        const bellCurve = Math.pow(normDist, 2.0);

        let spikeHeight = 3;
        if (analyserNode && dataArray && dataArray.length > 0) {
          const freqIndex = Math.floor((i / wavePoints) * (dataArray.length * 0.6));
          const val = dataArray[freqIndex] / 255;
          spikeHeight = val * 90 * bellCurve + 3;
        } else {
          // Synthetic ambient wave
          const wave1 = Math.sin(time * 2.2 + i * 0.22);
          const wave2 = Math.cos(time * 1.6 + i * 0.32);
          const activeAmp = (state === 'speaking' || state === 'listening' || state === 'processing')
            ? (20 + pulseFactor * 55)
            : 8;
          spikeHeight = Math.abs(wave1 * wave2) * activeAmp * bellCurve + 2.5;
        }

        ctx.beginPath();
        ctx.moveTo(x, centerY - spikeHeight);
        ctx.lineTo(x, centerY + spikeHeight);

        const spikeAlpha = (isDarkTheme ? 0.25 : 0.2) + bellCurve * 0.65 + pulseFactor * 0.15;
        ctx.strokeStyle = `rgba(${spikeColorBase}, ${Math.min(0.92, spikeAlpha)})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Draw continuous horizontal center glow line
      ctx.beginPath();
      ctx.moveTo(startX, centerY);
      for (let i = 0; i <= wavePoints; i++) {
        const x = startX + i * stepX;
        const normDist = 1 - Math.abs((i - wavePoints / 2) / (wavePoints / 2));
        const bellCurve = Math.pow(normDist, 1.8);
        const yOffset = Math.sin(time * 2.8 + i * 0.25) * (3 + pulseFactor * 10) * bellCurve;
        ctx.lineTo(x, centerY + yOffset);
      }
      ctx.strokeStyle = centerLineStroke;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 10;
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isActive, state, isDarkTheme]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={480}
        height={480}
        className="w-full h-full max-w-[340px] aspect-square pointer-events-none select-none"
      />
    </div>
  );
};
