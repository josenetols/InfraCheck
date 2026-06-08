/**
 * PhotoUpload.tsx
 * Responsável por:
 * - Renderizar o input de envio múltiplo de arquivos de imagem no Formulário
 * - Converter arquivos físicos em instâncias de Blob amigáveis à quota IndexedDB
 * - Exibir as pré-visualizações em base64/URL object diretamente no CheckList 
 */
import React, { useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { Photo } from '../types';

interface PhotoUploadProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  label?: string;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ photos, onPhotosChange, label = "Adicionar Fotos" }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const newFiles = Array.from(e.target.files);
    const newPhotos: Photo[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      blob: file,
      previewUrl: URL.createObjectURL(file)
    }));

    onPhotosChange([...photos, ...newPhotos]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (idToRemove: string) => {
    onPhotosChange(photos.filter(p => p.id !== idToRemove));
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label} <span className="text-slate-400 font-normal">({photos.length} anexadas)</span>
      </label>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {photos.map(photo => (
          <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shadow-sm">
            <img 
              src={photo.previewUrl || (photo as any).base64 || (photo as any).url || ''} 
              alt={photo.filename} 
              className="w-full h-full object-cover" 
            />
            <button 
              type="button"
              onClick={() => removePhoto(photo.id)}
              className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-full hover:bg-red-600 hover:scale-110 transition-all shadow-md"
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        ))}
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 gap-2 shadow-sm"
        >
          <Camera size={26} strokeWidth={1.5} />
          <span className="text-xs font-bold uppercase tracking-wider">Tirar Foto</span>
        </button>
      </div>

      <input 
        type="file" 
        multiple 
        accept="image/*" 
        capture="environment"
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </div>
  );
};


