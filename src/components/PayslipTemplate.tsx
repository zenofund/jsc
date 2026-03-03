import React from 'react';
import { formatCurrency } from '../utils/format';
import { Shield, Printer } from 'lucide-react';

interface PayslipTemplateProps {
  payslip: any;
  user?: any;
}

export const PayslipTemplate: React.FC<PayslipTemplateProps> = ({ payslip, user }) => {
  if (!payslip) return null;

  const line = payslip.line || {};
  const batch = payslip.batch || {};

  const getArray = (data: any) => {
    if (!data) return [];
    
    // If it's already an array, return it
    if (Array.isArray(data)) {
      // Check if elements are strings that need parsing (edge case)
      if (data.length > 0 && typeof data[0] === 'string') {
        try {
          return data.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        } catch (e) {
          console.error('Error parsing array items:', e);
          return data;
        }
      }
      return data;
    }

    // If it's a string, try to parse it
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error parsing JSON string:', e);
        return [];
      }
    }
    
    return [];
  };

  const allowances = getArray(line.allowances);
  const deductions = getArray(line.deductions);

  return (
    <div className="w-full max-w-[1040px] mx-auto p-4 md:p-7 font-sans text-foreground bg-background min-h-screen md:min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-purple-600 to-green-500 shadow-lg border border-white/20 flex items-center justify-center text-white">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide leading-tight">Judicial Service Committee</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Payroll Payslip</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="relative bg-card border border-border rounded-[18px] shadow-2xl overflow-hidden">
        {/* Background Effects (CSS equivalent of the radial gradients in HTML) */}
        <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-40 opacity-10 bg-[radial-gradient(at_10%_0%,rgba(124,58,237,0.3)_0px,transparent_50%),radial-gradient(at_95%_0%,rgba(34,197,94,0.18)_0px,transparent_50%)]"></div>

        <div className="relative p-5 md:p-7">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-4 mb-4">
            <div className="flex flex-col gap-1.5 min-w-[260px]">
              <div className="inline-flex items-center gap-2 w-fit px-2.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-bold tracking-wide text-foreground">
                <span className="w-2 h-2 rounded-full bg-purple-600 shadow-[0_0_0_4px_rgba(124,58,237,0.15)]"></span>
                PAYSLIP
              </div>
              <h2 className="text-2xl font-black tracking-tight m-0">Salary Statement</h2>
              <small className="text-xs text-muted-foreground">Confidential • For intended recipient only</small>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto md:min-w-[520px]">
              <MetaPill label="Period" value={batch.month || batch.payroll_month || 'N/A'} />
              <MetaPill label="Batch / Ref" value={batch.batch_number || 'N/A'} />
              <MetaPill label="Employee" value={line.staff_name || user?.email || 'N/A'} />
              <MetaPill label="Staff ID" value={line.staff_number || user?.staff_id || 'N/A'} />
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 items-start">
            
            {/* Earnings Panel */}
            <div className="bg-muted/30 border border-border rounded-[16px] overflow-hidden flex flex-col h-full">
              <div className="px-3.5 py-3 border-b border-border flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-black tracking-wide m-0">Earnings</h3>
                <div className="text-[11px] text-muted-foreground truncate max-w-[250px]">Salary components</div>
              </div>
              <div className="overflow-auto max-h-[340px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <table className="w-full text-[13px] border-collapse">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 shadow-sm">
                    <tr>
                      <th className="text-left px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground border-b border-border">Description</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground border-b border-border">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SectionRow title="Core" />
                    <TableRow label="Basic Salary" value={line.basic_salary} />
                    {allowances.map((allowance: any, index: number) => (
                      <TableRow key={index} label={allowance.name} value={allowance.amount} />
                    ))}
                    <TotalRow label="Gross Pay" value={line.gross_pay} />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Deductions + Summary */}
            <div className="flex flex-col gap-4">
              
              {/* Deductions Panel */}
              <div className="bg-muted/30 border border-border rounded-[16px] overflow-hidden">
                <div className="px-3.5 py-3 border-b border-border flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-black tracking-wide m-0">Deductions</h3>
                  <div className="text-[11px] text-muted-foreground truncate max-w-[250px]">Statutory, loans & others</div>
                </div>
                <div className="overflow-auto max-h-[340px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  <table className="w-full text-[13px] border-collapse">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 shadow-sm">
                      <tr>
                        <th className="text-left px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground border-b border-border">Description</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground border-b border-border">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                    <SectionRow title="All Deductions" />
                    {deductions.map((deduction: any, index: number) => (
                      <TableRow key={index} label={deduction.name || deduction.deduction_name || deduction.code || 'Unknown'} value={deduction.amount} />
                    ))}
                    {deductions.length === 0 && (
                      <tr key="no-deductions"><td colSpan={2} className="px-3.5 py-2.5 text-center text-muted-foreground italic">No deductions</td></tr>
                    )}
                    <TotalRow label="Total Deductions" value={line.total_deductions} />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Pay Box */}
              <div className="p-3.5 rounded-[16px] bg-gradient-to-b from-green-500/10 to-background border border-green-500/20 shadow-inner">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Net Pay</div>
                <div className="text-2xl font-black tracking-tight font-mono text-foreground mb-2.5">
                  {formatCurrency(line.net_pay || 0)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip label="Gross" value={formatCurrency(line.gross_pay || 0)} />
                  <Chip label="Deductions" value={formatCurrency(line.total_deductions || 0)} />
                  <Chip label="Period" value={batch.month || batch.payroll_month || 'N/A'} />
                </div>
              </div>

              {/* Bank Details Box */}
              <div className="p-3.5 rounded-[16px] bg-muted/30 border border-border">
                <BankRow label="Bank" value={line.bank_name || 'N/A'} />
                <BankRow label="Account" value={line.account_number ? `**** ${line.account_number.slice(-4)}` : 'N/A'} />
                <BankRow label="Grade / Step" value={`GL ${line.grade_level || '?'} / ${line.step || '?'}`} />
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex flex-wrap justify-between gap-2.5 text-[11px] text-muted-foreground border-t border-border pt-3">
            <div>Generated by JSC Payroll System. Do not share publicly</div>
            <div className="font-mono">Ref: {batch.batch_number || 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-components for cleaner code
const MetaPill = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-muted/30 border border-border rounded-[14px] px-3 py-2.5 flex items-baseline justify-between gap-3">
    <div className="text-[11px] text-muted-foreground uppercase tracking-wide whitespace-nowrap">{label}</div>
    <div className="text-xs font-mono text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px] text-right">{value}</div>
  </div>
);

const SectionRow = ({ title }: { title: string }) => (
  <tr className="bg-muted/20 border-b border-border">
    <td colSpan={2} className="px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground/80">{title}</td>
  </tr>
);

const TableRow = ({ label, value }: { label: string; value: number }) => (
  <tr className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
    <td className="px-3.5 py-2.5 truncate max-w-[300px] text-foreground">{label}</td>
    <td className="px-3.5 py-2.5 text-right font-mono text-foreground whitespace-nowrap">{formatCurrency(value)}</td>
  </tr>
);

const TotalRow = ({ label, value }: { label: string; value: number }) => (
  <tr className="bg-muted/20 font-black text-foreground">
    <td className="px-3.5 py-2.5">{label}</td>
    <td className="px-3.5 py-2.5 text-right font-mono">{formatCurrency(value)}</td>
  </tr>
);

const Chip = ({ label, value }: { label: string; value: string }) => (
  <div className="px-2.5 py-2 rounded-full border border-border bg-muted/30 text-xs text-muted-foreground">
    {label}: <strong className="text-foreground font-mono">{value}</strong>
  </div>
);

const BankRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 py-2 border-b border-border last:border-0">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">{label}</div>
    <div className="text-xs font-mono text-foreground text-right whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{value}</div>
  </div>
);
