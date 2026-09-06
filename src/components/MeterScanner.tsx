import React, { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, Square, Upload } from 'lucide-react';
import { createWorker } from 'tesseract.js';

interface MeterScannerProps {
  onReading: (generation: number) => void;
}

const MeterScanner: React.FC<MeterScannerProps> = ({ onReading }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [message, setMessage] = useState('Camera access stays in your browser.');

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOpen(true);
      setMessage('Point at the meter number, then scan.');
    } catch {
      setMessage('Camera permission was denied or is unavailable.');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  };

  const scanReading = async () => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      setMessage('Wait for the camera preview to load.');
      return;
    }

    setIsReading(true);
    setMessage('Reading the meter locally...');
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not capture camera frame')), 'image/jpeg', 0.9));
      const worker = await createWorker('eng');
      const result = await worker.recognize(blob);
      await worker.terminate();
      const matches = result.data.text.match(/\b\d+(?:[.,]\d+)?\s*(?:kwh)?\b/gi) ?? [];
      const value = Number.parseFloat((matches[0] ?? '').replace(',', '.'));
      if (!Number.isFinite(value) || value <= 0) {
        setMessage('No kWh value found. Move closer and try again.');
        return;
      }
      onReading(value);
      setMessage(`OCR captured ${value} kWh. Review the dashboard before recording it.`);
    } catch (error) {
      console.error('Meter OCR failed:', error);
      setMessage('OCR failed. Try better lighting or a closer frame.');
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><p className="text-sm font-black text-cyan-950">Scan a physical meter</p><p className="text-xs text-cyan-800/70">Client-side OCR. The image is not uploaded.</p></div>
        {isCameraOpen ? <button onClick={closeCamera} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-bold text-cyan-800"><Square size={13} /> Close</button> : <button onClick={openCamera} className="inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white"><Camera size={14} /> Open camera</button>}
      </div>
      {isCameraOpen && <div className="relative overflow-hidden rounded-lg bg-slate-950"><video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" /><div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-cyan-300"><ScanLine className="absolute -right-3 -top-3 text-cyan-300" size={24} /></div><button onClick={scanReading} disabled={isReading} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-cyan-900 shadow-lg disabled:opacity-60"><Upload size={14} /> {isReading ? 'Scanning...' : 'Scan reading'}</button></div>}
      <p className="mt-3 text-xs font-semibold text-cyan-900/70">{message}</p>
    </div>
  );
};

export default MeterScanner;
