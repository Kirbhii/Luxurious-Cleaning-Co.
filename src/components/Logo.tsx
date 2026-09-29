import logoImg from '../imports/image-3.png';

interface LogoProps {
  /** Display height in px. Native file is 484x169 — keep at/below 64px so it stays crisp on retina screens. */
  height?: number;
  align?: 'left' | 'center';
  className?: string;
}

export default function Logo({ height = 64, align = 'left', className = '' }: LogoProps) {
  const width = Math.round((height * 484) / 169);
  return (
    <div className={`flex items-center ${align === 'center' ? 'justify-center' : 'justify-start'} ${className}`}>
      <img
        src={logoImg}
        alt="Luxurious Cleaning Co."
        width={width}
        height={height}
        draggable={false}
        className="object-contain select-none"
        style={{ height, width: 'auto', maxWidth: 320 }}
      />
    </div>
  );
}
