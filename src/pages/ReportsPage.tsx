import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { reportAPI, payrollAPI, settingsAPI } from '../lib/api-client';
import { 
  BarChart3, TrendingUp, Users, FileText, 
  Download, Calendar, DollarSign, PieChart 
} from 'lucide-react';
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { PageSkeleton } from '../components/PageLoader';
import { formatCurrency } from '../utils/format';

// Initialize vfs for pdfmake
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
}

export function ReportsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'staff' | 'payroll' | 'variance' | 'remittance'>('staff');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [month1, setMonth1] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().substring(0, 7));
  const [month2, setMonth2] = useState(new Date().toISOString().substring(0, 7));
  const [remittanceType, setRemittanceType] = useState<'pension' | 'tax' | 'cooperative'>('pension');
  const [staffDepartment, setStaffDepartment] = useState('');
  const [staffStatus, setStaffStatus] = useState('');
  const [organizationName, setOrganizationName] = useState('Nigerian Judicial Service Committee');

  const isCashier = user?.role === 'cashier';

  useEffect(() => {
    if (isCashier && (activeTab === 'staff' || activeTab === 'payroll')) {
      setActiveTab('variance');
      return;
    }
    loadReport();
    fetchSettings();
  }, [activeTab, selectedMonth, month1, month2, remittanceType, staffDepartment, staffStatus, isCashier]);

  const fetchSettings = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      if (settings?.organization_name) {
        setOrganizationName(settings.organization_name);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'staff') {
        const data = await reportAPI.getStaffReport({
          department: staffDepartment || undefined,
          status: staffStatus || undefined,
        });

        // Map flat staff data to nested structure if needed
        if (data && Array.isArray(data.staff)) {
          data.staff = data.staff.map((item: any) => {
            if (item.bio_data) return item;
            return {
              id: item.id,
              staff_number: item.staff_number,
              bio_data: {
                first_name: item.first_name,
                last_name: item.surname || item.last_name,
                middle_name: item.other_names || item.middle_name,
                email: item.email,
                phone: item.phone,
              },
              appointment: {
                department: item.department_name || item.department,
                designation: item.designation,
              },
              salary_info: {
                grade_level: item.grade_level,
                step: item.step,
                basic_salary: item.basic_salary,
              },
              status: item.status,
            };
          });
        }
        setReportData(data);
      } else if (activeTab === 'payroll') {
        const data = await reportAPI.getPayrollReport(selectedMonth);
        setReportData(data);
      } else if (activeTab === 'variance') {
        const data = await reportAPI.getVarianceReport(month1, month2);
        setReportData(data);
      } else if (activeTab === 'remittance') {
        const data = await reportAPI.getRemittanceReport(selectedMonth, remittanceType);
        setReportData(data);
      }
    } catch (error: any) {
        if (error.message?.includes('403') || error.status === 403) {
            showToast('error', 'You do not have permission to view reports.');
         } else {
            showToast('error', 'Failed to load report');
         }
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData) {
      showToast('error', 'No data to export');
      return;
    }

    let csv = '';
    let filename = '';

    try {
      const currentDate = new Date().toLocaleDateString();
      const commonHeader = `${organizationName.toUpperCase()}\n`;
      
      const formatCurrency = (val: number | string | undefined | null) => {
        if (val === undefined || val === null) return '0.00';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      if (activeTab === 'staff') {
        // Staff Report CSV
        const reportTitle = `STAFF REPORT\nGENERATED: ${currentDate}\n\n`;
        const totalStaff = reportData.staff?.length || 0;
        const summary = `TOTAL STAFF: ${totalStaff}\n\n`;
        
        const headers = ['STAFF NUMBER', 'FIRST NAME', 'LAST NAME', 'DEPARTMENT', 'GRADE LEVEL', 'STEP', 'BASIC SALARY', 'STATUS'];
        csv = commonHeader + reportTitle + summary + headers.join(',') + '\n';
        
        (reportData.staff || []).forEach((staff: any) => {
          const row = [
            staff.staff_number,
            staff.bio_data.first_name,
            staff.bio_data.last_name,
            staff.appointment.department,
            staff.salary_info.grade_level,
            staff.salary_info.step,
            formatCurrency(staff.salary_info.basic_salary),
            staff.status
          ];
          csv += row.map(val => `"${val}"`).join(',') + '\n';
        });
        filename = `staff_report_${new Date().toISOString().split('T')[0]}.csv`;

      } else if (activeTab === 'payroll') {
        // Payroll Report CSV
        const reportTitle = `PAYROLL REPORT - ${selectedMonth}\nGENERATED: ${currentDate}\n\n`;
        
        // Calculate totals if not available in summary
        const summaryData = {
            ...reportData.summary,
            // Ensure total_deductions is present (fallback for older backend responses)
            total_deductions: reportData.summary?.total_deductions !== undefined 
                ? reportData.summary.total_deductions 
                : (reportData.lines?.reduce((sum: number, line: any) => sum + (line.total_deductions || 0), 0) || 0)
        };

        const summary = [
          `TOTAL STAFF,"${summaryData.total_staff || 0}"`,
          `TOTAL BASIC SALARY,"${formatCurrency(summaryData.total_basic)}"`,
          `TOTAL GROSS PAY,"${formatCurrency(summaryData.total_gross)}"`,
          `TOTAL DEDUCTIONS,"${formatCurrency(summaryData.total_deductions)}"`,
          `TOTAL NET PAY,"${formatCurrency(summaryData.total_net)}"\n\n`
        ].join('\n');

        const headers = ['STAFF NUMBER', 'STAFF NAME', 'BASIC SALARY', 'TOTAL ALLOWANCES', 'GROSS PAY', 'TOTAL DEDUCTIONS', 'NET PAY'];
        csv = commonHeader + reportTitle + summary + headers.join(',') + '\n';
        
        (reportData.lines || []).forEach((line: any) => {
          const row = [
            line.staff_number,
            line.staff_name,
            formatCurrency(line.basic_salary),
            formatCurrency(line.total_allowances),
            formatCurrency(line.gross_pay),
            formatCurrency(line.total_deductions),
            formatCurrency(line.net_pay)
          ];
          csv += row.map(val => `"${val}"`).join(',') + '\n';
        });
        filename = `payroll_report_${selectedMonth}.csv`;

      } else if (activeTab === 'variance') {
        // Variance Report CSV
        const reportTitle = `VARIANCE REPORT: ${month1} vs ${month2}\nGENERATED: ${currentDate}\n\n`;
        
        const summary = [
            `TOTAL STAFF CHANGE,"${reportData.variance?.staff_change || 0}"`,
            `TOTAL NET PAY CHANGE,"${formatCurrency(reportData.variance?.amount_change)}"`,
            `PERCENTAGE CHANGE,"${(reportData.variance?.percentage_change || 0).toFixed(2)}%"\n\n`
        ].join('\n');

        const headers = ['METRIC', 'MONTH 1', 'MONTH 2', 'CHANGE'];
        csv = commonHeader + reportTitle + summary + headers.join(',') + '\n';
        
        csv += `"TOTAL STAFF","${reportData.month1?.total_staff || 0}","${reportData.month2?.total_staff || 0}","${reportData.variance?.staff_change || 0}"\n`;
        csv += `"TOTAL NET PAY","${formatCurrency(reportData.month1?.total_net)}","${formatCurrency(reportData.month2?.total_net)}","${formatCurrency(reportData.variance?.amount_change)}"\n`;
        csv += `"PERCENTAGE CHANGE","","","${(reportData.variance?.percentage_change || 0).toFixed(2)}%"\n`;
        filename = `variance_report_${month1}_vs_${month2}.csv`;

      } else if (activeTab === 'remittance') {
        // Remittance Report CSV
        const reportTitle = `${remittanceType.toUpperCase()} REMITTANCE REPORT - ${selectedMonth}\nGENERATED: ${currentDate}\n\n`;
        
        const totalAmount = reportData.remittances?.reduce((sum: number, rem: any) => sum + (rem.amount || 0), 0) || 0;
        const totalStaff = reportData.remittances?.length || 0;
        
        const summary = [
            `TOTAL STAFF,"${totalStaff}"`,
            `TOTAL AMOUNT,"${formatCurrency(totalAmount)}"\n\n`
        ].join('\n');

        const headers = ['STAFF NUMBER', 'STAFF NAME', 'AMOUNT'];
        csv = commonHeader + reportTitle + summary + headers.join(',') + '\n';
        
        reportData.remittances.forEach((rem: any) => {
          const row = [
            rem.staff_number,
            rem.staff_name,
            formatCurrency(rem.amount)
          ];
          csv += row.map(val => `"${val}"`).join(',') + '\n';
        });
        filename = `${remittanceType}_remittance_${selectedMonth}.csv`;
      }

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('success', 'CSV exported successfully');
    } catch (error) {
      showToast('error', 'Failed to export CSV');
      console.error('CSV Export Error:', error);
    }
  };

  const handleExportPDF = () => {
    if (!reportData) {
      showToast('error', 'No data to export');
      return;
    }

    try {
      const formatPDFCurrency = (amount: any) => {
        const val = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (val === undefined || val === null || isNaN(val)) return '₦0.00';
        return '₦' + val.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const tableLayout = {
        hLineWidth: function (i: number, node: any) { return 0; },
        vLineWidth: function (i: number, node: any) { return 0; },
        paddingLeft: function (i: number, node: any) { return 10; },
        paddingRight: function (i: number, node: any) { return 10; },
        paddingTop: function (i: number, node: any) { return 8; },
        paddingBottom: function (i: number, node: any) { return 8; },
        fillColor: function (i: number, node: any) {
          if (i === 0) return '#008000'; // Green header
          return (i % 2 === 0) ? '#F9FAFB' : null; // Zebra striping
        }
      };

      const baseDocDefinition: any = {
        pageSize: 'A4',
        pageMargins: [20, 20, 20, 20],
        styles: {
          header: { fontSize: 16, bold: true, color: '#008000', alignment: 'center', margin: [0, 0, 0, 5] },
          subheader: { fontSize: 12, alignment: 'center', margin: [0, 0, 0, 2] },
          generated: { fontSize: 10, alignment: 'center', margin: [0, 0, 0, 10], color: '#666666' },
          tableHeader: { bold: true, color: 'white', fontSize: 10 },
          tableCell: { fontSize: 9 }
        },
        defaultStyle: { fontSize: 10, font: 'Roboto' }
      };

      let docDefinition = { ...baseDocDefinition, content: [] };
      let filename = '';

      // Common Header
      docDefinition.content.push(
        { text: organizationName, style: 'header' }
      );

      if (activeTab === 'staff') {
        // Staff Report PDF
        docDefinition.content.push(
          { text: 'Staff Report', style: 'subheader' },
          { text: `Generated: ${new Date().toLocaleDateString()}`, style: 'generated' }
        );

        const tableBody = [
          [
            { text: 'Staff #', style: 'tableHeader' },
            { text: 'Name', style: 'tableHeader' },
            { text: 'Department', style: 'tableHeader' },
            { text: 'Grade', style: 'tableHeader' },
            { text: 'Step', style: 'tableHeader' },
            { text: 'Basic Salary', style: 'tableHeader', alignment: 'right' },
            { text: 'Status', style: 'tableHeader' }
          ]
        ];

        (reportData.staff || []).forEach((staff: any) => {
          tableBody.push([
            { text: staff.staff_number || 'N/A', style: 'tableCell' },
            { text: `${staff.bio_data?.first_name || ''} ${staff.bio_data?.last_name || ''}`.trim() || 'N/A', style: 'tableCell' },
            { text: staff.appointment?.department || 'N/A', style: 'tableCell' },
            { text: `GL ${staff.salary_info?.grade_level || 'N/A'}`, style: 'tableCell' },
            { text: staff.salary_info?.step || 'N/A', style: 'tableCell' },
            { text: formatPDFCurrency(staff.salary_info?.basic_salary || 0), style: 'tableCell', alignment: 'right' },
            { text: staff.status || 'N/A', style: 'tableCell' }
          ]);
        });

        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: tableLayout
        });

        filename = `staff_report_${new Date().toISOString().split('T')[0]}.pdf`;

      } else if (activeTab === 'payroll') {
        // Payroll Report PDF
        docDefinition.content.push(
          { text: `Payroll Report - ${selectedMonth}`, style: 'subheader' },
          { text: `Generated: ${new Date().toLocaleDateString()}`, style: 'generated' }
        );

        // Summary section
        if (reportData.summary) {
          docDefinition.content.push(
            { text: 'Summary', style: 'subheader', alignment: 'left', margin: [0, 10, 0, 5] },
            {
              columns: [
                { text: `Total Staff: ${reportData.summary.total_staff || 0}`, width: '*' },
                { text: `Total Basic: ${formatPDFCurrency(reportData.summary.total_basic || 0)}`, width: '*' },
                { text: `Total Gross: ${formatPDFCurrency(reportData.summary.total_gross || 0)}`, width: '*' },
                { text: `Total Net: ${formatPDFCurrency(reportData.summary.total_net || 0)}`, width: '*' }
              ],
              margin: [0, 0, 0, 10]
            }
          );
        }

        const tableBody = [
          [
            { text: 'Staff #', style: 'tableHeader' },
            { text: 'Name', style: 'tableHeader' },
            { text: 'Basic Salary', style: 'tableHeader', alignment: 'right' },
            { text: 'Allowances', style: 'tableHeader', alignment: 'right' },
            { text: 'Gross Pay', style: 'tableHeader', alignment: 'right' },
            { text: 'Deductions', style: 'tableHeader', alignment: 'right' },
            { text: 'Net Pay', style: 'tableHeader', alignment: 'right' }
          ]
        ];

        (reportData.lines || []).forEach((line: any) => {
          tableBody.push([
            { text: line.staff_number || 'N/A', style: 'tableCell' },
            { text: line.staff_name || 'N/A', style: 'tableCell' },
            { text: formatPDFCurrency(line.basic_salary || 0), style: 'tableCell', alignment: 'right' },
            { text: formatPDFCurrency(line.total_allowances || 0), style: 'tableCell', alignment: 'right' },
            { text: formatPDFCurrency(line.gross_pay || 0), style: 'tableCell', alignment: 'right' },
            { text: formatPDFCurrency(line.total_deductions || 0), style: 'tableCell', alignment: 'right' },
            { text: formatPDFCurrency(line.net_pay || 0), style: 'tableCell', alignment: 'right' }
          ]);
        });

        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: tableLayout
        });

        filename = `payroll_report_${selectedMonth}.pdf`;

      } else if (activeTab === 'variance') {
        // Variance Report PDF
        docDefinition.content.push(
          { text: `Variance Report: ${month1} vs ${month2}`, style: 'subheader' },
          { text: `Generated: ${new Date().toLocaleDateString()}`, style: 'generated' }
        );

        const tableBody = [
          [
            { text: 'Metric', style: 'tableHeader' },
            { text: month1, style: 'tableHeader', alignment: 'right' },
            { text: month2, style: 'tableHeader', alignment: 'right' },
            { text: 'Variance', style: 'tableHeader', alignment: 'right' }
          ],
          [
            { text: 'Total Staff', style: 'tableCell' },
            { text: (reportData.month1?.total_staff || 0).toString(), style: 'tableCell', alignment: 'right' },
            { text: (reportData.month2?.total_staff || 0).toString(), style: 'tableCell', alignment: 'right' },
            { text: (reportData.variance?.staff_change || 0).toString(), style: 'tableCell', alignment: 'right' }
          ],
          [
            { text: 'Total Net Pay', style: 'tableCell' },
            { text: formatPDFCurrency(reportData.month1?.total_net || 0), style: 'tableCell', alignment: 'right' },
            { text: formatPDFCurrency(reportData.month2?.total_net || 0), style: 'tableCell', alignment: 'right' },
            { text: formatPDFCurrency(reportData.variance?.amount_change || 0), style: 'tableCell', alignment: 'right' }
          ],
          [
            { text: 'Percentage Change', style: 'tableCell' },
            { text: '', style: 'tableCell' },
            { text: '', style: 'tableCell' },
            { text: `${(reportData.variance?.percentage_change || 0).toFixed(2)}%`, style: 'tableCell', alignment: 'right' }
          ]
        ];

        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: tableLayout
        });

        filename = `variance_report_${month1}_vs_${month2}.pdf`;

      } else if (activeTab === 'remittance') {
        // Remittance Report PDF
        docDefinition.content.push(
          { text: `${remittanceType.toUpperCase()} Remittance Report - ${selectedMonth}`, style: 'subheader' },
          { text: `Generated: ${new Date().toLocaleDateString()}`, style: 'generated' }
        );

        // Summary
        docDefinition.content.push(
          { text: 'Summary', style: 'subheader', alignment: 'left', margin: [0, 10, 0, 5] },
          {
            columns: [
              { text: `Total Staff: ${reportData.total_staff || 0}`, width: '*' },
              { text: `Total Remittance: ${formatPDFCurrency(reportData.total_amount || 0)}`, width: '*' }
            ],
            margin: [0, 0, 0, 10]
          }
        );

        const tableBody = [
          [
            { text: 'Staff Number', style: 'tableHeader' },
            { text: 'Staff Name', style: 'tableHeader' },
            { text: 'Amount', style: 'tableHeader', alignment: 'right' }
          ]
        ];

        (reportData.remittances || []).forEach((rem: any) => {
          tableBody.push([
            { text: rem.staff_number || 'N/A', style: 'tableCell' },
            { text: rem.staff_name || 'N/A', style: 'tableCell' },
            { text: formatPDFCurrency(rem.amount || 0), style: 'tableCell', alignment: 'right' }
          ]);
        });

        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto'],
            body: tableBody
          },
          layout: tableLayout
        });

        filename = `${remittanceType}_remittance_${selectedMonth}.pdf`;
      }

      // Save PDF
      pdfMake.createPdf(docDefinition).download(filename);
      showToast('success', 'PDF exported successfully');
    } catch (error) {
      showToast('error', 'Failed to export PDF');
      console.error('PDF Export Error:', error);
    }
  };

  const tabs = isCashier
    ? [
        { id: 'variance', label: 'Variance Report', icon: TrendingUp },
        { id: 'remittance', label: 'Remittance Report', icon: FileText },
      ]
    : [
        { id: 'staff', label: 'Staff Report', icon: Users },
        { id: 'payroll', label: 'Payroll Report', icon: DollarSign },
        { id: 'variance', label: 'Variance Report', icon: TrendingUp },
        { id: 'remittance', label: 'Remittance Report', icon: FileText },
      ];

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Reports' }]} />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Generate and export payroll reports</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <div className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Report */}
      {activeTab === 'staff' && reportData && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1 text-card-foreground">
                  Department
                </label>
                <select
                  value={staffDepartment}
                  onChange={(e) => setStaffDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All Departments</option>
                  {Object.keys(reportData.by_department || {}).map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">
                  Status
                </label>
                <select
                  value={staffStatus}
                  onChange={(e) => setStaffStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setStaffDepartment('');
                    setStaffStatus('');
                  }}
                  className="px-4 py-2 text-card-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <div className="text-2xl font-semibold text-foreground">{reportData.total}</div>
              <div className="text-sm text-muted-foreground">Total Staff</div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <PieChart className="w-8 h-8 text-green-600 dark:text-green-500" />
              </div>
              <div className="text-2xl font-semibold text-foreground">{Object.keys(reportData.by_department || {}).length}</div>
              <div className="text-sm text-muted-foreground">Departments</div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
              <div className="text-2xl font-semibold text-foreground">{Object.keys(reportData.by_grade || {}).length}</div>
              <div className="text-sm text-muted-foreground">Grade Levels</div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-card-foreground mb-4">Staff by Department</h3>
              <div className="space-y-3">
                {Object.entries(reportData.by_department || {}).map(([dept, count]) => (
                  <div key={dept}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">{dept}</span>
                      <span className="text-sm font-medium text-foreground">{count as number}</span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${((count as number) / reportData.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-card-foreground mb-4">Staff by Grade Level</h3>
              <div className="space-y-3">
                {Object.entries(reportData.by_grade || {}).slice(0, 8).map(([grade, count]) => (
                  <div key={grade}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">{grade}</span>
                      <span className="text-sm font-medium text-foreground">{count as number}</span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-2">
                      <div
                        className="bg-green-600 dark:bg-green-500 h-2 rounded-full"
                        style={{ width: `${((count as number) / reportData.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Staff List */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-card-foreground mb-4">Staff Details</h3>
            {(() => {
              const sortedStaff = [...(reportData.staff || [])].sort((a: any, b: any) => {
                const glA = a?.salary_info?.grade_level ?? 0;
                const glB = b?.salary_info?.grade_level ?? 0;
                if (glA !== glB) return glB - glA;
                const stepA = a?.salary_info?.step ?? 0;
                const stepB = b?.salary_info?.step ?? 0;
                return stepB - stepA;
              });
              return (
            <DataTable
              data={sortedStaff}
              columns={[
                { header: 'Staff Number', accessor: 'staff_number' as keyof any, sortable: true },
                { header: 'Name', accessor: (row: any) => `${row.bio_data.first_name} ${row.bio_data.last_name}`, sortable: true },
                { header: 'Department', accessor: (row: any) => row.appointment.department },
                { header: 'Grade Level', accessor: (row: any) => `GL ${row.salary_info.grade_level}` },
                { header: 'Status', accessor: 'status' as keyof any },
              ]}
              searchable
              searchPlaceholder="Search staff..."
            />
              );
            })()}
          </div>
        </div>
      )}

      {/* Payroll Report */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Month Selector */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <label className="block text-sm mb-1 text-card-foreground">
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 border border-border rounded-lg bg-input-background dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {reportData && reportData.summary ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Staff</div>
                  <div className="text-2xl font-semibold text-foreground">{reportData.summary.total_staff || 0}</div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Basic Salary</div>
                  <div className="text-2xl font-semibold text-foreground">{formatCurrency(reportData.summary.total_basic)}</div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Gross Pay</div>
                  <div className="text-2xl font-semibold text-foreground">{formatCurrency(reportData.summary.total_gross)}</div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Net Pay</div>
                  <div className="text-2xl font-semibold text-green-700 dark:text-green-500">{formatCurrency(reportData.summary.total_net)}</div>
                </div>
              </div>

              {/* Payroll Lines */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-card-foreground mb-4">Payroll Lines - {selectedMonth}</h3>
                <DataTable
                  data={reportData.lines || []}
                  columns={[
                    { header: 'Staff Number', accessor: 'staff_number' as keyof any },
                    { header: 'Staff Name', accessor: 'staff_name' as keyof any },
                    { header: 'Basic Salary', accessor: (row: any) => formatCurrency(row.basic_salary) },
                    { header: 'Allowances', accessor: (row: any) => formatCurrency(row.total_allowances) },
                    { header: 'Gross Pay', accessor: (row: any) => formatCurrency(row.gross_pay) },
                    { header: 'Deductions', accessor: (row: any) => formatCurrency(row.total_deductions) },
                    { header: 'Net Pay', accessor: (row: any) => formatCurrency(row.net_pay) },
                  ]}
                  searchable
                  searchPlaceholder="Search payroll..."
                />
              </div>
            </>
          ) : (
            <div className="bg-card rounded-lg border border-border p-12 text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payroll data for selected month</p>
            </div>
          )}
        </div>
      )}

      {/* Variance Report */}
      {activeTab === 'variance' && (
        <div className="space-y-6">
          {/* Month Selectors */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-card-foreground">
                  Compare Month 1
                </label>
                <input
                  type="month"
                  value={month1}
                  onChange={(e) => setMonth1(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">
                  With Month 2
                </label>
                <input
                  type="month"
                  value={month2}
                  onChange={(e) => setMonth2(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {reportData && (
            <>
              {/* Comparison Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-2">{reportData.month1?.month || 'Month 1'}</div>
                  <div className="text-xl font-semibold text-foreground">{formatCurrency(reportData.month1?.total_net)}</div>
                  <div className="text-sm text-muted-foreground mt-1">{reportData.month1?.total_staff || 0} staff</div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-2">{reportData.month2?.month || 'Month 2'}</div>
                  <div className="text-xl font-semibold text-foreground">{formatCurrency(reportData.month2?.total_net)}</div>
                  <div className="text-sm text-muted-foreground mt-1">{reportData.month2?.total_staff || 0} staff</div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-2">Variance</div>
                  <div className={`text-xl font-semibold ${(reportData.variance?.amount_change || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                    {(reportData.variance?.amount_change || 0) >= 0 ? '+' : ''}{formatCurrency(reportData.variance?.amount_change)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {(reportData.variance?.percentage_change || 0) >= 0 ? '+' : ''}{(reportData.variance?.percentage_change || 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Detailed Variance */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-card-foreground mb-4">Variance Analysis</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <span className="text-foreground">Staff Count Change</span>
                    <span className={`font-medium ${(reportData.variance?.staff_change || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                      {(reportData.variance?.staff_change || 0) >= 0 ? '+' : ''}{reportData.variance?.staff_change || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <span className="text-foreground">Net Pay Change</span>
                    <span className={`font-medium ${(reportData.variance?.amount_change || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                      {(reportData.variance?.amount_change || 0) >= 0 ? '+' : ''}{formatCurrency(reportData.variance?.amount_change)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <span className="text-foreground">Percentage Change</span>
                    <span className={`font-medium ${(reportData.variance?.percentage_change || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                      {(reportData.variance?.percentage_change || 0) >= 0 ? '+' : ''}{(reportData.variance?.percentage_change || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Remittance Report */}
      {activeTab === 'remittance' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-card-foreground">
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">
                  Remittance Type
                </label>
                <select
                  value={remittanceType}
                  onChange={(e) => setRemittanceType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="pension">Pension</option>
                  <option value="tax">Tax (PAYE)</option>
                  <option value="cooperative">Cooperative</option>
                </select>
              </div>
            </div>
          </div>

          {reportData ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Staff</div>
                  <div className="text-2xl font-semibold text-foreground">{reportData.total_staff || 0}</div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Remittance</div>
                  <div className="text-2xl font-semibold text-blue-700">{formatCurrency(reportData.total_amount)}</div>
                </div>
              </div>

              {/* Remittance Details */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-card-foreground mb-4 capitalize">
                  {remittanceType} Remittance for {selectedMonth}
                </h3>
                <DataTable
                  data={reportData.remittances || []}
                  columns={[
                    { header: 'Staff Number', accessor: 'staff_number' as keyof any },
                    { header: 'Staff Name', accessor: 'staff_name' as keyof any },
                    { header: 'Amount', accessor: (row: any) => formatCurrency(row.amount) },
                  ]}
                  searchable
                  searchPlaceholder="Search remittances..."
                />
              </div>
            </>
          ) : (
            <div className="bg-card rounded-lg border border-border p-12 text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No remittance data for selected month</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
