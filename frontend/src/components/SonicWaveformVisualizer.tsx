import React, { useEffect, useRef } from 'react';

interface SonicWaveformVisualizerProps {
  analyserNode?: AnalyserNode | null;
  isActive?: boolean;
  state?: 'listening' | 'speaking' | 'processing' | 'idle';
  isDarkTheme?: boolean;
  className?: string;
}

/**
 * Organic Fluid Voice Orb Visualizer (ChatGPT Advanced Voice Mode style)
 * Replaces technical radar rings with a living, breathing fluid monochrome sphere.
 */
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
      time += 0.025;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const minDim = Math.min(width, height);
      const baseRadius = minDim * 0.28;

      ctx.clearRect(0, 0, width, height);

      // Real audio power calculation
      let audioPower = 0;
      if (analyserNode && dataArray) {
        analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        const bins = Math.min(dataArray.length, 64);
        for (let i = 0; i < bins; i++) {
          sum += dataArray[i];
        }
        audioPower = sum / (bins * 255);
      }

      // Smooth simulation fallback
      if (isActive && audioPower === 0) {
        if (state === 'speaking') {
          audioPower = 0.35 + Math.sin(time * 3.5) * 0.15 + Math.cos(time * 5.2) * 0.1;
        } else if (state === 'listening') {
          audioPower = 0.18 + Math.sin(time * 2.2) * 0.08;
        } else if (state === 'processing') {
          audioPower = 0.25 + Math.sin(time * 4) * 0.12;
        }
      }

      const pulse = Math.max(0, Math.min(1.2, audioPower));

      // Color tokens
      const isDark = isDarkTheme;
      const primaryRgb = isDark ? '255, 255, 255' : '0, 0, 0';
      const shadowColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)';

      // 1. Ambient Outer Halo (Soft Radial Glow)
      const haloRadius = baseRadius * (1.6 + pulse * 0.4);
      const haloGrad = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.4, centerX, centerY, haloRadius);
      haloGrad.addColorStop(0, `rgba(${primaryRgb}, ${isDark ? 0.12 + pulse * 0.15 : 0.08 + pulse * 0.1})`);
      haloGrad.addColorStop(0.5, `rgba(${primaryRgb}, ${isDark ? 0.04 + pulse * 0.06 : 0.03 + pulse * 0.04})`);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Fluid Harmonic Contour Rings (3 organic layers deforming dynamically)
      const layers = [
        { radius: baseRadius * 1.15, speed: 2.2, freq: 4, amp: 8 + pulse * 22, alpha: isDark ? 0.25 : 0.2 },
        { radius: baseRadius * 1.0, speed: 1.8, freq: 5, amp: 10 + pulse * 26, alpha: isDark ? 0.5 : 0.35 },
        { radius: baseRadius * 0.85, speed: 1.4, freq: 3, amp: 6 + pulse * 18, alpha: isDark ? 0.85 : 0.65 },
      ];

      layers.forEach((layer, layerIdx) => {
        ctx.beginPath();
        const steps = 90;
        const angleStep = (Math.PI * 2) / steps;

        for (let i = 0; i <= steps; i++) {
          const angle = i * angleStep;
          const offset1 = Math.sin(angle * layer.freq + time * layer.speed + layerIdx) * layer.amp;
          const offset2 = Math.cos(angle * 2 - time * 1.2) * (layer.amp * 0.4);
          const r = layer.radius + offset1 + offset2;

          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        ctx.strokeStyle = `rgba(${primaryRgb}, ${layer.alpha})`;
        ctx.lineWidth = layerIdx === 2 ? 2.5 : 1.2;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = layerIdx === 2 ? 14 + pulse * 12 : 6;
        ctx.stroke();

        // Fill innermost fluid core with subtle gradient
        if (layerIdx === 2) {
          const innerGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius);
          innerGrad.addColorStop(0, `rgba(${primaryRgb}, ${isDark ? 0.2 + pulse * 0.2 : 0.15 + pulse * 0.15})`);
          innerGrad.addColorStop(1, `rgba(${primaryRgb}, 0.02)`);
          ctx.fillStyle = innerGrad;
          ctx.fill();
        }
      });

      // 3. Center Breathing Particle Core
      const corePulse = Math.sin(time * 2.5) * 3 + pulse * 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(4, baseRadius * 0.35 + corePulse), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${primaryRgb}, ${isDark ? 0.95 : 0.9})`;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 18 + pulse * 15;
      ctx.fill();

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
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className={`block select-none pointer-events-none ${className}`}
    />
  );
};
