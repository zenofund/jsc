
import { formatCurrency } from './format';

export const generatePayslipPDF = (
  payslip: any,
  user: any = null,
  branding?: { organizationName?: string; organizationLogo?: string }
) => {
  const line = payslip.line || {};
  const batch = payslip.batch || {};

  // Helper for currency formatting in PDF
  const formatPDFCurrency = (amount: any) => {
    const val = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (val === undefined || val === null || isNaN(val)) return '₦0.00';
    return '₦' + val.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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

  const tableLayout = {
    hLineWidth: function (i: number, node: any) { return 1; },
    vLineWidth: function (i: number, node: any) { return 0; },
    hLineColor: function (i: number, node: any) { return '#e5e7eb'; },
    paddingLeft: function (i: number, node: any) { return 8; },
    paddingRight: function (i: number, node: any) { return 8; },
    paddingTop: function (i: number, node: any) { return 8; },
    paddingBottom: function (i: number, node: any) { return 8; },
  };

  const organizationName = branding?.organizationName || 'Judicial Service Committee';
  const organizationLogo = branding?.organizationLogo || '';

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    watermark: { text: 'CONFIDENTIAL', color: '#9ca3af', opacity: 0.1, bold: true, italics: false },
    content: [
      // Header
      {
        columns: [
          ...(organizationLogo ? [{
            width: 80,
            image: organizationLogo,
            fit: [75, 75],
            margin: [0, 0, 10, 0]
          }] : []),
          {
            width: '*',
            stack: [
              { text: organizationName, style: 'brandTitle' },
              { text: 'Payroll Payslip', style: 'brandSubtitle' }
            ]
          },
          {
            width: 'auto',
            text: 'PAYSLIP',
            style: 'payslipBadge'
          }
        ],
        margin: [0, 0, 0, 20]
      },
      
      // Card Container (simulated with table)
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  // Card Header
                  {
                    columns: [
                      {
                        width: '*',
                        stack: [
                          { text: 'Salary Statement', style: 'cardTitle' },
                          { text: 'Confidential • For intended recipient only', style: 'cardSubtitle' }
                        ]
                      }
                    ],
                    margin: [0, 0, 0, 20]
                  },
                  
                  // Meta Grid
                  {
                    columns: [
                      {
                        stack: [
                          { text: 'Period', style: 'metaLabel' },
                          { text: `${batch.month || line.payroll_month || 'N/A'}`, style: 'metaValue' }
                        ],
                        style: 'metaBox'
                      },
                      {
                        stack: [
                          { text: 'Batch / Ref', style: 'metaLabel' },
                          { text: `${batch.batch_number || 'N/A'}`, style: 'metaValue' }
                        ],
                        style: 'metaBox'
                      },
                      {
                        stack: [
                          { text: 'Employee', style: 'metaLabel' },
                          { text: `${line.staff_name || user?.email || 'N/A'}`, style: 'metaValue' }
                        ],
                        style: 'metaBox'
                      },
                      {
                        stack: [
                          { text: 'Staff ID', style: 'metaLabel' },
                          { text: `${line.staff_number || user?.staff_id || 'N/A'}`, style: 'metaValue' }
                        ],
                        style: 'metaBox'
                      }
                    ],
                    columnGap: 10,
                    margin: [0, 0, 0, 20]
                  },

                  // Main Content Grid
                  {
                    columns: [
                      // Earnings Panel
                      {
                        width: '*',
                        stack: [
                          { text: 'Earnings', style: 'panelTitle' },
                          {
                            table: {
                              widths: ['*', 'auto'],
                              body: [
                                [
                                  { text: 'Description', style: 'tableHeader' },
                                  { text: 'Amount', style: 'tableHeader', alignment: 'right' }
                                ],
                                ['Basic Salary', { text: formatPDFCurrency(line.basic_salary || 0), alignment: 'right', style: 'tableCell' }],
                                ...allowances.map((a: any) => [
                                  { text: a.name, style: 'tableCell' },
                                  { text: formatPDFCurrency(a.amount), alignment: 'right', style: 'tableCell' }
                                ]),
                                [
                                  { text: 'Gross Pay', style: 'totalLabel' },
                                  { text: formatPDFCurrency(line.gross_pay || 0), style: 'totalValue' }
                                ]
                              ]
                            },
                            layout: tableLayout
                          }
                        ],
                        margin: [0, 0, 10, 0]
                      },

                      // Deductions & Summary
                      {
                        width: '*',
                        stack: [
                          { text: 'Deductions', style: 'panelTitle' },
                          {
                            table: {
                              widths: ['*', 'auto'],
                              body: [
                                [
                                  { text: 'Description', style: 'tableHeader' },
                                  { text: 'Amount', style: 'tableHeader', alignment: 'right' }
                                ],
                                ...deductions.map((d: any) => [
                                  { text: d.name || d.deduction_name || d.code || 'Unknown', style: 'tableCell' },
                                  { text: formatPDFCurrency(d.amount), alignment: 'right', style: 'tableCell' }
                                ]),
                                (!deductions.length) ? [{ text: 'No deductions', colSpan: 2, style: 'tableCell', color: '#9ca3af', alignment: 'center' }, {}] : null,
                                [
                                  { text: 'Total Deductions', style: 'totalLabel' },
                                  { text: formatPDFCurrency(line.total_deductions || 0), style: 'totalValue' }
                                ]
                              ].filter(Boolean) as any
                            },
                            layout: tableLayout,
                            margin: [0, 0, 0, 20]
                          },

                          // Net Pay Box
                          {
                            table: {
                              widths: ['*'],
                              body: [[
                                {
                                  stack: [
                                    { text: 'Net Pay', style: 'netPayLabel' },
                                    { text: formatPDFCurrency(line.net_pay || 0), style: 'netPayValue' },
                                    {
                                      text: [
                                        { text: 'Gross: ', style: 'chipLabel' }, { text: formatPDFCurrency(line.gross_pay || 0), style: 'chipValue' },
                                        { text: '  •  ', color: '#e5e7eb' },
                                        { text: 'Deductions: ', style: 'chipLabel' }, { text: formatPDFCurrency(line.total_deductions || 0), style: 'chipValue' }
                                      ]
                                    }
                                  ],
                                  fillColor: '#f0fdf4',
                                  margin: [0, 0, 0, 0]
                                }
                              ]]
                            },
                            layout: 'noBorders',
                            margin: [0, 0, 0, 10]
                          },

                          // Bank Details
                          {
                            table: {
                              widths: ['*'],
                              body: [[
                                {
                                  stack: [
                                    {
                                      columns: [
                                        { text: 'Bank', style: 'bankLabel' },
                                        { text: line.bank_name || 'N/A', style: 'bankValue' }
                                      ],
                                      margin: [0, 4]
                                    },
                                    {
                                      columns: [
                                        { text: 'Account', style: 'bankLabel' },
                                        { text: line.account_number ? `**** ${line.account_number.slice(-4)}` : 'N/A', style: 'bankValue' }
                                      ],
                                      margin: [0, 4]
                                    },
                                    {
                                      columns: [
                                        { text: 'Grade / Step', style: 'bankLabel' },
                                        { text: `GL ${line.grade_level || '?'} / ${line.step || '?'}`, style: 'bankValue' }
                                      ],
                                      margin: [0, 4]
                                    }
                                  ],
                                  fillColor: '#f9fafb'
                                }
                              ]]
                            },
                            layout: 'noBorders'
                          }
                        ],
                        margin: [10, 0, 0, 0]
                      }
                    ]
                  }
                ],
                margin: [20, 20, 20, 20]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: function(i: number) { return 1; },
          vLineWidth: function(i: number) { return 1; },
          hLineColor: '#e5e7eb',
          vLineColor: '#e5e7eb',
          paddingLeft: function(i: number) { return 0; },
          paddingRight: function(i: number) { return 0; },
          paddingTop: function(i: number) { return 0; },
          paddingBottom: function(i: number) { return 0; }
        }
      },

      // Footer
      {
        columns: [
          { text: 'Generated by JSC Payroll System. Do not share publicly', style: 'footerText' },
          { text: `Ref: ${batch.batch_number || 'N/A'}`, style: 'footerRef' }
        ],
        margin: [0, 10, 0, 0]
      }
    ],
    styles: {
      brandTitle: { fontSize: 16, bold: true, color: '#111827' },
      brandSubtitle: { fontSize: 10, color: '#6b7280', margin: [0, 2, 0, 0] },
      payslipBadge: { fontSize: 10, bold: true, color: '#16a34a', alignment: 'right' },
      cardTitle: { fontSize: 18, bold: true, color: '#111827' },
      cardSubtitle: { fontSize: 9, color: '#6b7280', margin: [0, 2, 0, 0] },
      metaBox: { margin: [0, 0, 0, 10] },
      metaLabel: { fontSize: 8, color: '#6b7280', bold: true, uppercase: true },
      metaValue: { fontSize: 10, color: '#111827', bold: true, margin: [0, 2, 0, 0] },
      panelTitle: { fontSize: 11, bold: true, color: '#111827', margin: [0, 0, 0, 8] },
      tableHeader: { fontSize: 9, bold: true, color: '#6b7280', uppercase: true, margin: [0, 0, 0, 4] },
      tableCell: { fontSize: 10, color: '#374151', margin: [0, 2, 0, 2] },
      totalLabel: { fontSize: 10, bold: true, color: '#111827', margin: [0, 4, 0, 0] },
      totalValue: { fontSize: 10, bold: true, color: '#111827', alignment: 'right', margin: [0, 4, 0, 0] },
      netPayLabel: { fontSize: 9, color: '#166534', bold: true, uppercase: true },
      netPayValue: { fontSize: 18, bold: true, color: '#166534', margin: [0, 4, 0, 8] },
      chipLabel: { fontSize: 9, color: '#6b7280' },
      chipValue: { fontSize: 9, bold: true, color: '#374151' },
      bankLabel: { fontSize: 8, color: '#6b7280', uppercase: true },
      bankValue: { fontSize: 9, color: '#111827', alignment: 'right' },
      footerText: { fontSize: 8, color: '#9ca3af' },
      footerRef: { fontSize: 8, color: '#9ca3af', alignment: 'right' }
    },
    defaultStyle: {
      font: 'Roboto'
    }
  };

  return docDefinition;
};
