import React from 'react';
import styles from './AnimatedRibbons.module.css';

// Tipos para las propiedades del componente
interface RibbonItem {
  items: string[];
  direction: 'left' | 'right';
  color: 'purple' | 'blue' | 'red' | 'green' | 'orange';
  rotation: number;
}

interface AnimatedRibbonsProps {
  ribbons?: RibbonItem[];
  className?: string;
  speed?: number;
}

// Datos por defecto
const defaultRibbons: RibbonItem[] = [
  {
    items: ['Smart Bookings', 'Automated Management', 'Happy Customers', 'Optimized Schedules', 'Zero Commissions', 'Easy to Use'],
    direction: 'left',
    color: 'purple',
    rotation: 20
  },
  {
    items: ['Booking System', 'Appointments', 'Online Reservations', 'Business Growth', 'Time Management', 'Customer Service'],
    direction: 'right',
    color: 'purple',
    rotation: -20
  }
];

const AnimatedRibbons: React.FC<AnimatedRibbonsProps> = ({ 
  ribbons = defaultRibbons,
  className = '',
  speed = 20
}) => {
  const getRibbonClass = (color: RibbonItem['color']): string => {
    switch(color) {
      case 'purple': return styles.ribbonPurple;
      case 'blue': return styles.ribbonBlue;
      case 'red': return styles.ribbonRed;
      case 'green': return styles.ribbonGreen;
      case 'orange': return styles.ribbonOrange;
      default: return styles.ribbonPurple;
    }
  };

  const getMarqueeClass = (direction: RibbonItem['direction']): string => {
    return direction === 'right' ? styles.marqueeReverse : styles.marquee;
  };

  return (
    <div className={`${styles.ribbonContainer} ${className}`}>
      {ribbons.map((ribbon, index) => (
        <div 
          key={index}
          className={`${styles.ribbon} ${getRibbonClass(ribbon.color)}`}
          style={{
            transform: `rotate(${ribbon.rotation}deg)`,
            animationDelay: `${index * 0.5}s`
          }}
        >
          <div 
            className={getMarqueeClass(ribbon.direction)}
            style={{
              animationDuration: `${speed + (index * 5)}s`
            }}
          >
            {/* Duplicamos el contenido para animación continua */}
            {[...Array(2)].map((_, dupIndex) => (
              <React.Fragment key={dupIndex}>
                {ribbon.items.map((item, itemIndex) => (
                  <React.Fragment key={`${dupIndex}-${itemIndex}`}>
                    <div className={styles.marqueeItem}>{item}</div>
                    {itemIndex < ribbon.items.length - 1 && (
                      <div className={styles.separator}>/</div>
                    )}
                  </React.Fragment>
                ))}
                {dupIndex === 0 && <div className={styles.separator}>/</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnimatedRibbons;