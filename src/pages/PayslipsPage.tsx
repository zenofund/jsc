import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { payslipAPI, payrollAPI, settingsAPI } from '../lib/api-client';
import { PageSkeleton } from '../components/PageLoader';
import { FileText, Download, Eye } from 'lucide-react';
import { PayslipTemplate } from '../components/PayslipTemplate';
import { formatCurrency } from '../utils/format';
import { generatePayslipPDF } from '../utils/payslipGenerator';
import { loadPdfMake } from '../utils/loadPdfMake';

export function PayslipsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isStaffView, setIsStaffView] = useState(false);
  const [organizationName, setOrganizationName] = useState('Judicial Service Committee');
  const [organizationLogo, setOrganizationLogo] = useState('');

  useEffect(() => {
    loadPayslips();
  }, [user, selectedMonth]);

  useEffect(() => {
    loadBranding();
  }, [user]);

  const loadBranding = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      if (settings?.organization_name) {
        setOrganizationName(settings.organization_name);
      }
      if (settings?.organization_logo) {
        setOrganizationLogo(settings.organization_logo);
      } else {
        setOrganizationLogo('');
      }
    } catch {
      setOrganizationLogo('');
    }
  };

  const loadPayslips = async () => {
    try {
      setLoading(true);
      // If user has staff_id or role is staff, show only their payslips
      if (user?.staff_id || user?.role === 'staff') {
        setIsStaffView(true);
        if (user?.staff_id) {
          const staffPayslips = await payslipAPI.getStaffPayslips(user.staff_id, selectedMonth || undefined);
          const mappedPayslips = (Array.isArray(staffPayslips) ? staffPayslips : []).map(item => ({
            line: item,
            batch: {
              month: item.payroll_month,
              batch_number: item.batch_number,
              status: item.batch_status
            }
          }));
          setPayslips(mappedPayslips);
        } else {
          setPayslips([]);
        }
      } else {
        // Admins/Payroll officers can see all
        const batches = await payrollAPI.getAllPayrollBatches(selectedMonth ? { payrollMonth: selectedMonth } : undefined);
        const allPayslips = [];
        
        for (const batch of batches.filter((b: any) => ['locked', 'approved', 'ready_for_payment', 'paid'].includes(b.status))) {
          const batchPayslips = await payslipAPI.getBatchPayslips(batch.id, selectedMonth || undefined);
          if (Array.isArray(batchPayslips)) {
            const mappedBatchPayslips = batchPayslips.map(line => ({
              line: line,
              batch: batch
            }));
            allPayslips.push(...mappedBatchPayslips);
          }
        }
        
        setPayslips(allPayslips);
      }
    } catch (error) {
      showToast('error', 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayslip = (payslip: any) => {
    setSelectedPayslip(payslip);
    setShowDetailModal(true);
  };

  const handlePrintPayslip = () => {
    window.print();
  };

  const handleDownloadPayslip = async (payslip: any) => {
    try {
      const docDefinition = generatePayslipPDF(payslip, user, {
        organizationName,
        organizationLogo,
      });
      
      // Construct personalized filename
      const month = payslip.batch?.month || payslip.line?.payroll_month || 'Unknown';
      const staffName = (payslip.line?.staff_name || user?.email || 'Staff').replace(/\s+/g, '_');
      const staffNumber = payslip.line?.staff_number || 'NoID';
      const filename = `Payslip_${month}_${staffName}_${staffNumber}.pdf`;

      // Save PDF
      const pdfMake = await loadPdfMake();
      pdfMake.createPdf(docDefinition).download(filename);
      showToast('success', 'Payslip downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      showToast('error', 'Failed to generate PDF');
    }
  };

  const columns = [
    {
      header: 'Month',
      accessor: (row: any) => row.batch?.month || row.batch?.payroll_month || 'N/A',
      sortable: true,
    },
    {
      header: 'Batch Number',
      accessor: (row: any) => row.batch?.batch_number || 'N/A',
      sortable: true,
    },
    ...(!isStaffView ? [{
      header: 'Staff Number',
      accessor: (row: any) => row?.line?.staff_number || 'N/A',
    }, {
      header: 'Staff Name',
      accessor: (row: any) => row?.line?.staff_name || 'N/A',
      sortable: true,
    }] : []),
    {
      header: 'Basic Salary',
      accessor: (row: any) => formatCurrency(row?.line?.basic_salary || 0),
    },
    {
      header: 'Gross Pay',
      accessor: (row: any) => formatCurrency(row?.line?.gross_pay || 0),
    },
    {
      header: 'Net Pay',
      accessor: (row: any) => formatCurrency(row?.line?.net_pay || 0),
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewPayslip(row);
            }}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadPayslip(row);
            }}
            className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
          >
            <Download className="w-4 h-4" />
            Download Payslip
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Payslips' }]} />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Payslips</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isStaffView ? 'View your payslips' : 'View and manage staff payslips'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-md bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter payslips by month"
          />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">{payslips.length} payslip{payslips.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {payslips.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="font-medium text-card-foreground mb-2">No Payslips Available</h3>
          <p className="text-muted-foreground">
            {isStaffView 
              ? 'You have no payslips yet. They will appear here after payroll is processed.'
              : 'No payslips have been generated yet.'}
          </p>
        </div>
      ) : (
        <DataTable
          data={payslips}
          columns={columns}
          searchable
          searchPlaceholder="Search payslips..."
        />
      )}

      {/* Payslip Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPayslip(null);
        }}
        title="Payslip Details"
        size="xl"
      >
        <div className="p-0">
          <div className="flex justify-end p-4 border-b border-border bg-muted/20">
             <button
                onClick={() => handleDownloadPayslip(selectedPayslip)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Payslip
              </button>
          </div>
          <PayslipTemplate
            payslip={selectedPayslip}
            user={user}
            organizationName={organizationName}
            organizationLogo={organizationLogo}
          />
        </div>
      </Modal>
    </div>
  );
}
