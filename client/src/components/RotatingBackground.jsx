import { useState, useEffect } from 'react';

const SLIDES = [
  { img: '/bg/bg0.jpg', gradient: 'linear-gradient(135deg, #3a0800 0%, #8b1a00 50%, #1a0a00 100%)' },
  { img: '/bg/bg1.jpg', gradient: 'linear-gradient(135deg, #001830 0%, #003060 50%, #000a18 100%)' },
  { img: '/bg/bg2.jpg', gradient: 'linear-gradient(135deg, #0a2200 0%, #1a4a00 50%, #081200 100%)' },
  { img: '/bg/bg3.jpg', gradient: 'linear-gradient(135deg, #200030 0%, #4a005a 50%, #100018 100%)' },
];

export default function RotatingBackground({ interval = 8000 }) {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState({});

  useEffect(() => {
    // 事前に全画像をpreload
    SLIDES.forEach((s, i) => {
      const img = new Image();
      img.onload = () => setLoaded((prev) => ({ ...prev, [i]: true }));
      img.src = s.img;
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % SLIDES.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            background: loaded[i]
              ? `url(${slide.img}) center/cover no-repeat`
              : slide.gradient,
            opacity: i === idx ? 1 : 0,
            transition: 'opacity 1.8s ease-in-out',
          }}
        />
      ))}
      {/* 暗めオーバーレイ */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10, 3, 0, 0.6)' }} />
    </div>
  );
}
