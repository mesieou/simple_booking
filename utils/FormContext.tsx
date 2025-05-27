'use client';

import { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';

// Definir el tipo de los datos del formulario
export type FormDataType = {
  id: string;
  pickup: string;
  dropoff: string;
  size: string;
  userid: string;
  businessid: string;
  
  arrivaldate: string;
  travelcostestimate: string;
  status: string;
  calculateTotalJobCostEstimation: string;
  traveltimeestimete: string;
  traveltimeestimatenumber: number;
  totalJobCostEstimation: string;
  serviceid: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  isBusinessMobile: boolean;
};

// Definir el tipo del contexto
interface FormContextType {
  data: FormDataType;
  setData: Dispatch<SetStateAction<FormDataType>>;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

// Tipar las props del provider
interface FormProviderProps {
  children: ReactNode;
}

export const FormProvider = ({ children }: FormProviderProps) => {
  const [data, setData] = useState<FormDataType>({
    id: '',
    pickup: '',
    dropoff: '',
    size: '',
    userid: '',
    businessid: '',
    arrivaldate: '',
    travelcostestimate: '',
    status: '',
    calculateTotalJobCostEstimation: '',
    traveltimeestimete: '',
    traveltimeestimatenumber: 0,
    totalJobCostEstimation: '',
    serviceid: '',
    createdAt: '',
    updatedAt: '',
    notes: '',
    isBusinessMobile: false,
  });

  return (
    <FormContext.Provider value={{ data, setData }}>
      {children}
    </FormContext.Provider>
  );
};

export const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) throw new Error('useFormContext debe usarse dentro de FormProvider');
  return context;
};
