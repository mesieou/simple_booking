'use client';

import { useLanguage } from "@/lib/translations/language-context";

export default function Precios() {
    const { t } = useLanguage();
    const base = 46;
    const traveled = 19;
    const labor_min = 213;
    const total = base + traveled + labor_min;

    return (
        <section className="w-full max-w-2xl mx-auto p-6 bg-card rounded-lg shadow-md space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent/10 transition-colors">
                <p className="text-lg md:text-xl font-medium text-foreground">
                    {t('base')}
                    <span className="text-sm text-muted-foreground ml-2">( )</span>
                </p>
                <p className="text-lg md:text-xl font-semibold text-[rgb(250,204,21)]">$ {base}</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent/10 transition-colors">
                <p className="text-lg md:text-xl font-medium text-foreground">
                    {t('miles')}
                    <span className="text-sm text-muted-foreground ml-2">( )</span>
                </p>
                <p className="text-lg md:text-xl font-semibold text-[rgb(250,204,21)]">$ {traveled}</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md hover:bg-accent/10 transition-colors">
                <p className="text-lg md:text-xl font-medium text-foreground">
                    {t('labor')}
                    <span className="text-sm text-muted-foreground ml-2">( )</span>
                </p>
                <p className="text-lg md:text-xl font-semibold text-[rgb(250,204,21)]">$ {labor_min}</p>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-4" />

            <div className="flex items-center justify-between p-3 rounded-md bg-primary/10">
                <p className="text-xl md:text-2xl font-semibold text-foreground">
                    {t('total')}
                    <span className="text-sm text-muted-foreground ml-2">( )</span>
                </p>
                <p className="text-xl md:text-2xl font-bold text-[rgb(250,204,21)]">
                    $ {total}
                </p>
            </div>
        </section>
    )
}