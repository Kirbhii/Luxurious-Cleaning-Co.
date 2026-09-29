import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { validateResumeFile } from '../lib/supabase';

interface ResumeUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
}

export default function ResumeUpload({
  file,
  onChange,
  label = 'Resume',
  hint = 'PDF or Word (.pdf, .doc, .docx), max 5MB',
}: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError('');
    if (!selected) {
      onChange(null);
      return;
    }
    const validationError = validateResumeFile(selected);
    if (validationError) {
      setError(validationError);
      e.target.value = '';
      onChange(null);
      return;
    }
    onChange(selected);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = '';
    setError('');
    onChange(null);
  }

  return (
    <div>
      <label className="block text-xs text-cream-300 mb-1.5">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleSelect}
        className="hidden"
      />
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-gold-400/25 hover:border-gold-400/50 rounded-lg px-4 py-3.5 text-sm text-cream-300 hover:text-cream-100 transition-colors"
        >
          <Upload size={15} className="text-gold-400" />
          Choose file
        </button>
      ) : (
        <div className="w-full flex items-center gap-3 bg-navy-700 border border-gold-400/15 rounded-lg px-4 py-2.5">
          <FileText size={16} className="text-gold-400 shrink-0" />
          <span className="flex-1 text-sm text-cream-100 truncate">{file.name}</span>
          <span className="text-xs text-cream-300/60 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove file"
            className="text-cream-300 hover:text-red-400 transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {error ? (
        <p className="text-xs text-red-400 mt-1.5">{error}</p>
      ) : (
        <p className="text-xs text-cream-300/60 mt-1.5">{hint}</p>
      )}
    </div>
  );
}
