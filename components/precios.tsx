'use client';

export default function Precios() {

    const base = 46;
    const traveled = 19;
    const labor_min = 213;
    const total =  base + traveled + labor_min;

    return (
            

            <div className="lg:col-span-5">
                <section className="space-y-2 md:space-y-3 mt-8 text-color bg-muted rounded-md">
                    <div className="flex items-center justify-between">
                        <p className="text-2xl md:text-label-1"> Base fare
                            <span className="text-3xl text-gray-700" >( )</span>
                        </p>
                        <p className="text-2xl">$ {base}</p>
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-2xl md:text-label-1"> Traveled miles
                            <span className="text-3xl text-gray-700" >( )</span>
                        </p>
                        <p className="text-2xl">$ {traveled}</p>
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-2xl md:text-label-1"> Labor fee
                            <span className="text-3xl text-gray-700" >( )</span>
                        </p>
                        <p className="text-2xl">$ {labor_min}</p>
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-3xl md:text-label-1"> Total price
                            <span className="text-3xl text-gray-700" >( )</span>
                        </p>
                        <p className="text-3xl">$ {total}</p>
                    </div>
                </section>
            </div>
        
    )
}