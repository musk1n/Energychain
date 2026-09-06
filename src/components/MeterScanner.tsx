import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, ScanLine, Square, Upload } from 'lucide-react';
import { createWorker } from 'tesseract.js';

interface MeterScannerProps {
  onReading: (generation: number, rawText: string) => void;
}

const MeterScanner: React.FC<MeterScannerProps> = ({ onReading }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [message, setMessage] = useState('Camera access stays in your browser.');
  const [rawText, setRawText] = useState('');
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [isCameraOpen]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const openCamera = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera needs an HTTPS deployment or localhost. Use Upload meter photo below.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setMessage('Point at the meter number, then scan.');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      setMessage(name === 'NotAllowedError' ? 'Camera permission is blocked. Allow camera access in browser settings, then try again.' : 'Camera is unavailable. Use Upload meter photo below.');
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  };

  const recognizeImage = async (image: Blob) => {
    setIsReading(true);
    setMessage('Reading the meter locally...');
    try {
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789.,',
        tessedit_pageseg_mode: '6'
      });
      const result = await worker.recognize(image);
      await worker.terminate();
      const extractedText = result.data.text.trim();
      setRawText(extractedText || 'No text detected');
      const matches = extractedText.match(/\b\d{2,7}(?:[.,]\d{1,3})?\b/g) ?? [];
      const value = Number.parseFloat((matches[0] ?? '').replace(',', '.'));
      const confidence = result.data.confidence ?? 0;
      if (!Number.isFinite(value) || value <= 0) {
        setMessage('OCR could not confidently read the meter. Move closer, center the display, or enter the value manually.');
        return;
      }
      setManualValue(value.toString());
      setMessage(`OCR proposed ${value} kWh${confidence > 0 ? ` at ${Math.round(confidence)}% confidence` : ''}. Confirm or correct it below.`);
    } catch (error) {
      console.error('Meter OCR failed:', error);
      setMessage('OCR failed. Try better lighting or a closer frame.');
    } finally {
      setIsReading(false);
    }
  };

  const confirmReading = () => {
    const value = Number(manualValue);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage('Enter a valid kWh value before confirming.');
      return;
    }
    onReading(value, rawText);
    setMessage(`${value} kWh applied to the dashboard. You can now record it on-chain.`);
  };

  const scanReading = async () => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      setMessage('Wait for the camera preview to load.');
      return;
    }
    const canvas = document.createElement('canvas');
    const sourceWidth = videoRef.current.videoWidth;
    const sourceHeight = videoRef.current.videoHeight;
    const cropWidth = Math.floor(sourceWidth * 0.78);
    const cropHeight = Math.floor(sourceHeight * 0.52);
    canvas.width = cropWidth * 2;
    canvas.height = cropHeight * 2;
    const context = canvas.getContext('2d');
    if (!context) {
      setMessage('Could not prepare the camera frame.');
      return;
    }
    context.filter = 'grayscale(1) contrast(1.8) brightness(1.1)';
    context.drawImage(videoRef.current, Math.floor((sourceWidth - cropWidth) / 2), Math.floor((sourceHeight - cropHeight) / 2), cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not capture camera frame')), 'image/jpeg', 0.9));
    await recognizeImage(blob);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void recognizeImage(file);
  };

  return (
    <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><p className="text-sm font-black text-cyan-950">Scan a physical meter</p><p className="text-xs text-cyan-800/70">Client-side OCR. The image is not uploaded.</p></div>
        {isCameraOpen ? <button onClick={closeCamera} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-bold text-cyan-800"><Square size={13} /> Close</button> : <button onClick={openCamera} className="inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white"><Camera size={14} /> Open camera</button>}
      </div>
      {isCameraOpen && <div className="relative overflow-hidden rounded-lg bg-slate-950"><video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" /><div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-cyan-300"><ScanLine className="absolute -right-3 -top-3 text-cyan-300" size={24} /></div><button onClick={scanReading} disabled={isReading} className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-cyan-900 shadow-lg disabled:opacity-60"><Upload size={14} /> {isReading ? 'Scanning...' : 'Scan reading'}</button></div>}
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-bold text-cyan-800"><Upload size={14} /> Upload meter photo<input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" /></label>
      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-end justify-between gap-3"><div><label className="text-xs font-bold uppercase tracking-wider text-emerald-700">Meter reading to apply</label><div className="mt-1 flex items-center gap-2"><input value={manualValue} onChange={event => setManualValue(event.target.value)} type="number" min="0.01" step="0.01" placeholder="e.g. 506" className="w-28 rounded-lg border border-emerald-200 bg-white px-2 py-2 text-xl font-black text-emerald-950" /><span className="text-sm font-bold text-emerald-800">kWh</span></div></div><button onClick={confirmReading} disabled={!manualValue} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={14} /> Use this reading</button></div><p className="mt-2 max-h-16 overflow-auto whitespace-pre-wrap border-t border-emerald-200 pt-2 font-mono text-[11px] text-emerald-900/70">Raw OCR: {rawText || 'Scan a meter to see exactly what OCR detected.'}</p></div>
      <p className="mt-3 text-xs font-semibold text-cyan-900/70">{message}</p>
    </div>
  );
};

export default MeterScanner;
