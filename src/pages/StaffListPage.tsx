import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { staffAPI, departmentAPI, bankAPI, settingsAPI } from '../lib/api-client';
import { Staff, Department } from '../types/entities';
import { getAllStateNames, getLGAsByState } from '../lib/nigerian-locations';
import { Plus, Edit, UserX, UserCheck, Trash2, Eye, Upload } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Stepper } from '../components/Stepper';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { format } from 'date-fns';
import { PageSkeleton } from '../components/PageLoader';
import { loadPdfMake } from '../utils/loadPdfMake';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import Papa from 'papaparse';

export function StaffListPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [viewingStaff, setViewingStaff] = useState<Staff | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableLGAs, setAvailableLGAs] = useState<string[]>([]);
  const [supportedBanks, setSupportedBanks] = useState<{ name: string; code: string }[]>([]);
  const [allowedGrades, setAllowedGrades] = useState<string[]>(['3','4','5','6','7','8','9','10','12','13','14','15','16','17']);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvPreviewCount, setCsvPreviewCount] = useState<number>(0);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [uploadSummary, setUploadSummary] = useState<{ success: number; failed: number; errors: { record: string; error: string }[] } | null>(null);

  // Check if user can manage staff
  const canManageStaff = user?.role === 'admin' || user?.role === 'hr_manager';
  const canEditStaffNumber = user?.role === 'admin' || user?.role === 'hr_manager';

  // Form state
  const normalizeGrade = (value: any) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
  const isNumericGrade = (value: any) => /^\d+$/.test(normalizeGrade(value));

  const [formData, setFormData] = useState({
    staff_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    marital_status: '',
    nationality: 'Nigerian',
    state_of_origin: '',
    lga: '',
    zone: '',
    qualification: '',
    phone: '',
    email: '',
    address: '',
    nok_name: '',
    nok_relationship: '',
    nok_phone: '',
    nok_address: '',
    post_on_first_appointment: '',
    appointment_date: '',
    appointment_type: 'Permanent',
    employment_date: '', // Resumption date
    confirmation_date: '', // Date of confirmation
    retirement_date: '', // Expected retirement date
    exit_date: '', // Exit/Resignation date (optional)
    exit_reason: '', // Reason for exit (optional)
    present_appointment: '',
    date_of_present_appointment: '',
    department: '',
    unit: '',
    designation: '',
    cadre: '',
    grade_level: '7',
    step: 1,
    bank_code: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    pension_pin: '',
    tax_id: '',
    bvn: '',
    nhf_number: '',
    status: 'active',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const dateFields = [
    'date_of_birth',
    'appointment_date',
    'confirmation_date',
    'date_of_present_appointment',
    'employment_date',
    'retirement_date',
    'exit_date',
  ];

  const isDateField = (name: string) => dateFields.includes(name);

  const validateField = (name: string, value: any) => {
    let error = '';
    
    // Required fields check
    const requiredFields = [
      'staff_number',
      'first_name',
      'last_name',
      'gender',
      'date_of_birth',
      'state_of_origin',
      'lga',
      'zone',
      'qualification',
      'post_on_first_appointment',
      'appointment_date',
      'confirmation_date',
      'present_appointment',
      'date_of_present_appointment',
      'grade_level',
      'step',
      'bank_code',
      'bank_name',
      'account_name',
      'account_number',
      'exit_date',
    ];

    if (requiredFields.includes(name) && !value) {
      error = 'This field is required';
    }

    const isValidDdMmYyyy = (dateValue: string) => {
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateValue);
      if (!match) return false;
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      if (!day || !month || !year) return false;
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    };

    if (isDateField(name) && value && !isValidDdMmYyyy(String(value))) {
      error = 'Use dd/mm/yyyy format';
    }

    // Email validation
    if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      error = 'Invalid email address';
    }

    // Phone validation
    if ((name === 'phone' || name === 'nok_phone') && value && !/^\d{11}$/.test(value)) {
      error = 'Phone number must be 11 digits';
    }

    // Account number validation
    if (name === 'account_number' && value && !/^\d{10}$/.test(value)) {
      error = 'Account number must be 10 digits';
    }

    if (name === 'grade_level') {
      const gl = normalizeGrade(value);
      if (!allowedGrades.includes(gl)) {
        error = 'Selected Grade Level is not permitted by system settings';
      }
    }

    setFormErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const normalizeDateInput = (value: string) => {
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    return value;
  };

  const toApiDate = (value: string | undefined) => {
    if (!value) return undefined;
    const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toISOString().split('T')[0];
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'bank_code') {
      const selected = supportedBanks.find((b) => String(b.code) === String(value));
      const bankName = selected?.name || '';
      setFormData((prev) => ({ ...prev, bank_code: value, bank_name: bankName }));
      validateField('bank_code', value);
      validateField('bank_name', bankName);
    } else {
      const nextValue = isDateField(name) ? normalizeDateInput(value) : value;
      setFormData(prev => ({ ...prev, [name]: nextValue }));
      validateField(name, nextValue);
    }
    
    // Special handling for state of origin
    if (name === 'state_of_origin') {
      setFormData(prev => ({ ...prev, lga: '' }));
      setAvailableLGAs(getLGAsByState(value));
    }
  };

  useEffect(() => {
    loadStaff();
    loadDepartments();
    loadSupportedBanks();
    // Load allowed grades from settings
    (async () => {
      try {
        const settings = await settingsAPI.getSettings();
        if (Array.isArray(settings?.allowed_grades)) {
          const parsed = settings.allowed_grades
            .map((n: any) => normalizeGrade(n))
            .filter((n: string) => n.length > 0);
          const unique = Array.from(new Set<string>(parsed));
          const numeric = unique.filter((g) => /^\d+$/.test(g)).sort((a, b) => Number(a) - Number(b));
          const alpha = unique.filter((g) => !/^\d+$/.test(g)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
          setAllowedGrades([...numeric, ...alpha]);
        }
      } catch (e) {
        // Ignore, fallback to default
      }
    })();
  }, []);

  const loadSupportedBanks = async () => {
    try {
      if (bankAPI && typeof bankAPI.getSupportedBanks === 'function') {
        const banks = await bankAPI.getSupportedBanks();
        console.log('Loaded banks:', banks);
        if (Array.isArray(banks)) {
          setSupportedBanks(banks);
        } else {
          console.warn('Supported banks API returned non-array:', banks);
          setSupportedBanks([]);
        }
      } else {
        console.warn('bankAPI is not available');
      }
    } catch (error) {
      console.error('Failed to load supported banks:', error);
      setSupportedBanks([]);
    }
  };

  const loadStaff = async () => {
    try {
      const response = await staffAPI.getAllStaff({ fetchAll: true, limit: 500 });
      // Handle paginated response format from backend
      const rawData = Array.isArray(response) ? response : (response.data || []);
      
      // Map flat backend data to nested Staff interface
      const staffData = rawData.map((item: any) => ({
        id: item.id,
        staff_number: item.staff_number,
        bio_data: {
          first_name: item.first_name,
          middle_name: item.middle_name,
          last_name: item.last_name,
          date_of_birth: item.date_of_birth,
          gender: item.gender,
          phone: item.phone,
          email: item.email,
          address: item.address,
          state_of_origin: item.state_of_origin,
          lga_of_origin: item.lga_of_origin,
          zone: item.zone,
          qualification: item.qualification,
          marital_status: item.marital_status,
          nationality: item.nationality
        },
        next_of_kin: {
          name: item.nok_name,
          relationship: item.nok_relationship,
          phone: item.nok_phone,
          address: item.nok_address
        },
        appointment: {
          date_of_first_appointment: item.date_of_first_appointment || item.employment_date,
          post_on_first_appointment: item.post_on_first_appointment,
          present_appointment: item.present_appointment,
          date_of_present_appointment: item.date_of_present_appointment,
          current_posting: item.department_name,
          department: item.department_name,
          department_id: item.department_id,
          designation: item.designation,
          employment_date: item.employment_date,
          confirmation_date: item.confirmation_date,
          retirement_date: item.retirement_date,
          exit_date: item.exit_date,
          exit_reason: item.exit_reason,
          appointment_type: item.employment_type,
          unit: item.unit,
          cadre: item.cadre
        },
        salary_info: {
          grade_level: item.grade_level,
          step: item.step,
          bank_name: item.bank_name,
          bank_code: item.bank_code,
          account_number: item.account_number,
          account_name: item.account_name,
          bvn: item.bvn,
          pension_pin: item.pension_pin,
          tax_id: item.tax_id,
          nhf_number: item.nhf_number
        },
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        created_by: item.created_by
      }));

      // Sort by Grade Level desc, then Step desc
      staffData.sort((a: Staff, b: Staff) => {
        const aGrade = normalizeGrade(a.salary_info.grade_level);
        const bGrade = normalizeGrade(b.salary_info.grade_level);
        const aNum = /^\d+$/.test(aGrade) ? Number(aGrade) : null;
        const bNum = /^\d+$/.test(bGrade) ? Number(bGrade) : null;
        if (aNum !== null && bNum !== null) return bNum - aNum;
        if (aNum !== null) return -1;
        if (bNum !== null) return 1;
        const alphaCmp = bGrade.localeCompare(aGrade, undefined, { numeric: true, sensitivity: 'base' });
        if (alphaCmp !== 0) return alphaCmp;
        return (b.salary_info.step || 0) - (a.salary_info.step || 0);
      });

      setStaff(staffData);
    } catch (error) {
      showToast('error', 'Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await departmentAPI.getAllDepartments();
      setDepartments(data);
    } catch (error) {
      showToast('error', 'Failed to load departments');
    }
  };

  const openCreateModal = () => {
    setEditingStaff(null);
    resetForm();
    setIdempotencyKey(crypto.randomUUID());
    setShowFormModal(true);
  };

  const openUploadModal = () => {
    setCsvFileName('');
    setCsvPreviewCount(0);
    setParsedRecords([]);
    setUploadSummary(null);
    setShowUploadModal(true);
  };

  const parseCsvFile = (file: File) => {
    setIsParsing(true);
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        const rows = (results.data as any[]).filter((r) => Object.values(r).some((v) => v !== null && String(v).trim() !== ''));
        // Map CSV headers to backend BulkCreateStaffDto
        const mapped = rows.map((r) => {
          const lower = (s: string) => (s ? String(s).toLowerCase().trim() : undefined);
          const cap = (s: string) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase() : undefined);
          const num = (v: any) => (v === '' || v === undefined || v === null ? undefined : Number(v));
          const bankByCode = (code: any) =>
            supportedBanks.find((b) => String(b.code) === String(code))?.name;
          const bankByName = (name: any) =>
            supportedBanks.find((b) => String(b.name).toLowerCase() === String(name).toLowerCase())?.code;
          const rawBankCode = r.bank_code || undefined;
          const rawBankName = r.bank_name || undefined;
          const resolvedBankCode = rawBankCode || (rawBankName ? bankByName(rawBankName) : undefined);
          const resolvedBankName = rawBankName || (rawBankCode ? bankByCode(rawBankCode) : undefined);

          const rec = {
            staffNumber: r.staff_number || r.file_no || undefined,
            firstName: r.first_name || undefined,
            middleName: r.middle_name || undefined,
            lastName: r.last_name || undefined,
            dateOfBirth: r.date_of_birth || undefined,
            gender: lower(r.gender),
            maritalStatus: lower(r.marital_status),
            nationality: r.nationality || 'Nigerian',
            stateOfOrigin: r.state_of_origin || undefined,
            lgaOfOrigin: r.lga || r.lga_of_origin || undefined,
            zone: r.zone || undefined,
            qualification: r.qualification || undefined,
            phone: r.phone || undefined,
            email: r.email || undefined,
            address: r.address || undefined,
            nokName: r.nok_name || undefined,
            nokRelationship: r.nok_relationship || undefined,
            nokPhone: r.nok_phone || undefined,
            nokAddress: r.nok_address || undefined,
            // Either departmentId or departmentName can be provided; prefer name for CSV
            departmentName: r.department_name || undefined,
            departmentId: r.department_id || undefined,
            designation: r.designation || undefined,
            unit: r.unit || undefined,
            cadre: r.cadre || undefined,
            employmentType: cap(r.appointment_type) || undefined,
            employmentDate: r.date_of_first_appointment || r.employment_date || undefined,
            postOnFirstAppointment: r.post_on_first_appointment || undefined,
            presentAppointment: r.present_appointment || undefined,
            dateOfPresentAppointment: r.date_of_present_appointment || undefined,
            confirmationDate: r.confirmation_date || undefined,
            retirementDate: r.retirement_date || undefined,
            exitDate: r.exit_date || undefined,
            exitReason: r.exit_reason || undefined,
            gradeLevel: normalizeGrade(r.grade_level),
            step: num(r.step),
            bankName: resolvedBankName,
            bankCode: resolvedBankCode,
            accountNumber: r.account_number || undefined,
            accountName: r.account_name || undefined,
            pensionPin: r.pension_pin || undefined,
            taxId: r.tax_id || undefined,
            bvn: r.bvn || undefined,
            nhfNumber: r.nhf_number || undefined,
            status: lower(r.status) || undefined,
          };
          return rec;
        });
        const invalidRows: number[] = [];
        const filtered = mapped.filter((rec, idx) => {
          const gl = normalizeGrade((rec as any).gradeLevel);
          if (!allowedGrades.includes(gl)) {
            invalidRows.push(idx + 1);
            return false;
          }
          return true;
        });
        setCsvPreviewCount(filtered.length);
        if (invalidRows.length > 0) {
          showToast('error', `Removed ${invalidRows.length} row(s) with invalid Grade Level. Rows: ${invalidRows.join(', ')}`);
        }
        setParsedRecords(filtered);
        setIsParsing(false);
      },
      error: () => {
        showToast('error', 'Failed to parse CSV file');
        setIsParsing(false);
      },
    });
  };

  const handleBulkUpload = async () => {
    if (!parsedRecords.length) {
      showToast('error', 'Please select and parse a CSV file first');
      return;
    }
    try {
      setIsSubmitting(true);
      setUploadSummary(null); // Reset summary before upload
      
      const totalRecords = parsedRecords.length;
      showToast('info', `Starting upload of ${totalRecords} records...`);

      const result = await staffAPI.bulkImport(parsedRecords);
      setUploadSummary(result);
      
      if (result?.success > 0) {
        showToast('success', `Successfully uploaded ${result.success} records`);
        await loadStaff();
      }
      
      if (result?.failed > 0) {
        showToast('error', `${result.failed} records failed to upload. Check the summary below.`);
      }
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      showToast('error', error.message || 'Bulk upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    populateFormWithStaff(staffMember);
    setShowFormModal(true);
  };

  const populateFormWithStaff = (staffMember: Staff) => {
    setFormData({
      staff_number: staffMember.staff_number || '',
      first_name: staffMember.bio_data.first_name || '',
      middle_name: staffMember.bio_data.middle_name || '',
      last_name: staffMember.bio_data.last_name || '',
      date_of_birth: formatDateForInput(staffMember.bio_data.date_of_birth || ''),
      gender: staffMember.bio_data.gender || '',
      marital_status: staffMember.bio_data.marital_status || '',
      nationality: staffMember.bio_data.nationality || 'Nigerian',
      state_of_origin: staffMember.bio_data.state_of_origin || '',
      lga: staffMember.bio_data.lga_of_origin || '',
      zone: staffMember.bio_data.zone || '',
      qualification: staffMember.bio_data.qualification || '',
      phone: staffMember.bio_data.phone || '',
      email: staffMember.bio_data.email || '',
      address: staffMember.bio_data.address || '',
      nok_name: staffMember.next_of_kin.name || '',
      nok_relationship: staffMember.next_of_kin.relationship || '',
      nok_phone: staffMember.next_of_kin.phone || '',
      nok_address: staffMember.next_of_kin.address || '',
      post_on_first_appointment: staffMember.appointment.post_on_first_appointment || '',
      appointment_date: formatDateForInput(staffMember.appointment.date_of_first_appointment || ''),
      appointment_type: staffMember.appointment.appointment_type || 'Permanent',
      employment_date: formatDateForInput(staffMember.appointment.employment_date || ''),
      confirmation_date: formatDateForInput(staffMember.appointment.confirmation_date || ''),
      retirement_date: formatDateForInput(staffMember.appointment.retirement_date || ''),
      exit_date: formatDateForInput(staffMember.appointment.exit_date || ''),
      exit_reason: staffMember.appointment.exit_reason || '',
      present_appointment: staffMember.appointment.present_appointment || '',
      date_of_present_appointment: formatDateForInput(staffMember.appointment.date_of_present_appointment || ''),
      department: staffMember.appointment.department_id || '',
      unit: staffMember.appointment.unit || '',
      designation: staffMember.appointment.designation || '',
      cadre: staffMember.appointment.cadre || '',
      grade_level: normalizeGrade(staffMember.salary_info.grade_level) || '7',
      step: staffMember.salary_info.step || 1,
      bank_code: staffMember.salary_info.bank_code || '',
      bank_name: staffMember.salary_info.bank_name || '',
      account_number: staffMember.salary_info.account_number || '',
      account_name: staffMember.salary_info.account_name || '',
      pension_pin: staffMember.salary_info.pension_pin || '',
      tax_id: staffMember.salary_info.tax_id || '',
      bvn: staffMember.salary_info.bvn || '',
      nhf_number: staffMember.salary_info.nhf_number || '',
      status: staffMember.status || 'active',
    });
    setAvailableLGAs(getLGAsByState(staffMember.bio_data.state_of_origin || ''));
  };

  const formatDateDisplay = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return format(d, 'dd-MM-yyyy');
  };

  const handlePrintStaff = async () => {
    if (!viewingStaff) return;

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

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 20],
      styles: {
        header: { fontSize: 16, bold: true, color: '#008000', alignment: 'center', margin: [0, 0, 0, 5] },
        subheader: { fontSize: 12, alignment: 'center', margin: [0, 0, 0, 2] },
        generated: { fontSize: 10, alignment: 'center', margin: [0, 0, 0, 10], color: '#666666' },
        sectionHeader: { fontSize: 12, bold: true, margin: [0, 15, 0, 5], color: '#333333' },
        tableHeader: { bold: true, color: 'white', fontSize: 10 },
        tableCell: { fontSize: 9 }
      },
      defaultStyle: { fontSize: 10, font: 'Roboto' },
      content: [
        { text: 'Nigerian Judicial Service Committee', style: 'header' },
        { text: 'Staff Profile', style: 'subheader' },
        { text: `Generated: ${format(new Date(), 'dd-MM-yyyy')}`, style: 'generated' },

        // Personal Information
        { text: 'Personal Information', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['30%', '70%'],
            body: [
              [{ text: 'Field', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
              ['Staff Number', viewingStaff.staff_number || ''],
              ['First Name', viewingStaff.bio_data.first_name || ''],
              ['Middle Name', viewingStaff.bio_data.middle_name || ''],
              ['Last Name', viewingStaff.bio_data.last_name || ''],
              ['Date of Birth', formatDateDisplay(viewingStaff.bio_data.date_of_birth)],
              ['Gender', viewingStaff.bio_data.gender || ''],
              ['Phone', viewingStaff.bio_data.phone || ''],
              ['Email', viewingStaff.bio_data.email || ''],
              ['Address', viewingStaff.bio_data.address || ''],
              ['State of Origin', viewingStaff.bio_data.state_of_origin || ''],
              ['LGA of Origin', viewingStaff.bio_data.lga_of_origin || ''],
              ['Marital Status', viewingStaff.bio_data.marital_status || ''],
              ['Nationality', viewingStaff.bio_data.nationality || ''],
            ].map((row, i) => {
               if (i===0) return row;
               return row.map(cell => ({ text: cell, style: 'tableCell' }));
            })
          },
          layout: tableLayout
        },

        // Next of Kin
        { text: 'Next of Kin', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['30%', '70%'],
            body: [
              [{ text: 'Field', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
              ['Name', viewingStaff.next_of_kin.name || ''],
              ['Relationship', viewingStaff.next_of_kin.relationship || ''],
              ['Phone', viewingStaff.next_of_kin.phone || ''],
              ['Address', viewingStaff.next_of_kin.address || ''],
            ].map((row, i) => {
               if (i===0) return row;
               return row.map(cell => ({ text: cell, style: 'tableCell' }));
            })
          },
          layout: tableLayout
        },

        // Appointment
        { text: 'Appointment', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['30%', '70%'],
            body: [
              [{ text: 'Field', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
              ['Department', viewingStaff.appointment.department || ''],
              ['Designation', viewingStaff.appointment.designation || ''],
              ['Unit', viewingStaff.appointment.unit || ''],
              ['Cadre', viewingStaff.appointment.cadre || ''],
              ['Appointment Type', viewingStaff.appointment.appointment_type || ''],
              ['Employment Date', formatDateDisplay(viewingStaff.appointment.employment_date)],
              ['Date of First Appointment', formatDateDisplay(viewingStaff.appointment.date_of_first_appointment)],
              ['Exit Date', formatDateDisplay(viewingStaff.appointment.exit_date)],
              ['Exit Reason', viewingStaff.appointment.exit_reason || ''],
              ['Status', viewingStaff.status || ''],
            ].map((row, i) => {
               if (i===0) return row;
               return row.map(cell => ({ text: cell, style: 'tableCell' }));
            })
          },
          layout: tableLayout
        },

        // Salary & Bank
        { text: 'Salary & Bank', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['30%', '70%'],
            body: [
              [{ text: 'Field', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
              ['Grade Level', String(viewingStaff.salary_info.grade_level ?? '')],
              ['Step', String(viewingStaff.salary_info.step ?? '')],
              ['Bank Name', viewingStaff.salary_info.bank_name || ''],
              ['Account Number', viewingStaff.salary_info.account_number || ''],
              ['Account Name', viewingStaff.salary_info.account_name || ''],
              ['BVN', viewingStaff.salary_info.bvn || ''],
              ['Pension PIN', viewingStaff.salary_info.pension_pin || ''],
              ['Tax ID', viewingStaff.salary_info.tax_id || ''],
              ['NHF Number', viewingStaff.salary_info.nhf_number || ''],
            ].map((row, i) => {
               if (i===0) return row;
               return row.map(cell => ({ text: cell, style: 'tableCell' }));
            })
          },
          layout: tableLayout
        }
      ]
    };

    const filename = `${(viewingStaff.bio_data.last_name || 'staff')}_${viewingStaff.staff_number || ''}`.replace(/[^a-z0-9_\\-]/gi, '_');
    const pdfMake = await loadPdfMake();
    pdfMake.createPdf(docDefinition).download(`${filename}.pdf`);
  };

  const handleCreateStaff = async () => {
    // Validate required fields
    if (
      !formData.staff_number ||
      !formData.first_name ||
      !formData.last_name ||
      !formData.date_of_birth ||
      !formData.gender ||
      !formData.state_of_origin ||
      !formData.lga ||
      !formData.zone ||
      !formData.qualification ||
      !formData.post_on_first_appointment ||
      !formData.appointment_date ||
      !formData.confirmation_date ||
      !formData.present_appointment ||
      !formData.date_of_present_appointment ||
      !formData.exit_date ||
      !formData.grade_level ||
      !formData.step ||
      !formData.bank_code ||
      !formData.bank_name ||
      !formData.account_name ||
      !formData.account_number
    ) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      // Helper to capitalize first letter
      const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
      const lowerCase = (s: string) => s ? s.toLowerCase() : s;

      // Create flat DTO structure expected by backend
      const createStaffDto = {
        staffNumber: formData.staff_number,
        firstName: formData.first_name,
        middleName: formData.middle_name || undefined,
        lastName: formData.last_name,
        dateOfBirth: toApiDate(formData.date_of_birth),
        gender: lowerCase(formData.gender),
        maritalStatus: formData.marital_status ? lowerCase(formData.marital_status) : undefined,
        nationality: formData.nationality || undefined,
        stateOfOrigin: formData.state_of_origin,
        lgaOfOrigin: formData.lga,
        zone: formData.zone,
        qualification: formData.qualification,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        
        nokName: formData.nok_name || undefined,
        nokRelationship: formData.nok_relationship || undefined,
        nokPhone: formData.nok_phone || undefined,
        nokAddress: formData.nok_address || undefined,
        
        departmentId: formData.department || undefined, // This now holds the ID
        designation: formData.designation || undefined,
        unit: formData.unit || undefined,
        cadre: formData.cadre || undefined,
        employmentType: formData.appointment_type ? capitalize(formData.appointment_type) : undefined,
        employmentDate: toApiDate(formData.appointment_date),
        postOnFirstAppointment: formData.post_on_first_appointment,
        presentAppointment: formData.present_appointment,
        dateOfPresentAppointment: toApiDate(formData.date_of_present_appointment),
        confirmationDate: toApiDate(formData.confirmation_date),
        retirementDate: toApiDate(formData.retirement_date) || undefined,
        exitDate: toApiDate(formData.exit_date),
        exitReason: formData.exit_reason || undefined,
        
        gradeLevel: normalizeGrade(formData.grade_level),
        step: Number(formData.step),
        bankName: formData.bank_name,
        bankCode: formData.bank_code,
        accountNumber: formData.account_number,
        accountName: formData.account_name,
        pensionPin: formData.pension_pin || undefined,
        taxId: formData.tax_id || undefined,
        bvn: formData.bvn || undefined,
        nhfNumber: formData.nhf_number || undefined,
      };

      await staffAPI.createStaff(createStaffDto, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });

      showToast('success', `Staff created successfully`);
      setShowFormModal(false);
      setCurrentStep(1);
      loadStaff();
      resetForm();
    } catch (error: any) {
      console.error('Create staff error:', error);
      if (error.message?.includes('403') || error.status === 403) {
         showToast('error', 'You do not have permission to create staff.');
      } else {
         showToast('error', 'Failed to create staff');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    // Validate required fields
    if (
      !formData.staff_number ||
      !formData.first_name ||
      !formData.last_name ||
      !formData.date_of_birth ||
      !formData.gender ||
      !formData.state_of_origin ||
      !formData.lga ||
      !formData.zone ||
      !formData.qualification ||
      !formData.post_on_first_appointment ||
      !formData.appointment_date ||
      !formData.confirmation_date ||
      !formData.present_appointment ||
      !formData.date_of_present_appointment ||
      !formData.exit_date ||
      !formData.grade_level ||
      !formData.step ||
      !formData.bank_code ||
      !formData.bank_name ||
      !formData.account_name ||
      !formData.account_number
    ) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      // Helper to capitalize first letter
      const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
      const lowerCase = (s: string) => s ? s.toLowerCase() : s;

      // Create flat DTO structure expected by backend
      const updateStaffDto = {
        staffNumber: formData.staff_number,
        firstName: formData.first_name,
        middleName: formData.middle_name || undefined,
        lastName: formData.last_name,
        dateOfBirth: toApiDate(formData.date_of_birth),
        gender: lowerCase(formData.gender),
        maritalStatus: formData.marital_status ? lowerCase(formData.marital_status) : undefined,
        nationality: formData.nationality || undefined,
        stateOfOrigin: formData.state_of_origin,
        lgaOfOrigin: formData.lga,
        zone: formData.zone,
        qualification: formData.qualification,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        
        nokName: formData.nok_name || undefined,
        nokRelationship: formData.nok_relationship || undefined,
        nokPhone: formData.nok_phone || undefined,
        nokAddress: formData.nok_address || undefined,
        
        departmentId: formData.department || undefined,
        designation: formData.designation || undefined,
        unit: formData.unit || undefined,
        cadre: formData.cadre || undefined,
        employmentType: formData.appointment_type ? capitalize(formData.appointment_type) : undefined,
        // employmentDate: formData.employment_date, // Usually shouldn't change, but if needed
        // Only include if changed or just include it? Backend handles it.
        employmentDate: toApiDate(formData.appointment_date),
        postOnFirstAppointment: formData.post_on_first_appointment,
        presentAppointment: formData.present_appointment,
        dateOfPresentAppointment: toApiDate(formData.date_of_present_appointment),
        confirmationDate: toApiDate(formData.confirmation_date),
        retirementDate: toApiDate(formData.retirement_date) || undefined,
        exitDate: toApiDate(formData.exit_date),
        exitReason: formData.exit_reason || undefined,
        
        gradeLevel: normalizeGrade(formData.grade_level),
        step: Number(formData.step),
        bankName: formData.bank_name,
        bankCode: formData.bank_code,
        accountNumber: formData.account_number,
        accountName: formData.account_name,
        pensionPin: formData.pension_pin || undefined,
        taxId: formData.tax_id || undefined,
        bvn: formData.bvn || undefined,
        nhfNumber: formData.nhf_number || undefined,
        
        status: formData.status as 'active' | 'suspended' | 'on_leave' | 'retired' | 'terminated' | 'resigned' | 'secondment' | 'interdiction',
      };

      await staffAPI.updateStaff(
        editingStaff.id,
        updateStaffDto
      );

      showToast('success', `Staff ${editingStaff.staff_number} updated successfully`);
      setShowFormModal(false);
      setCurrentStep(1);
      setEditingStaff(null);
      loadStaff();
      resetForm();
    } catch (error) {
      console.error('Update staff error:', error);
      showToast('error', 'Failed to update staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      staff_number: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      marital_status: '',
      nationality: 'Nigerian',
      state_of_origin: '',
      lga: '',
      zone: '',
      qualification: '',
      phone: '',
      email: '',
      address: '',
      nok_name: '',
      nok_relationship: '',
      nok_phone: '',
      nok_address: '',
      post_on_first_appointment: '',
      appointment_date: '',
      appointment_type: 'Permanent',
      employment_date: '',
      confirmation_date: '',
      retirement_date: '',
      exit_date: '',
      exit_reason: '',
      present_appointment: '',
      date_of_present_appointment: '',
      department: '',
      unit: '',
      designation: '',
      cadre: '',
      grade_level: '7',
      step: 1,
      bank_code: '',
      bank_name: '',
      account_number: '',
      account_name: '',
      pension_pin: '',
      tax_id: '',
      bvn: '',
      nhf_number: '',
      status: 'active',
    } as any);
    setAvailableLGAs([]);
  };

  const columns = [
    {
      header: 'Staff Number',
      accessor: 'staff_number' as keyof Staff,
      sortable: true,
    },
    {
      header: 'Name',
      accessor: (row: Staff) => `${row.bio_data.first_name} ${row.bio_data.last_name}`,
    },
    {
      header: 'Designation',
      accessor: (row: Staff) => row.appointment.designation,
    },
    {
      header: 'Grade Level',
      accessor: (row: Staff) => `GL ${row.salary_info.grade_level} / Step ${row.salary_info.step}`,
    },
    {
      header: 'Department',
      accessor: (row: Staff) => row.appointment.department,
    },
    {
      header: 'Status',
      accessor: (row: Staff) => <StatusBadge status={row.status} />,
    },
    ...(canManageStaff
      ? [
          {
            header: 'Actions',
            accessor: (row: Staff) => (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingStaff(row);
                    setShowViewModal(true);
                  }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded transition-colors"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(row);
                  }}
                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded transition-colors"
                  title="Edit Staff"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const steps = [
    { label: 'Bio Data', description: 'Personal information' },
    { label: 'Next of Kin', description: 'Emergency contact' },
    { label: 'Appointment', description: 'Job details' },
    { label: 'Salary & Bank', description: 'Payment information' },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Staff Management' }]} />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Staff Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage employee records and information</p>
        </div>
        {canManageStaff && (
          <button
            onClick={openCreateModal}
            className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2 transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add New Staff</span>
            <span className="sm:hidden">Add Staff</span>
          </button>
        )}
        {canManageStaff && (
          <button
            onClick={openUploadModal}
            className="bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 flex items-center gap-2 transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Bulk Upload CSV</span>
            <span className="sm:hidden">Upload CSV</span>
          </button>
        )}
      </div>

      {loading ? (
        <PageSkeleton mode="table" />
      ) : (
        <DataTable
          data={staff}
          columns={columns}
          searchable
          searchPlaceholder="Search by name, staff number, or department..."
        />
      )}

      {/* Create/Edit Staff Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setCurrentStep(1);
          setEditingStaff(null);
          resetForm();
        }}
        title={editingStaff ? `Edit Staff - ${editingStaff.staff_number}` : 'Add New Staff'}
        size="lg"
        footer={
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (currentStep === 1) {
                  setShowFormModal(false);
                  setEditingStaff(null);
                  resetForm();
                } else {
                  setCurrentStep(currentStep - 1);
                }
              }}
              className="px-4 py-2 text-foreground hover:bg-accent rounded-lg"
            >
              {currentStep === 1 ? 'Cancel' : 'Previous'}
            </button>
            {currentStep < 4 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Next
              </button>
            ) : (
              <Button
                onClick={editingStaff ? handleUpdateStaff : handleCreateStaff}
                isLoading={isSubmitting}
              >
                {editingStaff ? 'Update Staff' : 'Create Staff'}
              </Button>
            )}
          </div>
        }
      >
        <Stepper steps={steps} currentStep={currentStep} />

        <div className="mt-6">
          {/* Step 1: Bio Data */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    File No (Staff Number) *
                  </label>
                  <input
                    type="text"
                    name="staff_number"
                    value={formData.staff_number}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.staff_number ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                    disabled={!!editingStaff && !canEditStaffNumber}
                  />
                  {formErrors.staff_number && <p className="text-red-500 text-xs mt-1">{formErrors.staff_number}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Surname *
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.last_name ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  />
                  {formErrors.last_name && <p className="text-red-500 text-xs mt-1">{formErrors.last_name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.first_name ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  />
                  {formErrors.first_name && <p className="text-red-500 text-xs mt-1">{formErrors.first_name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    name="middle_name"
                    value={formData.middle_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.middle_name ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  />
                  {formErrors.middle_name && <p className="text-red-500 text-xs mt-1">{formErrors.middle_name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Sex *
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.gender ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  {formErrors.gender && <p className="text-red-500 text-xs mt-1">{formErrors.gender}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="text"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.date_of_birth ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    placeholder="dd/mm/yyyy"
                    inputMode="numeric"
                    required
                  />
                  {formErrors.date_of_birth && <p className="text-red-500 text-xs mt-1">{formErrors.date_of_birth}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    State of Origin *
                  </label>
                  <select
                    name="state_of_origin"
                    value={formData.state_of_origin}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.state_of_origin ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  >
                    <option value="">Select State</option>
                    {getAllStateNames().map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  {formErrors.state_of_origin && <p className="text-red-500 text-xs mt-1">{formErrors.state_of_origin}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    LGA *
                  </label>
                  <select
                    name="lga"
                    value={formData.lga}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.lga ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                    disabled={!formData.state_of_origin}
                  >
                    <option value="">Select LGA</option>
                    {availableLGAs.map((lga) => (
                      <option key={lga} value={lga}>
                        {lga}
                      </option>
                    ))}
                  </select>
                  {formErrors.lga && <p className="text-red-500 text-xs mt-1">{formErrors.lga}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Zone (NC, NE, NW, SS, SW, SE) *
                  </label>
                  <select
                    name="zone"
                    value={formData.zone}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.zone ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  >
                    <option value="">Select Zone</option>
                    <option value="NC">NC</option>
                    <option value="NE">NE</option>
                    <option value="NW">NW</option>
                    <option value="SS">SS</option>
                    <option value="SW">SW</option>
                    <option value="SE">SE</option>
                  </select>
                  {formErrors.zone && <p className="text-red-500 text-xs mt-1">{formErrors.zone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Qualification *
                  </label>
                  <input
                    type="text"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.qualification ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  />
                  {formErrors.qualification && <p className="text-red-500 text-xs mt-1">{formErrors.qualification}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Marital Status
                  </label>
                  <select
                    name="marital_status"
                    value={formData.marital_status}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.marital_status ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  >
                    <option value="">Select Status</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                  {formErrors.marital_status && <p className="text-red-500 text-xs mt-1">{formErrors.marital_status}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.phone ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  />
                  {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.email ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  />
                  {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Residential Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-3 py-2 border ${formErrors.address ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                />
                {formErrors.address && <p className="text-red-500 text-xs mt-1">{formErrors.address}</p>}
              </div>

              {/* Status Field - Only shown in Edit Mode */}
              {editingStaff && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Employment Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="on_leave">On Leave</option>
                    <option value="resigned">Resigned</option>
                    <option value="secondment">Secondment</option>
                    <option value="interdiction">Interdiction (Half Pay)</option>
                    <option value="retired">Retired</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Next of Kin */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="nok_name"
                    value={formData.nok_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.nok_name ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  />
                  {formErrors.nok_name && <p className="text-red-500 text-xs mt-1">{formErrors.nok_name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    name="nok_relationship"
                    value={formData.nok_relationship}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.nok_relationship ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    placeholder="e.g., Spouse, Parent, Sibling"
                  />
                  {formErrors.nok_relationship && <p className="text-red-500 text-xs mt-1">{formErrors.nok_relationship}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="nok_phone"
                  value={formData.nok_phone}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border ${formErrors.nok_phone ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                />
                {formErrors.nok_phone && <p className="text-red-500 text-xs mt-1">{formErrors.nok_phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Address
                </label>
                <textarea
                  name="nok_address"
                  value={formData.nok_address}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-3 py-2 border ${formErrors.nok_address ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                />
                {formErrors.nok_address && <p className="text-red-500 text-xs mt-1">{formErrors.nok_address}</p>}
              </div>
            </div>
          )}

          {/* Step 3: Appointment */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Post on 1st Appointment *
                  </label>
                  <input
                    type="text"
                    name="post_on_first_appointment"
                    value={formData.post_on_first_appointment}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.post_on_first_appointment ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  />
                  {formErrors.post_on_first_appointment && <p className="text-red-500 text-xs mt-1">{formErrors.post_on_first_appointment}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Date of 1st Appointment *
                  </label>
                  <input
                    type="text"
                    name="appointment_date"
                    value={formData.appointment_date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.appointment_date ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    placeholder="dd/mm/yyyy"
                    inputMode="numeric"
                    required
                    disabled={!!editingStaff && user?.role !== 'admin'}
                  />
                  {formErrors.appointment_date && <p className="text-red-500 text-xs mt-1">{formErrors.appointment_date}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Date of Confirmation *
                  </label>
                  <input
                    type="text"
                    name="confirmation_date"
                    value={formData.confirmation_date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.confirmation_date ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    placeholder="dd/mm/yyyy"
                    inputMode="numeric"
                    required
                  />
                  {formErrors.confirmation_date && <p className="text-red-500 text-xs mt-1">{formErrors.confirmation_date}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Present Appointment *
                  </label>
                  <input
                    type="text"
                    name="present_appointment"
                    value={formData.present_appointment}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.present_appointment ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  />
                  {formErrors.present_appointment && <p className="text-red-500 text-xs mt-1">{formErrors.present_appointment}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Date of Present Appointment *
                  </label>
                  <input
                    type="text"
                    name="date_of_present_appointment"
                    value={formData.date_of_present_appointment}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.date_of_present_appointment ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    placeholder="dd/mm/yyyy"
                    inputMode="numeric"
                    required
                  />
                  {formErrors.date_of_present_appointment && <p className="text-red-500 text-xs mt-1">{formErrors.date_of_present_appointment}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Date of Exit (Age or Service) *
                  </label>
                  <input
                    type="text"
                    name="exit_date"
                    value={formData.exit_date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.exit_date ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    placeholder="dd/mm/yyyy"
                    inputMode="numeric"
                    required
                  />
                  {formErrors.exit_date && <p className="text-red-500 text-xs mt-1">{formErrors.exit_date}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Exit Reason
                </label>
                <select
                  name="exit_reason"
                  value={formData.exit_reason}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select Reason</option>
                  <option value="resignation">Resignation</option>
                  <option value="termination">Termination</option>
                  <option value="retirement">Retirement</option>
                  <option value="death">Death</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Appointment Type
                  </label>
                  <select
                    name="appointment_type"
                    value={formData.appointment_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                    <option value="Casual">Casual</option>
                    <option value="Temporary">Temporary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Employment/Resumption Date
                  </label>
                  <input
                    type="text"
                    name="employment_date"
                    value={formData.employment_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="dd/mm/yyyy"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Retirement Date
                  </label>
                  <input
                    type="text"
                    name="retirement_date"
                    value={formData.retirement_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="dd/mm/yyyy"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Department
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.unit ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  />
                  {formErrors.unit && <p className="text-red-500 text-xs mt-1">{formErrors.unit}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Cadre
                  </label>
                  <input
                    type="text"
                    name="cadre"
                    value={formData.cadre}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.cadre ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    placeholder="e.g., Administrative, Legal, Technical"
                  />
                  {formErrors.cadre && <p className="text-red-500 text-xs mt-1">{formErrors.cadre}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.designation ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  />
                  {formErrors.designation && <p className="text-red-500 text-xs mt-1">{formErrors.designation}</p>}
                </div>
                <div />
              </div>
            </div>
          )}

          {/* Step 4: Salary & Bank */}
          {currentStep === 4 && (
            <div className="space-y-4">
              {/* Info box about auto-calculated salary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm">
                    <p className="text-blue-900 dark:text-blue-100">
                      <strong>Automatic Salary Calculation</strong>
                    </p>
                    <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                      Basic salary is automatically fetched from the active salary structure based on the selected grade level and step. No manual entry required.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Grade Level *
                  </label>
                  <select
                    name="grade_level"
                    value={formData.grade_level}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    {allowedGrades.map((level) => (
                      <option key={level} value={level}>
                        {isNumericGrade(level) ? `GL ${level}` : level}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Step *
                  </label>
                  <select
                    name="step"
                    value={formData.step}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((step) => (
                      <option key={step} value={step}>
                        Step {step}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Bank Name *
                  </label>
                  <select
                    name="bank_code"
                    value={formData.bank_code}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.bank_code ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  >
                    <option value="">Select Bank</option>
                    {Array.isArray(supportedBanks) && supportedBanks.map((bank, index) => (
                      <option key={`${bank.code}-${bank.name}-${index}`} value={bank.code}>
                        {bank.name} ({bank.code})
                      </option>
                    ))}
                  </select>
                  {formErrors.bank_code && <p className="text-red-500 text-xs mt-1">{formErrors.bank_code}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    name="account_number"
                    value={formData.account_number}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border ${formErrors.account_number ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                    required
                  />
                  {formErrors.account_number && <p className="text-red-500 text-xs mt-1">{formErrors.account_number}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  name="account_name"
                  value={formData.account_name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border ${formErrors.account_name ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  required
                />
                {formErrors.account_name && <p className="text-red-500 text-xs mt-1">{formErrors.account_name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Pension PIN
                  </label>
                  <input
                    type="text"
                    name="pension_pin"
                    value={formData.pension_pin}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    name="tax_id"
                    value={formData.tax_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    BVN
                  </label>
                  <input
                    type="text"
                    name="bvn"
                    value={formData.bvn}
                    onChange={handleInputChange}
                    maxLength={11}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    NHF Number
                  </label>
                  <input
                    type="text"
                    name="nhf_number"
                    value={formData.nhf_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setParsedRecords([]);
          setUploadSummary(null);
          setCsvFileName('');
          setCsvPreviewCount(0);
        }}
        title="Bulk Upload Staff via CSV"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                const csv =
                  [
                    'staff_number,first_name,middle_name,last_name,date_of_birth,gender,marital_status,nationality,state_of_origin,lga,zone,qualification,phone,email,address,nok_name,nok_relationship,nok_phone,nok_address,post_on_first_appointment,date_of_first_appointment,confirmation_date,present_appointment,date_of_present_appointment,exit_date,exit_reason,department_name,department_id,designation,unit,cadre,appointment_type,employment_date,retirement_date,grade_level,step,bank_code,bank_name,account_name,account_number,pension_pin,tax_id,bvn,nhf_number,status',
                    'JSC/2026/0001,Ada,Chioma,Okafor,1988-06-12,female,married,Nigerian,Anambra,Awka,SE,LLB,08012345678,ada.okafor@example.com,"12 Court Rd, GRA, Awka",Chinedu Okafor,Spouse,08087654321,"12 Court Rd, GRA, Awka",Legal Department,2024-04-15,2025-04-15,Senior Legal Officer,2026-01-10,2053-06-12,,Legal Department,,Senior Legal Officer,Prosecution,Legal,Permanent,,,10,3,057,Zenith Bank,Ada Okafor,0123456789,PN12345678,TAX-00921,22334455667,NHF-00231,active',
                    'JSC/2026/0002,Bello,Musa,Yusuf,1990-11-03,male,single,Nigerian,Kano,Nasarawa,NW,BSc,08123456789,bello.yusuf@example.com,"21 Civic Ave, Kano",Hauwa Yusuf,Parent,08198765432,"21 Civic Ave, Kano",Accounts Department,2024-09-01,2025-09-01,Accounts Officer,2026-02-01,2050-11-03,,Accounts Department,,Accounts Officer,Payments,Administrative,Contract,,,8,2,044,Access Bank,Bello Musa Yusuf,0987654321,PN87654321,TAX-00456,33445566778,NHF-00987,on_leave',
                  ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'staff-bulk-sample.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent"
            >
              Download Sample CSV
            </button>
            <button
              onClick={() => {
                setShowUploadModal(false);
                setParsedRecords([]);
                setUploadSummary(null);
                setCsvFileName('');
                setCsvPreviewCount(0);
              }}
              className="px-4 py-2 text-foreground hover:bg-accent rounded-lg"
            >
              Close
            </button>
            <Button onClick={handleBulkUpload} isLoading={isSubmitting} disabled={!parsedRecords.length}>
              Upload
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with headers like: staff_number, first_name, middle_name, last_name, date_of_birth,
              gender, state_of_origin, lga, zone, qualification, post_on_first_appointment, date_of_first_appointment,
              confirmation_date, present_appointment, date_of_present_appointment, exit_date, grade_level, step,
              bank_code, bank_name, account_name, account_number. Other existing headers can also be included.
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">CSV File</label>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={isSubmitting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) parseCsvFile(file);
              }}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg disabled:opacity-50"
            />
            {csvFileName && (
              <p className="text-xs text-muted-foreground">
                Selected: {csvFileName} {isParsing ? '(parsing...)' : parsedRecords.length ? `(${csvPreviewCount} rows)` : ''}
              </p>
            )}
          </div>

          {isSubmitting && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Processing bulk upload...</span>
                <span className="animate-pulse">Please wait</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full animate-progress-indeterminate"></div>
              </div>
            </div>
          )}

          {uploadSummary && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Success: {uploadSummary.success}</span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Failed: {uploadSummary.failed}</span>
              </div>
              {uploadSummary.errors?.length > 0 && (
                <div className="max-h-48 overflow-auto border border-border rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-2 py-1">Record</th>
                        <th className="text-left px-2 py-1">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadSummary.errors.map((e, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-2 py-1">{e.record}</td>
                          <td className="px-2 py-1 text-red-600">{e.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* View Staff Modal */}
      {viewingStaff && (
        <Modal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setViewingStaff(null);
          }}
          title={`Staff Profile - ${viewingStaff.staff_number}`}
          size="lg"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <h3 className="font-semibold text-foreground">
                  {viewingStaff.bio_data.first_name} {viewingStaff.bio_data.last_name}
                </h3>
                <p className="text-sm text-muted-foreground">{viewingStaff.appointment.designation}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={viewingStaff.status} />
                <button
                  onClick={handlePrintStaff}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Print PDF
                </button>
              </div>
            </div>

            <Tabs defaultValue="bio">
              <TabsList>
                <TabsTrigger value="bio">Bio Data</TabsTrigger>
                <TabsTrigger value="nok">Next of Kin</TabsTrigger>
                <TabsTrigger value="appointment">Appointment</TabsTrigger>
                <TabsTrigger value="salary">Salary & Bank</TabsTrigger>
              </TabsList>

              <TabsContent value="bio">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Date of Birth</dt>
                    <dd className="text-foreground">{formatDateDisplay(viewingStaff.bio_data.date_of_birth)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Gender</dt>
                    <dd className="text-foreground capitalize">{viewingStaff.bio_data.gender}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="text-foreground">{viewingStaff.bio_data.phone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="text-foreground">{viewingStaff.bio_data.email}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Address</dt>
                    <dd className="text-foreground">{viewingStaff.bio_data.address}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">State of Origin</dt>
                    <dd className="text-foreground">{viewingStaff.bio_data.state_of_origin}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">LGA of Origin</dt>
                    <dd className="text-foreground">{viewingStaff.bio_data.lga_of_origin}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Marital Status</dt>
                    <dd className="text-foreground">{viewingStaff.bio_data.marital_status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Nationality</dt>
                    <dd className="text-foreground">{viewingStaff.bio_data.nationality}</dd>
                  </div>
                </dl>
              </TabsContent>

              <TabsContent value="nok">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="text-foreground">{viewingStaff.next_of_kin.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Relationship</dt>
                    <dd className="text-foreground">{viewingStaff.next_of_kin.relationship}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="text-foreground">{viewingStaff.next_of_kin.phone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Address</dt>
                    <dd className="text-foreground">{viewingStaff.next_of_kin.address}</dd>
                  </div>
                </dl>
              </TabsContent>

              <TabsContent value="appointment">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Department</dt>
                    <dd className="text-foreground">{viewingStaff.appointment.department}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Designation</dt>
                    <dd className="text-foreground">{viewingStaff.appointment.designation}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Unit</dt>
                    <dd className="text-foreground">{viewingStaff.appointment.unit}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cadre</dt>
                    <dd className="text-foreground">{viewingStaff.appointment.cadre}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Appointment Type</dt>
                    <dd className="text-foreground">{viewingStaff.appointment.appointment_type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Employment Date</dt>
                    <dd className="text-foreground">{formatDateDisplay(viewingStaff.appointment.employment_date)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Date of First Appointment</dt>
                    <dd className="text-foreground">{formatDateDisplay(viewingStaff.appointment.date_of_first_appointment)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Exit Date</dt>
                    <dd className="text-foreground">{formatDateDisplay(viewingStaff.appointment.exit_date)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Exit Reason</dt>
                    <dd className="text-foreground">{viewingStaff.appointment.exit_reason}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="text-foreground">{viewingStaff.status}</dd>
                  </div>
                </dl>
              </TabsContent>

              <TabsContent value="salary">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Grade Level</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.grade_level}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Step</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.step}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Bank</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.bank_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Account Number</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.account_number}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Account Name</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.account_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">BVN</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.bvn}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Pension PIN</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.pension_pin}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tax ID</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.tax_id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">NHF Number</dt>
                    <dd className="text-foreground">{viewingStaff.salary_info.nhf_number}</dd>
                  </div>
                </dl>
              </TabsContent>
            </Tabs>
          </div>
        </Modal>
      )}
    </div>
  );
}
