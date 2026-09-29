import { X, Printer, Award } from 'lucide-react';
import type { TrainingApplication } from '../store';
import logoImg from '../imports/image-3.png';

interface CertificateModalProps {
  app: TrainingApplication;
  programName: string;
  programDuration?: string;
  onClose: () => void;
}

function certDetails(app: TrainingApplication) {
  return {
    completedDate: new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
    certId: `LC-CERT-${app.id.slice(-6).toUpperCase()}`,
  };
}

function buildCertificateHtml(app: TrainingApplication, programName: string, programDuration: string | undefined, logoUrl: string) {
  const { completedDate, certId } = certDetails(app);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Certificate — ${app.name}</title>
<style>
  @page { size: landscape; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 980px; max-width: 100%; background: #fff; border: 2px solid #c9a227; padding: 10px; }
  .frame { border: 1px solid #c9a227; padding: 6px; background: #fff; }
  .paper { position: relative; background-color: #ffffff; padding: 0 0 12px; text-align: center; color: #1c1a16; overflow: hidden; }
  .band { background: #ffffff; padding: 12px 40px 4px; }
  .band .logo-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .band .icon-crop { display: inline-block; width: 30px; height: 30px; overflow: hidden; flex-shrink: 0; }
  .band .icon-crop img { height: 30px; width: auto; max-width: none; }
  .band .brand { text-align: left; line-height: 1; }
  .band .brand .l1 { display: block; font-size: 19px; font-weight: bold; letter-spacing: 1.5px; color: #111; }
  .band .brand .l2 { display: block; font-size: 8px; letter-spacing: 3.5px; color: #111; margin-top: 2px; }
  .band .div { font-size: 10px; letter-spacing: 5px; color: #8a6d1b; text-transform: uppercase; margin-top: 6px; }
  .body { padding: 20px 70px 0; }
  h1 { font-size: 42px; font-weight: 400; letter-spacing: 6px; text-transform: uppercase; }
  .rule { display: flex; align-items: center; gap: 12px; margin: 12px auto 20px; max-width: 420px; }
  .rule::before, .rule::after { content: ''; flex: 1; height: 1px; background: #c9a227; }
  .rule span { color: #c9a227; font-size: 13px; }
  .eyebrow { font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #6b6257; }
  .name { font-size: 40px; font-style: italic; margin: 10px 0 4px; color: #131110; }
  .flourish { width: 300px; height: 2px; background: linear-gradient(90deg, transparent, #c9a227, transparent); margin: 0 auto 18px; }
  .program { font-size: 16px; color: #3d3831; }
  .program strong { color: #8a6d1b; }
  .details { display: flex; justify-content: center; gap: 0; margin: 22px auto 0; max-width: 640px; font-size: 12px; }
  .details div { flex: 1; padding: 0 16px; }
  .details div + div { border-left: 1px solid #d8c690; }
  .details .k { display: block; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #8a6d1b; margin-bottom: 4px; }
  .seal { position: absolute; left: 50%; margin-left: -59px; bottom: 108px; width: 118px; text-align: center; }
  .seal .medal { width: 104px; height: 104px; margin: 0 auto; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #e7c65a, #c9a227 60%, #9a7a1c); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #131110; box-shadow: 0 0 0 4px #ffffff, 0 0 0 5px #c9a227; }
  .seal .medal .lc { font-size: 30px; font-weight: bold; line-height: 1; }
  .seal .medal .tx { font-size: 8px; letter-spacing: 2px; margin-top: 3px; }
  .seal .tails { display: flex; justify-content: center; gap: 6px; margin-top: -2px; }
  .seal .tails i { display: block; width: 26px; height: 44px; background: linear-gradient(#b28f1f, #8a6d1b); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); }
  .sigs { display: flex; justify-content: space-between; margin: 32px 70px 0; font-size: 12px; color: #4a443c; }
  .sigs .sig { width: 250px; }
  .sigs .script { font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 26px; color: #131110; }
  .sigs .line { border-top: 1px solid #999; margin-top: 2px; padding-top: 5px; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #8a6d1b; }
  .foot { margin-top: 16px; font-size: 10px; letter-spacing: 1.5px; color: #8a7f6a; text-transform: uppercase; }
  @media print { body { min-height: auto; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="frame">
      <div class="paper">
        <div class="band">
          <div class="logo-row">
            <span class="icon-crop"><img src="${logoUrl}" alt="" /></span>
            <span class="brand"><span class="l1">LUXURIOUS</span><span class="l2">CLEANING CO.</span></span>
          </div>
          <div class="div">Professional Training Division</div>
        </div>
        <div class="body">
          <h1>Certificate</h1>
          <div class="rule"><span>◆</span></div>
          <div class="eyebrow">Of Completion — This Certificate Is Proudly Presented To</div>
          <div class="name">${app.name}</div>
          <div class="flourish"></div>
          <div class="program">for successfully completing the <strong>${programName}</strong>${programDuration ? ` &nbsp;·&nbsp; ${programDuration}` : ''}</div>
          <div class="details">
            <div><span class="k">Date Completed</span>${completedDate}</div>
            <div><span class="k">Certificate No.</span>${certId}</div>
            <div><span class="k">Issued In</span>San Juan City, Metro Manila</div>
          </div>
          <div class="seal">
            <div class="medal"><span class="lc">LC</span><span class="tx">CERTIFIED</span></div>
            <div class="tails"><i></i><i></i></div>
          </div>
          <div class="sigs">
            <div class="sig"><div class="script">Luxurious Cleaning Co.</div><div class="line">Training Director</div></div>
            <div class="sig"><div class="script">${completedDate}</div><div class="line">Date Issued</div></div>
          </div>
          <div class="foot">Atlanta Centre, 31 Annapolis Street, San Juan City, Metro Manila · 0919 002 4136</div>
        </div>
      </div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

export default function CertificateModal({ app, programName, programDuration, onClose }: CertificateModalProps) {
  const { completedDate, certId } = certDetails(app);

  function handlePrint() {
    const logoUrl = `${window.location.origin}${logoImg}`;
    const html = buildCertificateHtml(app, programName, programDuration, logoUrl);
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-navy-950/90 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Training certificate preview"
        className="relative bg-navy-800 border border-gold-400/20 rounded-2xl shadow-2xl max-w-4xl w-full m-auto animate-scale-in overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gold-400/10 shrink-0 bg-navy-800">
          <h3 className="font-serif text-2xl text-cream-100 flex items-center gap-2">
            <Award size={20} className="text-gold-400" /> Certificate Preview
          </h3>
          <button
            onClick={onClose}
            aria-label="Close certificate preview"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-navy-700 transition-colors"
          >
            <X size={18} className="text-cream-300" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto grow">
          {/* Formal white certificate — old layout, small black logo, landscape rectangle */}
          <div className="bg-white p-2 rounded-none">
            <div className="border border-[#C9A227] p-1.5 bg-white rounded-none">
              <div className="relative text-center text-[#1c1a16] overflow-hidden bg-white flex flex-col rounded-none">
                {/* Logo directly above CERTIFICATE — icon true colors, black text, no divider */}
                <div className="bg-white px-8 pt-3 pb-1 shrink-0">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-block overflow-hidden shrink-0" style={{ width: 30, height: 30 }}>
                      <img src={logoImg} alt="" aria-hidden className="object-contain" style={{ height: 30, width: 'auto', maxWidth: 'none' }} />
                    </span>
                    <span className="text-left leading-none">
                      <span className="block font-serif font-bold text-black text-lg tracking-[0.08em]">LUXURIOUS</span>
                      <span className="block text-black text-[8px] tracking-[0.35em] mt-0.5">CLEANING CO.</span>
                    </span>
                  </div>
                  <div className="text-[8px] tracking-[0.4em] uppercase text-[#8a6d1b] mt-1.5">
                    Professional Training Division
                  </div>
                </div>

                <div className="px-8 sm:px-14 pt-3 sm:pt-4 flex-1 flex flex-col justify-start min-h-0">
                  <div className="font-serif text-2xl sm:text-3xl tracking-[0.15em] uppercase">Certificate</div>
                  <div className="flex items-center gap-3 max-w-[280px] mx-auto my-2">
                    <span className="flex-1 h-px bg-gold-400" />
                    <span className="text-gold-400 text-xs">◆</span>
                    <span className="flex-1 h-px bg-gold-400" />
                  </div>
                  <div className="text-[9px] tracking-[0.3em] uppercase text-[#6b6257] mb-2">
                    Of Completion — Proudly Presented To
                  </div>
                  <div className="font-serif text-2xl sm:text-3xl italic text-[#131110]">{app.name}</div>
                  <div
                    className="w-56 h-0.5 mx-auto my-2.5"
                    style={{ background: 'linear-gradient(90deg, transparent, #c9a227, transparent)' }}
                  />
                  <div className="text-xs sm:text-sm text-[#3d3831] mt-1">
                    for successfully completing the <strong className="text-[#8a6d1b]">{programName}</strong>
                    {programDuration ? <span> · {programDuration}</span> : null}
                  </div>

                  <div className="grid grid-cols-3 max-w-lg mx-auto mt-4 text-xs w-full">
                    {[
                      { k: 'Date Completed', v: completedDate },
                      { k: 'Certificate No.', v: certId },
                      { k: 'Issued In', v: 'San Juan City' },
                    ].map((d, i) => (
                      <div key={d.k} className={`px-2 ${i > 0 ? 'border-l border-[#d8c690]' : ''}`}>
                        <span className="block text-[8px] tracking-[0.2em] uppercase text-[#8a6d1b] mb-1 whitespace-nowrap">{d.k}</span>
                        <span className="block text-[11px] leading-snug break-words">{d.v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Bottom row: signature | seal | date — no overlap */}
                  <div className="flex items-end justify-between mt-5 text-xs text-[#4a443c] w-full max-w-xl mx-auto gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-serif italic text-base sm:text-lg text-[#131110] truncate">Luxurious Cleaning Co.</div>
                      <div className="border-t border-[#999] mt-1 pt-1 text-[9px] tracking-[0.2em] uppercase text-[#8a6d1b]">
                        Training Director
                      </div>
                    </div>
                    <div className="text-center shrink-0">
                      <div
                        className="w-[64px] h-[64px] mx-auto rounded-full flex flex-col items-center justify-center text-[#131110]"
                        style={{
                          background: 'radial-gradient(circle at 35% 30%, #e7c65a, #c9a227 60%, #9a7a1c)',
                          boxShadow: '0 0 0 4px #ffffff, 0 0 0 5px #c9a227',
                        }}
                      >
                        <span className="text-lg font-bold leading-none font-serif">LC</span>
                        <span className="text-[6px] tracking-[0.2em] mt-0.5">CERTIFIED</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif italic text-base sm:text-lg text-[#131110] truncate">{completedDate}</div>
                      <div className="border-t border-[#999] mt-1 pt-1 text-[9px] tracking-[0.2em] uppercase text-[#8a6d1b]">
                        Date Issued
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pb-4 text-[8px] tracking-[0.15em] uppercase text-[#8a7f6a]">
                    Atlanta Centre, 31 Annapolis Street, San Juan City, Metro Manila · 0919 002 4136
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 border-t border-gold-400/10 shrink-0 bg-navy-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gold-400/20 text-cream-200 hover:bg-navy-700 transition-colors text-sm font-medium"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gold-400 hover:bg-gold-300 text-navy-950 transition-colors text-sm font-semibold"
          >
            <Printer size={15} /> Print Certificate
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
