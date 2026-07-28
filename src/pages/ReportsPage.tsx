import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { reportAPI, payrollAPI } from '../lib/api-client';
import { 
  BarChart3, TrendingUp, Users, FileText, 
  Download, Calendar, DollarSign, PieChart, Building2
} from 'lucide-react';
import { PageSkeleton } from '../components/PageLoader';
import { formatCurrency, formatCompactCurrency } from '../utils/format';
import { loadPdfMake } from '../utils/loadPdfMake';
import { exportSpreadsheet } from '../utils/exportSpreadsheet';

export function ReportsPage() {
  const { user } = useAuth();
  const { settings, cooperativeManagementEnabled } = useSystemSettings();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'staff' | 'payroll' | 'bank-schedule' | 'variance' | 'remittance'>('staff');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [showBankModal, setShowBankModal] = useState(false);

  // Filter states
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [month1, setMonth1] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().substring(0, 7));
  const [month2, setMonth2] = useState(new Date().toISOString().substring(0, 7));
  const [remittanceType, setRemittanceType] = useState<'pension' | 'tax' | 'cooperative'>('pension');
  const [payeScheduleState, setPayeScheduleState] = useState('FCT');
  const [staffDepartment, setStaffDepartment] = useState('');
  const [organizationName, setOrganizationName] = useState('Nigerian Judicial Service Committee');
  const [organizationLogo, setOrganizationLogo] = useState('');

  const isCashier = user?.role === 'cashier';

  const toNumber = (value: any) => {
    const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    return Number.isFinite(num) ? num : 0;
  };

  const sortStaffByGradeDesc = (staffRows: any[]) => {
    return [...(staffRows || [])].sort((a: any, b: any) => {
      const glA = toNumber(a?.salary_info?.grade_level);
      const glB = toNumber(b?.salary_info?.grade_level);
      if (glA !== glB) return glB - glA;
      const stepA = toNumber(a?.salary_info?.step);
      const stepB = toNumber(b?.salary_info?.step);
      if (stepA !== stepB) return stepB - stepA;
      const staffA = String(a?.staff_number || '');
      const staffB = String(b?.staff_number || '');
      return staffA.localeCompare(staffB);
    });
  };

  const sortGradeEntriesDesc = (gradeMap: Record<string, number>) => {
    return Object.entries(gradeMap || {}).sort(([gradeA], [gradeB]) => {
      const valA = toNumber(String(gradeA).replace(/[^\d]/g, ''));
      const valB = toNumber(String(gradeB).replace(/[^\d]/g, ''));
      return valB - valA;
    });
  };

  useEffect(() => {
    if (isCashier && (activeTab === 'staff' || activeTab === 'payroll' || activeTab === 'bank-schedule')) {
      setActiveTab('variance');
      return;
    }
    if (!cooperativeManagementEnabled && remittanceType === 'cooperative') {
      setRemittanceType('pension');
      return;
    }
    loadReport();
  }, [activeTab, selectedMonth, month1, month2, remittanceType, staffDepartment, isCashier, cooperativeManagementEnabled]);

  useEffect(() => {
    if (settings?.organization_name) {
      setOrganizationName(settings.organization_name);
    }
    setOrganizationLogo(settings?.organization_logo || '');
  }, [settings?.organization_logo, settings?.organization_name]);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'staff') {
        const data = await reportAPI.getStaffReport({
          department: staffDepartment || undefined,
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
      } else if (activeTab === 'bank-schedule') {
        const data = await reportAPI.getPayrollBankSchedule(selectedMonth);
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

  const getPayeStates = () => {
    const groups = reportData?.grouped_by_state;
    if (remittanceType === 'tax' && Array.isArray(groups) && groups.length > 0) {
      const values = groups
        .map((g: any) => String(g?.state || 'FCT').trim() || 'FCT')
        .filter(Boolean);
      return Array.from(new Set(values));
    }
    return ['FCT', 'Nasarawa', 'Niger'];
  };

  const handleDownloadPayeScheduleExcel = async () => {
    try {
      const state = String(payeScheduleState || 'FCT').trim() || 'FCT';
      const schedule = await reportAPI.getPayeSchedule(selectedMonth, state, 'json');
      const rows = Array.isArray(schedule?.rows)
        ? schedule.rows.map((row: any, index: number) => ({
            sn: index + 1,
            staff_number: row.staff_number,
            staff_name: row.staff_name,
            tax_id: row.tax_id,
            pit_remittance_state: row.pit_remittance_state,
            payroll_month: row.payroll_month,
            paye_amount: row.amount,
          }))
        : [];

      exportSpreadsheet({
        title: `PAYE Schedule - ${String(schedule?.state || state)} (${String(schedule?.month || selectedMonth)})`,
        fileName: `paye_schedule_${state}_${selectedMonth}.xls`,
        meta: [
          { label: 'Organization', value: String(schedule?.organization_name || organizationName) },
          { label: 'Total Staff', value: String(schedule?.total_staff ?? rows.length ?? 0) },
          { label: 'Total Amount', value: String(schedule?.total_amount ?? '') },
          { label: 'Missing Tax ID Count', value: String(schedule?.missing_tax_id_count ?? 0) },
          { label: 'Generated At', value: new Date().toLocaleString() },
        ],
        columns: [
          { key: 'sn', label: 'S/N' },
          { key: 'staff_number', label: 'Staff Number' },
          { key: 'staff_name', label: 'Staff Name' },
          { key: 'tax_id', label: 'Tax ID' },
          { key: 'pit_remittance_state', label: 'PIT State' },
          { key: 'payroll_month', label: 'Payroll Month' },
          { key: 'paye_amount', label: 'PAYE Amount' },
        ],
        rows,
      });
    } catch (error: any) {
      console.error('PAYE Schedule Export Error:', error);
      showToast('error', error?.message || 'Failed to download PAYE schedule');
    }
  };

  const handleExportExcel = () => {
    if (!reportData) {
      showToast('error', 'No data to export');
      return;
    }

    try {
      const formatAmount = (val: number | string | undefined | null) => {
        if (val === undefined || val === null) return '0.00';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      if (activeTab === 'staff') {
        const totalStaff = reportData.staff?.length || 0;
        const sortedStaff = sortStaffByGradeDesc(reportData.staff || []);
        const rows = sortedStaff.map((staff: any) => ({
          staff_number: staff.staff_number,
          first_name: staff.bio_data.first_name,
          last_name: staff.bio_data.last_name,
          department: staff.appointment.department,
          grade_level: staff.salary_info.grade_level,
          step: staff.salary_info.step,
          basic_salary: formatAmount(staff.salary_info.basic_salary),
          status: staff.status,
        }));

        exportSpreadsheet({
          title: 'Staff Report',
          fileName: `staff_report_${new Date().toISOString().split('T')[0]}.xls`,
          meta: [
            { label: 'Organization', value: organizationName },
            { label: 'Total Staff', value: String(totalStaff) },
            ...(staffDepartment ? [{ label: 'Department', value: staffDepartment }] : []),
            { label: 'Generated At', value: new Date().toLocaleString() },
          ],
          columns: [
            { key: 'staff_number', label: 'Staff Number' },
            { key: 'first_name', label: 'First Name' },
            { key: 'last_name', label: 'Last Name' },
            { key: 'department', label: 'Department' },
            { key: 'grade_level', label: 'Grade Level' },
            { key: 'step', label: 'Step' },
            { key: 'basic_salary', label: 'Basic Salary' },
            { key: 'status', label: 'Status' },
          ],
          rows,
        });

      } else if (activeTab === 'payroll') {
        const summaryData = {
            ...reportData.summary,
            total_deductions: reportData.summary?.total_deductions !== undefined 
                ? reportData.summary.total_deductions 
                : (reportData.lines?.reduce((sum: number, line: any) => sum + (line.total_deductions || 0), 0) || 0)
        };
        const rows = (reportData.lines || []).map((line: any) => ({
          staff_number: line.staff_number,
          staff_name: line.staff_name,
          basic_salary: formatAmount(line.basic_salary),
          total_allowances: formatAmount(line.total_allowances),
          gross_pay: formatAmount(line.gross_pay),
          total_deductions: formatAmount(line.total_deductions),
          net_pay: formatAmount(line.net_pay),
        }));

        exportSpreadsheet({
          title: `Payroll Report - ${selectedMonth}`,
          fileName: `payroll_report_${selectedMonth}.xls`,
          meta: [
            { label: 'Organization', value: organizationName },
            { label: 'Total Staff', value: String(summaryData.total_staff || 0) },
            { label: 'Total Basic Salary', value: formatAmount(summaryData.total_basic) },
            { label: 'Total Gross Pay', value: formatAmount(summaryData.total_gross) },
            { label: 'Total Deductions', value: formatAmount(summaryData.total_deductions) },
            { label: 'Total Net Pay', value: formatAmount(summaryData.total_net) },
            { label: 'Generated At', value: new Date().toLocaleString() },
          ],
          columns: [
            { key: 'staff_number', label: 'Staff Number' },
            { key: 'staff_name', label: 'Staff Name' },
            { key: 'basic_salary', label: 'Basic Salary' },
            { key: 'total_allowances', label: 'Total Allowances' },
            { key: 'gross_pay', label: 'Gross Pay' },
            { key: 'total_deductions', label: 'Total Deductions' },
            { key: 'net_pay', label: 'Net Pay' },
          ],
          rows,
        });

      } else if (activeTab === 'bank-schedule') {
        const totals = reportData?.totals || {};
        const rows = (reportData?.banks || []).flatMap((bank: any) =>
          (bank.lines || []).map((line: any) => ({
            bank_name: bank.bank_name,
            staff_number: line.staff_number,
            staff_name: line.staff_name,
            account_number: String(line.account_number ?? '').trim(),
            net_pay: formatAmount(line.net_pay || 0),
          })),
        );

        exportSpreadsheet({
          title: `Payroll Bank Schedule - ${selectedMonth}`,
          fileName: `payroll_bank_schedule_${selectedMonth}_${new Date().toISOString().split('T')[0]}.xls`,
          meta: [
            { label: 'Organization', value: organizationName },
            { label: 'Total Banks', value: String(totals.total_banks || 0) },
            { label: 'Total Staff', value: String(totals.total_staff || 0) },
            { label: 'Total Amount', value: formatAmount(totals.total_amount || 0) },
            { label: 'Missing Bank Details', value: String(totals.missing_bank_details || 0) },
            { label: 'Generated At', value: new Date().toLocaleString() },
          ],
          columns: [
            { key: 'bank_name', label: 'Bank' },
            { key: 'staff_number', label: 'Staff Number' },
            { key: 'staff_name', label: 'Staff Name' },
            { key: 'account_number', label: 'Account Number' },
            { key: 'net_pay', label: 'Net Pay' },
          ],
          rows,
        });
      } else if (activeTab === 'variance') {
        const rows = [
          {
            metric: 'Total Staff',
            month_1: reportData.month1?.total_staff || 0,
            month_2: reportData.month2?.total_staff || 0,
            change: reportData.variance?.staff_change || 0,
          },
          {
            metric: 'Total Net Pay',
            month_1: formatAmount(reportData.month1?.total_net),
            month_2: formatAmount(reportData.month2?.total_net),
            change: formatAmount(reportData.variance?.amount_change),
          },
          {
            metric: 'Percentage Change',
            month_1: '',
            month_2: '',
            change: `${(reportData.variance?.percentage_change || 0).toFixed(2)}%`,
          },
        ];

        exportSpreadsheet({
          title: `Variance Report: ${month1} vs ${month2}`,
          fileName: `variance_report_${month1}_vs_${month2}.xls`,
          meta: [
            { label: 'Organization', value: organizationName },
            { label: 'Total Staff Change', value: String(reportData.variance?.staff_change || 0) },
            { label: 'Total Net Pay Change', value: formatAmount(reportData.variance?.amount_change) },
            { label: 'Percentage Change', value: `${(reportData.variance?.percentage_change || 0).toFixed(2)}%` },
            { label: 'Generated At', value: new Date().toLocaleString() },
          ],
          columns: [
            { key: 'metric', label: 'Metric' },
            { key: 'month_1', label: month1 },
            { key: 'month_2', label: month2 },
            { key: 'change', label: 'Change' },
          ],
          rows,
        });

      } else if (activeTab === 'remittance') {
        const groups = Array.isArray(reportData.grouped_by_state) ? reportData.grouped_by_state : null;
        const rows = Array.isArray(reportData.remittances) ? reportData.remittances : [];
        const totalAmount = rows.reduce((sum: number, rem: any) => sum + (rem.amount || 0), 0) || 0;
        const totalStaff = rows.length || 0;

        const exportRows = rows.map((rem: any) => ({
          pit_remittance_state: remittanceType === 'tax' ? rem.pit_remittance_state || 'FCT' : '',
          staff_number: rem.staff_number,
          staff_name: rem.staff_name,
          amount: formatAmount(rem.amount),
        }));

        exportSpreadsheet({
          title: `${remittanceType.toUpperCase()} Remittance Report - ${selectedMonth}`,
          fileName: `${remittanceType}_remittance_${selectedMonth}.xls`,
          meta: [
            { label: 'Organization', value: organizationName },
            { label: 'Total Staff', value: String(totalStaff) },
            { label: 'Total Amount', value: formatAmount(totalAmount) },
            ...(remittanceType === 'tax' && groups
              ? groups.map((g: any) => ({
                  label: `PIT State ${String(g.state || 'FCT')}`,
                  value: `Staff: ${String(g.total_staff || 0)}, Amount: ${formatAmount(g.total_amount || 0)}`,
                }))
              : []),
            { label: 'Generated At', value: new Date().toLocaleString() },
          ],
          columns:
            remittanceType === 'tax'
              ? [
                  { key: 'pit_remittance_state', label: 'PIT Remittance State' },
                  { key: 'staff_number', label: 'Staff Number' },
                  { key: 'staff_name', label: 'Staff Name' },
                  { key: 'amount', label: 'Amount' },
                ]
              : [
                  { key: 'staff_number', label: 'Staff Number' },
                  { key: 'staff_name', label: 'Staff Name' },
                  { key: 'amount', label: 'Amount' },
                ],
          rows: exportRows,
        });
      }
    } catch (error) {
      showToast('error', 'Failed to export report');
      console.error('Report Export Error:', error);
    }
  };

  const handleExportSelectedBankExcel = () => {
    if (!selectedBank) {
      showToast('error', 'No bank selected');
      return;
    }

    try {
      const formatAmount = (val: number | string | undefined | null) => {
        if (val === undefined || val === null) return '0.00';
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
      const rows = (selectedBank.lines || []).map((line: any) => ({
        staff_number: line.staff_number,
        staff_name: line.staff_name,
        account_number: String(line.account_number ?? '').trim(),
        net_pay: formatAmount(line.net_pay || 0),
      }));

      exportSpreadsheet({
        title: `Payroll Bank Schedule - ${selectedMonth} (${String(selectedBank.bank_name || 'Bank')})`,
        fileName: `payroll_bank_schedule_${String(selectedBank.bank_name || 'bank').replace(/\s+/g, '_')}_${selectedMonth}_${new Date().toISOString().split('T')[0]}.xls`,
        meta: [
          { label: 'Organization', value: organizationName },
          { label: 'Total Staff', value: String(selectedBank.total_staff || 0) },
          { label: 'Total Amount', value: formatAmount(selectedBank.total_amount || 0) },
          { label: 'Generated At', value: new Date().toLocaleString() },
        ],
        columns: [
          { key: 'staff_number', label: 'Staff Number' },
          { key: 'staff_name', label: 'Staff Name' },
          { key: 'account_number', label: 'Account Number' },
          { key: 'net_pay', label: 'Net Pay' },
        ],
        rows,
      });

      showToast('success', 'Bank report exported successfully');
    } catch (error) {
      showToast('error', 'Failed to export bank report');
      console.error('Bank Export Error:', error);
    }
  };

  const handleExportPDF = async () => {
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
        pageOrientation: 'landscape',
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
      if (organizationLogo) {
        docDefinition.content.push({
          columns: [
            { width: 80, image: organizationLogo, fit: [75, 75] },
            { width: '*', text: organizationName, style: 'header', margin: [0, 20, 0, 0] },
            { width: 80, text: '' }
          ]
        });
      } else {
        docDefinition.content.push({ text: organizationName, style: 'header' });
      }

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

        const sortedStaff = sortStaffByGradeDesc(reportData.staff || []);
        sortedStaff.forEach((staff: any) => {
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

      } else if (activeTab === 'bank-schedule') {
        docDefinition.content.push(
          { text: `Payroll Bank Payment Schedule (By Bank) - ${selectedMonth}`, style: 'subheader' },
          { text: `Generated: ${new Date().toLocaleDateString()}`, style: 'generated' }
        );

        const totals = reportData?.totals || {};
        docDefinition.content.push(
          { text: 'Summary', style: 'subheader', alignment: 'left', margin: [0, 10, 0, 5] },
          {
            columns: [
              { text: `Total Banks: ${totals.total_banks || 0}`, width: '*' },
              { text: `Total Staff: ${totals.total_staff || 0}`, width: '*' },
              { text: `Total Amount: ${formatPDFCurrency(totals.total_amount || 0)}`, width: '*' },
              { text: `Missing Details: ${totals.missing_bank_details || 0}`, width: '*' },
            ],
            margin: [0, 0, 0, 10],
          },
        );

        (reportData?.banks || []).forEach((bank: any, idx: number) => {
          docDefinition.content.push(
            {
              text: `Bank: ${bank.bank_name}  |  Staff: ${bank.total_staff || 0}  |  Total: ${formatPDFCurrency(bank.total_amount || 0)}`,
              style: 'subheader',
              alignment: 'left',
              margin: [0, idx === 0 ? 5 : 12, 0, 5],
            },
          );

          const tableBody = [
            [
              { text: 'Staff #', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Account Number', style: 'tableHeader' },
              { text: 'Net Pay', style: 'tableHeader', alignment: 'right' },
            ],
          ];

          (bank.lines || []).forEach((line: any) => {
            tableBody.push([
              { text: line.staff_number || 'N/A', style: 'tableCell' },
              { text: line.staff_name || 'N/A', style: 'tableCell' },
              { text: line.account_number || 'N/A', style: 'tableCell' },
              { text: formatPDFCurrency(line.net_pay || 0), style: 'tableCell', alignment: 'right' },
            ]);
          });

          docDefinition.content.push({
            table: {
              headerRows: 1,
              widths: ['auto', '*', 'auto', 'auto'],
              body: tableBody,
            },
            layout: tableLayout,
          });
        });

        filename = `payroll_bank_schedule_${selectedMonth}.pdf`;

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

        const groups = Array.isArray(reportData.grouped_by_state) ? reportData.grouped_by_state : null;
        const rows = Array.isArray(reportData.remittances) ? reportData.remittances : [];

        if (remittanceType === 'tax' && groups) {
          groups.forEach((g: any) => {
            docDefinition.content.push(
              { text: `PIT Remittance State: ${g.state || 'FCT'}`, style: 'subheader', alignment: 'left', margin: [0, 10, 0, 4] },
              {
                columns: [
                  { text: `Subtotal Staff: ${g.total_staff || 0}`, width: '*' },
                  { text: `Subtotal Amount: ${formatPDFCurrency(g.total_amount || 0)}`, width: '*' }
                ],
                margin: [0, 0, 0, 6]
              }
            );

            const tableBody = [
              [
                { text: 'Staff Number', style: 'tableHeader' },
                { text: 'Staff Name', style: 'tableHeader' },
                { text: 'Amount', style: 'tableHeader', alignment: 'right' }
              ]
            ];

            (g.remittances || []).forEach((rem: any) => {
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
          });
        } else {
          const tableBody = [
            [
              ...(remittanceType === 'tax' ? [{ text: 'PIT State', style: 'tableHeader' }] : []),
              { text: 'Staff Number', style: 'tableHeader' },
              { text: 'Staff Name', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ]
          ];

          rows.forEach((rem: any) => {
            tableBody.push([
              ...(remittanceType === 'tax' ? [{ text: rem.pit_remittance_state || 'FCT', style: 'tableCell' }] : []),
              { text: rem.staff_number || 'N/A', style: 'tableCell' },
              { text: rem.staff_name || 'N/A', style: 'tableCell' },
              { text: formatPDFCurrency(rem.amount || 0), style: 'tableCell', alignment: 'right' }
            ]);
          });

          docDefinition.content.push({
            table: {
              headerRows: 1,
              widths: remittanceType === 'tax' ? ['auto', 'auto', '*', 'auto'] : ['auto', '*', 'auto'],
              body: tableBody
            },
            layout: tableLayout
          });
        }

        filename = `${remittanceType}_remittance_${selectedMonth}.pdf`;
      }

      // Save PDF
      const pdfMake = await loadPdfMake();
      pdfMake.createPdf(docDefinition).download(filename);
      showToast('success', 'PDF exported successfully');
    } catch (error) {
      showToast('error', 'Failed to export PDF');
      console.error('PDF Export Error:', error);
    }
  };

  const handleExportSelectedBankPDF = async () => {
    if (!selectedBank) {
      showToast('error', 'No bank selected');
      return;
    }

    try {
      const formatPDFCurrency = (amount: any) => {
        const val = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (val === undefined || val === null || isNaN(val)) return '₦0.00';
        return '₦' + val.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const tableLayout = {
        hLineWidth: function () { return 0; },
        vLineWidth: function () { return 0; },
        paddingLeft: function () { return 10; },
        paddingRight: function () { return 10; },
        paddingTop: function () { return 8; },
        paddingBottom: function () { return 8; },
        fillColor: function (i: number) {
          if (i === 0) return '#008000';
          return (i % 2 === 0) ? '#F9FAFB' : null;
        }
      };

      const baseDocDefinition: any = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
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

      const docDefinition: any = { ...baseDocDefinition, content: [] };

      if (organizationLogo) {
        docDefinition.content.push({
          columns: [
            { width: 80, image: organizationLogo, fit: [75, 75] },
            { width: '*', text: organizationName, style: 'header', margin: [0, 20, 0, 0] },
            { width: 80, text: '' }
          ]
        });
      } else {
        docDefinition.content.push({ text: organizationName, style: 'header' });
      }

      docDefinition.content.push(
        { text: `Payroll Bank Payment Schedule (By Bank) - ${selectedMonth}`, style: 'subheader' },
        { text: `Bank: ${selectedBank.bank_name}`, style: 'generated' },
        { text: `Generated: ${new Date().toLocaleDateString()}`, style: 'generated' }
      );

      docDefinition.content.push(
        {
          columns: [
            { text: `Staff: ${selectedBank.total_staff || 0}`, width: '*' },
            { text: `Total: ${formatPDFCurrency(selectedBank.total_amount || 0)}`, width: '*' },
          ],
          margin: [0, 0, 0, 10],
        }
      );

      const tableBody = [
        [
          { text: 'Staff #', style: 'tableHeader' },
          { text: 'Name', style: 'tableHeader' },
          { text: 'Account Number', style: 'tableHeader' },
          { text: 'Net Pay', style: 'tableHeader', alignment: 'right' },
        ],
      ];

      (selectedBank.lines || []).forEach((line: any) => {
        tableBody.push([
          { text: line.staff_number || 'N/A', style: 'tableCell' },
          { text: line.staff_name || 'N/A', style: 'tableCell' },
          { text: line.account_number || 'N/A', style: 'tableCell' },
          { text: formatPDFCurrency(line.net_pay || 0), style: 'tableCell', alignment: 'right' },
        ]);
      });

      docDefinition.content.push({
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto'],
          body: tableBody,
        },
        layout: tableLayout,
      });

      const filename = `payroll_bank_schedule_${String(selectedBank.bank_name || 'bank').replace(/\s+/g, '_')}_${selectedMonth}.pdf`;
      const pdfMake = await loadPdfMake();
      pdfMake.createPdf(docDefinition).download(filename);

      showToast('success', 'Bank PDF exported successfully');
    } catch (error) {
      showToast('error', 'Failed to export bank PDF');
      console.error('Bank PDF Export Error:', error);
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
        { id: 'bank-schedule', label: 'Bank Payment Schedule', icon: Building2 },
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
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent"
          >
            <Download className="w-4 h-4" />
            Export Excel
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
            <div className="grid grid-cols-2 gap-4">
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
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setStaffDepartment('');
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
              <div className="text-sm text-muted-foreground">Active Staff</div>
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
                {sortGradeEntriesDesc(reportData.by_grade || {}).slice(0, 8).map(([grade, count]) => (
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
              const sortedStaff = sortStaffByGradeDesc(reportData.staff || []);
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
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-foreground">{formatCompactCurrency(reportData.summary.total_basic).short}</span>
                    <span className="text-xs text-muted-foreground font-mono">{formatCompactCurrency(reportData.summary.total_basic).full}</span>
                  </div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Gross Pay</div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-foreground">{formatCompactCurrency(reportData.summary.total_gross).short}</span>
                    <span className="text-xs text-muted-foreground font-mono">{formatCompactCurrency(reportData.summary.total_gross).full}</span>
                  </div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Net Pay</div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-green-700 dark:text-green-500">{formatCompactCurrency(reportData.summary.total_net).short}</span>
                    <span className="text-xs text-green-600/70 dark:text-green-400/70 font-mono">{formatCompactCurrency(reportData.summary.total_net).full}</span>
                  </div>
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

      {/* Bank Payment Schedule */}
      {activeTab === 'bank-schedule' && (
        <div className="space-y-6">
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

          {reportData && reportData.banks ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Banks</div>
                  <div className="text-2xl font-semibold text-foreground">{reportData.totals?.total_banks || 0}</div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Staff</div>
                  <div className="text-2xl font-semibold text-foreground">{reportData.totals?.total_staff || 0}</div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-green-700 dark:text-green-500">{formatCompactCurrency(reportData.totals?.total_amount).short}</span>
                    <span className="text-xs text-green-600/70 dark:text-green-400/70 font-mono">{formatCompactCurrency(reportData.totals?.total_amount).full}</span>
                  </div>
                </div>
                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-1">Missing Bank Details</div>
                  <div className="text-2xl font-semibold text-foreground">{reportData.totals?.missing_bank_details || 0}</div>
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-card-foreground mb-4">Banks - {selectedMonth}</h3>
                <DataTable
                  data={reportData.banks || []}
                  columns={[
                    { header: 'Bank', accessor: (row: any) => row.bank_name || 'Unknown', sortable: true },
                    { header: 'Staff Count', accessor: (row: any) => row.total_staff || 0, sortable: true },
                    { header: 'Total Amount', accessor: (row: any) => formatCurrency(row.total_amount || 0), sortable: true },
                  ]}
                  onRowClick={(row: any) => {
                    setSelectedBank(row);
                    setShowBankModal(true);
                  }}
                  searchable
                  searchPlaceholder="Search banks..."
                />
              </div>
            </>
          ) : (
            <div className="bg-card rounded-lg border border-border p-12 text-center">
              <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payroll bank schedule for selected month</p>
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
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-foreground">{formatCompactCurrency(reportData.month1?.total_net).short}</span>
                    <span className="text-xs text-muted-foreground font-mono">{formatCompactCurrency(reportData.month1?.total_net).full}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{reportData.month1?.total_staff || 0} staff</div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-2">{reportData.month2?.month || 'Month 2'}</div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-foreground">{formatCompactCurrency(reportData.month2?.total_net).short}</span>
                    <span className="text-xs text-muted-foreground font-mono">{formatCompactCurrency(reportData.month2?.total_net).full}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{reportData.month2?.total_staff || 0} staff</div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                  <div className="text-sm text-muted-foreground mb-2">Variance</div>
                  <div className="flex flex-col">
                    <span className={`text-xl font-bold ${(reportData.variance?.amount_change || 0) >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-700 dark:text-red-500'}`}>
                      {(reportData.variance?.amount_change || 0) >= 0 ? '+' : ''}{formatCompactCurrency(reportData.variance?.amount_change).short}
                    </span>
                    <span className={`text-xs font-mono ${(reportData.variance?.amount_change || 0) >= 0 ? 'text-green-600/70' : 'text-red-600/70'}`}>
                       {formatCompactCurrency(reportData.variance?.amount_change).full}
                    </span>
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

      <Modal
        isOpen={showBankModal}
        onClose={() => {
          setShowBankModal(false);
          setSelectedBank(null);
        }}
        title={`${selectedBank?.bank_name || 'Bank'} - ${selectedMonth}`}
        size="xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleExportSelectedBankExcel}
              className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent"
            >
              <Download className="w-4 h-4" />
              Export Bank Excel
            </button>
            <button
              onClick={handleExportSelectedBankPDF}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <FileText className="w-4 h-4" />
              Export Bank PDF
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Staff Count</div>
              <div className="text-lg font-semibold text-foreground">{selectedBank?.total_staff || 0}</div>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Amount</div>
              <div className="text-lg font-semibold text-foreground">{formatCurrency(selectedBank?.total_amount || 0)}</div>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Month</div>
              <div className="text-lg font-semibold text-foreground">{selectedMonth}</div>
            </div>
          </div>

          <DataTable
            data={selectedBank?.lines || []}
            columns={[
              { header: 'Staff Number', accessor: 'staff_number' as keyof any, sortable: true },
              { header: 'Staff Name', accessor: 'staff_name' as keyof any, sortable: true },
              { header: 'Account Number', accessor: 'account_number' as keyof any, sortable: true },
              { header: 'Net Pay', accessor: (row: any) => formatCurrency(row.net_pay || 0), sortable: true },
            ]}
            searchable
            searchPlaceholder="Search staff..."
          />
        </div>
      </Modal>

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
                  {cooperativeManagementEnabled && <option value="cooperative">Cooperative</option>}
                </select>
              </div>
            </div>
            {remittanceType === 'tax' && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">
                    Schedule State
                  </label>
                  <select
                    value={payeScheduleState}
                    onChange={(e) => setPayeScheduleState(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-input-background dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {getPayeStates().map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex items-end">
                  <button
                    onClick={handleDownloadPayeScheduleExcel}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent"
                  >
                    <Download className="w-4 h-4" />
                    Download PAYE Schedule (Excel)
                  </button>
                </div>
              </div>
            )}
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
                {remittanceType === 'tax' && Array.isArray(reportData.grouped_by_state) ? (
                  <div className="space-y-6">
                    {reportData.grouped_by_state.map((g: any) => (
                      <div key={g.state || 'FCT'} className="rounded-lg border border-border p-4 bg-muted/20">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                          <div className="font-semibold text-card-foreground">
                            PAYE (Tax) Remittance - {g.state || 'FCT'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Subtotal: {formatCurrency(g.total_amount || 0)} ({g.total_staff || 0} staff)
                          </div>
                        </div>
                        <DataTable
                          data={g.remittances || []}
                          columns={[
                            { header: 'Staff Number', accessor: 'staff_number' as keyof any },
                            { header: 'Staff Name', accessor: 'staff_name' as keyof any },
                            { header: 'Amount', accessor: (row: any) => formatCurrency(row.amount) },
                          ]}
                          searchable
                          searchPlaceholder="Search PAYE remittances..."
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <DataTable
                    data={reportData.remittances || []}
                    columns={[
                      ...(remittanceType === 'tax' ? [{ header: 'PIT State', accessor: 'pit_remittance_state' as keyof any }] : []),
                      { header: 'Staff Number', accessor: 'staff_number' as keyof any },
                      { header: 'Staff Name', accessor: 'staff_name' as keyof any },
                      { header: 'Amount', accessor: (row: any) => formatCurrency(row.amount) },
                    ]}
                    searchable
                    searchPlaceholder="Search remittances..."
                  />
                )}
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
