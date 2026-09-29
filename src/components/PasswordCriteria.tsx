import { CheckCircle2, XCircle } from 'lucide-react';

interface PasswordCriteriaProps {
  password: string;
}

export default function PasswordCriteria({ password }: PasswordCriteriaProps) {
  const criteria = [
    {
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      label: 'Contains uppercase letter (A-Z)',
      met: /[A-Z]/.test(password),
    },
    {
      label: 'Contains lowercase letter (a-z)',
      met: /[a-z]/.test(password),
    },
    {
      label: 'Contains number (0-9)',
      met: /[0-9]/.test(password),
    },
    {
      label: 'Contains special character (!@#$%^&*_-+=)',
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password),
    },
  ];

  const allMet = criteria.every(c => c.met);

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-cream-300 mb-2">Password Requirements:</div>
      {criteria.map((criterion, index) => (
        <div key={index} className="flex items-center gap-2">
          {criterion.met ? (
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          ) : (
            <XCircle size={14} className="text-red-400 shrink-0" />
          )}
          <span
            className={`text-xs transition-colors ${
              criterion.met ? 'text-emerald-400' : 'text-cream-300/60'
            }`}
          >
            {criterion.label}
          </span>
        </div>
      ))}
      {password.length > 0 && (
        <div className="pt-2 mt-2 border-t border-gold-400/10">
          <div className="text-xs font-medium">
            {allMet ? (
              <span className="text-emerald-400">✓ Password meets all requirements</span>
            ) : (
              <span className="text-cream-300/60">
                {criteria.filter(c => c.met).length} of {criteria.length} requirements met
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
