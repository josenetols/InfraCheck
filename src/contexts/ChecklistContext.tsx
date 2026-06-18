
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ChecklistData, initialChecklistState, SwitchDevice, AntennaDevice, ProblematicMachine, ProblematicNetworkPoint, Photo } from '../types';

/**
 * Gerador de ID único compatível com HTTP (sem HTTPS/contexto seguro).
 * crypto.randomUUID() falha em HTTP puro — esta função é um fallback seguro.
 */
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch {}
  }
  // Fallback: Math.random + timestamp (funciona em qualquer contexto)
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
};

// Context API - Removed direct constants and db imports if not directly used here, otherwise:
interface ChecklistContextType {
  data: ChecklistData;
  setData: React.Dispatch<React.SetStateAction<ChecklistData>>;
  updateField: (field: keyof ChecklistData, value: any) => void;
  addSwitch: () => void;
  removeSwitch: (id: string) => void;
  updateSwitch: (id: string, field: keyof SwitchDevice, value: any) => void;
  addAntenna: () => void;
  removeAntenna: (id: string) => void;
  updateAntenna: (id: string, field: keyof AntennaDevice, value: any) => void;
  addMachine: () => void;
  removeMachine: (id: string) => void;
  updateMachine: (id: string, field: keyof ProblematicMachine, value: any) => void;
  addNetworkPoint: () => void;
  removeNetworkPoint: (id: string) => void;
  updateNetworkPoint: (id: string, field: keyof ProblematicNetworkPoint, value: any) => void;
  handleCpdPhotosChange: (photos: Photo[]) => void;
}

const ChecklistContext = createContext<ChecklistContextType | undefined>(undefined);

export const ChecklistProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<ChecklistData>(initialChecklistState);

  const updateField = (field: keyof ChecklistData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleCpdPhotosChange = (photos: Photo[]) => {
    updateField('cpdPhotos', photos);
  };

  const addSwitch = () => {
    const newSwitch: SwitchDevice = { id: generateId(), quantity: 1, brand: '', model: '', ports: 24, conditionOk: true, notes: '', status: 'new' };
    setData(prev => ({ ...prev, switches: [newSwitch, ...prev.switches] }));
  };
  const removeSwitch = (id: string) => setData(prev => ({ ...prev, switches: prev.switches.filter(s => s.id !== id) }));
  const updateSwitch = (id: string, field: keyof SwitchDevice, value: any) => setData(prev => ({
    ...prev, switches: prev.switches.map(s => s.id === id ? { ...s, [field]: value, status: s.status === 'new' ? 'new' : 'updated' } : s)
  }));

  const addAntenna = () => {
    const newAntenna: AntennaDevice = { id: generateId(), quantity: 1, brand: '', location: '', isWorking: true, notes: '', status: 'new' };
    setData(prev => ({ ...prev, antennas: [newAntenna, ...prev.antennas] }));
  };
  const removeAntenna = (id: string) => setData(prev => ({ ...prev, antennas: prev.antennas.filter(a => a.id !== id) }));
  const updateAntenna = (id: string, field: keyof AntennaDevice, value: any) => setData(prev => ({
    ...prev, antennas: prev.antennas.map(a => a.id === id ? { ...a, [field]: value, status: a.status === 'new' ? 'new' : 'updated' } : a)
  }));

  const addMachine = () => {
    const newMachine: ProblematicMachine = { id: generateId(), identifier: '', processorGen: '', osUpdated: true, problemDescription: '', photos: [], status: 'new' };
    setData(prev => ({ ...prev, problematicMachines: [newMachine, ...prev.problematicMachines] }));
  };
  const removeMachine = (id: string) => setData(prev => ({ ...prev, problematicMachines: prev.problematicMachines.filter(m => m.id !== id) }));
  const updateMachine = (id: string, field: keyof ProblematicMachine, value: any) => setData(prev => ({
    ...prev, problematicMachines: prev.problematicMachines.map(m => m.id === id ? { ...m, [field]: value } : m)
  }));

  const addNetworkPoint = () => {
    const newPoint: ProblematicNetworkPoint = { id: generateId(), location: '', description: '', photos: [], status: 'new' };
    setData(prev => ({ ...prev, problematicNetworkPoints: [newPoint, ...prev.problematicNetworkPoints] }));
  };
  const removeNetworkPoint = (id: string) => setData(prev => ({ ...prev, problematicNetworkPoints: prev.problematicNetworkPoints.filter(p => p.id !== id) }));
  const updateNetworkPoint = (id: string, field: keyof ProblematicNetworkPoint, value: any) => setData(prev => ({
    ...prev, problematicNetworkPoints: prev.problematicNetworkPoints.map(p => p.id === id ? { ...p, [field]: value } : p)
  }));

  return (
    <ChecklistContext.Provider value={{
      data, setData, updateField,
      addSwitch, removeSwitch, updateSwitch,
      addAntenna, removeAntenna, updateAntenna,
      addMachine, removeMachine, updateMachine,
      addNetworkPoint, removeNetworkPoint, updateNetworkPoint,
      handleCpdPhotosChange
    }}>
      {children}
    </ChecklistContext.Provider>
  );
};

export const useChecklist = () => {
  const context = useContext(ChecklistContext);
  if (!context) {
    throw new Error('useChecklist must be used within a ChecklistProvider');
  }
  return context;
};

