import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { showToast } from '../utils/toast';

interface SalaryStructureUploadProps {
  onDataParsed: (data: ParsedSalaryData) => void;
  onClose: () => void;
}

interface ParsedSalaryData {
  gradeLevels: Array<{
    level: string;
    steps: Array<{
      step: number;
      basic_salary: number;
    }>;
  }>;
}

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export function SalaryStructureUpload({ onDataParsed, onClose }: SalaryStructureUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewData, setPreviewData] = useState<ParsedSalaryData | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.csv') && 
        !selectedFile.name.endsWith('.xls') && 
        !selectedFile.name.endsWith('.xlsx')) {
      showToast.error('Invalid file type. Please upload a CSV or Excel file.');
      return;
    }

    setFile(selectedFile);
    await parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    setParsing(true);
    setErrors([]);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('File must contain at least a header row and one data row');
      }

      // Parse CSV
      const rows = lines.map(line => {
        // Handle quoted fields with commas
        const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
        return matches ? matches.map(field => field.replace(/^"|"$/g, '').trim()) : [];
      });

      const headers = rows[0].map(h => h.toLowerCase());

      // Validate headers
      const requiredHeaders = ['grade_level', 'step', 'basic_salary'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      const gradeIndex = headers.indexOf('grade_level');
      const stepIndex = headers.indexOf('step');
      const salaryIndex = headers.indexOf('basic_salary');

      const validationErrors: ValidationError[] = [];
      const dataMap = new Map<string, Map<number, number>>();

      // Parse data rows
      rows.slice(1).forEach((row, index) => {
        const rowNum = index + 2; // +2 for header and 0-based index

        const gradeLevelRaw = row[gradeIndex];
        const gradeLevel = gradeLevelRaw?.toString().trim() || '';
        const step = parseInt(row[stepIndex]);
        const salary = parseFloat(row[salaryIndex]);

        // Validate grade level
        if (!gradeLevel || !/^[A-Za-z0-9]+$/.test(gradeLevel)) {
          validationErrors.push({
            row: rowNum,
            column: 'grade_level',
            message: `Invalid grade level: ${gradeLevelRaw}. Use values like 1, 2, CAT1`,
          });
        }

        // Validate step
        if (isNaN(step) || step < 1 || step > 15) {
          validationErrors.push({
            row: rowNum,
            column: 'step',
            message: `Invalid step: ${row[stepIndex]}. Must be between 1 and 15`,
          });
        }

        // Validate salary
        if (isNaN(salary) || salary < 0) {
          validationErrors.push({
            row: rowNum,
            column: 'basic_salary',
            message: `Invalid salary: ${row[salaryIndex]}. Must be a positive number`,
          });
        }

        // Check for duplicates
        if (!dataMap.has(gradeLevel)) {
          dataMap.set(gradeLevel, new Map());
        }
        const gradeMap = dataMap.get(gradeLevel)!;
        if (gradeMap.has(step)) {
          validationErrors.push({
            row: rowNum,
            column: 'grade_level/step',
            message: `Duplicate entry for Grade ${gradeLevel}, Step ${step}`,
          });
        } else {
          gradeMap.set(step, salary);
        }
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        showToast.error(`Found ${validationErrors.length} validation error(s). Please review.`);
      } else {
        // Convert to the expected format
        const gradeLevels = Array.from(dataMap.entries())
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
          .map(([level, stepsMap]) => ({
            level,
            steps: Array.from(stepsMap.entries())
              .sort(([a], [b]) => a - b)
              .map(([step, basic_salary]) => ({
                step,
                basic_salary,
              })),
          }));

        setPreviewData({ gradeLevels });
        setShowPreview(true);
        showToast.success(`Successfully parsed ${rows.length - 1} salary entries`);
      }
    } catch (error: any) {
      showToast.error(error.message || 'Failed to parse file');
      setErrors([{ row: 0, column: 'file', message: error.message }]);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!previewData) return;
    onDataParsed(previewData);
    showToast.success('Salary structure data imported successfully');
    onClose();
  };

  const downloadTemplate = () => {
    const headers = 'grade_level,step,basic_salary';
    const sampleData = [
      'CAT1,1,189060',
      'CAT1,2,191865',
      'CAT1,3,194635',
      'CAT4,1,203115',
      'CAT4,2,206228',
      'CAT4,3,209433',
      '// Add all your salary structure data...',
    ];

    const csv = [headers, ...sampleData].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'salary_structure_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="max-w-4xl w-full rounded-lg p-6 bg-card border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl">Upload Salary Structure</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Import salary data from CSV or Excel file
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Download Template Button */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Need a template?
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Download our CSV template with the required format: grade_level, step, basic_salary
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="ml-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Template
            </button>
          </div>
        </div>

        {/* File Upload */}
        {!showPreview && (
          <div className="mb-6">
            <label className="block border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm mb-1">
                {file ? file.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-muted-foreground">
                Supports CSV, XLS, XLSX (Max 5MB)
              </p>
            </label>
          </div>
        )}

        {/* Parsing Indicator */}
        {parsing && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Parsing file...</p>
          </div>
        )}

        {/* Validation Errors */}
        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900 dark:text-red-100">
                  {errors.length} Validation Error{errors.length > 1 ? 's' : ''}
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Please fix the following issues and re-upload the file:
                </p>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-left bg-red-100 dark:bg-red-900/30">
                  <tr>
                    <th className="px-2 py-1">Row</th>
                    <th className="px-2 py-1">Column</th>
                    <th className="px-2 py-1">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((error, idx) => (
                    <tr key={idx} className="border-t border-red-200 dark:border-red-800">
                      <td className="px-2 py-1 text-red-900 dark:text-red-100">{error.row}</td>
                      <td className="px-2 py-1 text-red-900 dark:text-red-100">{error.column}</td>
                      <td className="px-2 py-1 text-red-700 dark:text-red-300">{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Preview Data */}
        {showPreview && previewData && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="font-medium text-green-900 dark:text-green-100">
                  Data Validated Successfully
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {previewData.gradeLevels.length} grade levels with{' '}
                  {previewData.gradeLevels.reduce((sum, gl) => sum + gl.steps.length, 0)} total salary entries
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-auto">
              <h4 className="font-medium mb-3">Preview</h4>
              <div className="space-y-4">
                {previewData.gradeLevels.slice(0, 5).map((gradeLevel) => (
                  <div key={gradeLevel.level} className="bg-card border border-border rounded p-3">
                    <h5 className="font-medium mb-2">Grade Level {gradeLevel.level}</h5>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      {gradeLevel.steps.slice(0, 8).map((step) => (
                        <div key={step.step} className="flex justify-between">
                          <span className="text-muted-foreground">Step {step.step}:</span>
                          <span className="font-medium">₦{step.basic_salary.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    {gradeLevel.steps.length > 8 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ... and {gradeLevel.steps.length - 8} more steps
                      </p>
                    )}
                  </div>
                ))}
                {previewData.gradeLevels.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    ... and {previewData.gradeLevels.length - 5} more grade levels
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          {showPreview && (
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Import Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
