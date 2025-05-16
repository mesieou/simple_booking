'use client';

import { useLanguage } from "@/lib/translations/language-context";

interface PreciosProps {
    base?: number;
    duracion?: string | null;
    price_distance?: number;
}

export default function Precios({ base = 46, duracion = null, price_distance = 1 }: PreciosProps) {
    const { t } = useLanguage();
    
    // Calcular el costo basado en la duración
    const calculateTraveledCost = () => {
        if (!duracion) return 0;
        
        // Extraer horas y minutos del formato "X hours Y mins" o "X mins"
        const hoursMatch = duracion.match(/(\d+)\s*hours?/);
        const minutesMatch = duracion.match(/(\d+)\s*mins?/);
        
        let totalMinutes = 0;
        
        if (hoursMatch) {
            totalMinutes += parseInt(hoursMatch[1]) * 60;
        }
        
        if (minutesMatch) {
            totalMinutes += parseInt(minutesMatch[1]);
        }
        
        return Math.round(totalMinutes * price_distance);
    };

    const traveled = calculateTraveledCost();
    const labor_min = 213;
    const total = base + traveled + labor_min;

    return (
        <section className="w-full max-w-2xl mx-auto p-6 bg-card rounded-lg shadow-md space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent/10 transition-colors">
                <p className="text-lg md:text-xl font-medium text-foreground">
                    {t('base')}
                    <span className="text-sm text-muted-foreground ml-2">( )</span>
                </p>
                <p className="text-lg md:text-xl font-semibold text-[hsl(var(--chart-4))]">$ {base}</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent/10 transition-colors">
                <p className="text-lg md:text-xl font-medium text-foreground">
                    {t('miles')}
                    <span className="text-sm text-muted-foreground ml-2">({duracion || '--'})</span>
                </p>
                <p className="text-lg md:text-xl font-semibold text-[hsl(var(--chart-4))]">$ {traveled}</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent/10 transition-colors">
                <p className="text-lg md:text-xl font-medium text-foreground">
                    {t('labor')}
                    <span className="text-sm text-muted-foreground ml-2">( )</span>
                </p>
                <p className="text-lg md:text-xl font-semibold text-[hsl(var(--chart-4))]">$ {labor_min}</p>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-4" />

            <div className="flex items-center justify-between p-3 rounded-md bg-primary/10">
                <p className="text-xl md:text-2xl font-semibold text-foreground">
                    {t('total')}
                    <span className="text-sm text-muted-foreground ml-2">( )</span>
                </p>
                <p className="text-xl md:text-2xl font-bold text-[hsl(var(--chart-4))]">
                    $ {total}
                </p>
            </div>
        </section>
    )
}