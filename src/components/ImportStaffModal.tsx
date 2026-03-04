import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Check, AlertCircle, Download } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from './Toast';
import { staffAPI } from '../lib/api-client';

interface ImportStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportStaffModal({ isOpen, onClose, onSuccess }: ImportStaffModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please upload a valid CSV file');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setImportResult(null);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const data = parseCSV(text);
        if (data.length === 0) {
          setError('CSV file is empty or invalid');
          setPreviewData([]);
        } else {
          setPreviewData(data.slice(0, 5)); // Preview first 5 rows
        }
      } catch (err) {
        setError('Failed to parse CSV file');
        setPreviewData([]);
      }
    };
    reader.readAsText(file);
  };

  // Basic CSV parser
  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    
    // Map common variations of headers to standard keys
    const headerMap: Record<string, string> = {
      'first name': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName',
      'last name': 'lastName', 'lastname': 'lastName', 'last_name': 'lastName',
      'email': 'email', 'email address': 'email',
      'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone',
      'department': 'departmentName', 'dept': 'departmentName',
      'designation': 'designation', 'role': 'designation',
      'gender': 'gender', 'sex': 'gender',
    };

    return lines.slice(1).map(line => {
      // Basic split that respects quotes somewhat
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      
      const obj: any = {};
      headers.forEach((header, index) => {
        const cleanHeader = header.replace(/[^a-z0-9_]/g, '');
        const key = headerMap[header] || headerMap[cleanHeader] || cleanHeader;
        
        const value = values[index] ? values[index].trim().replace(/^"|"$/g, '') : '';
        obj[key] = value;
      });
      return obj;
    });
  };

  const mapDataToDto = (data: any[]) => {
    return data.map(row => ({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      departmentName: row.departmentName,
      designation: row.designation,
      gender: row.gender,
      // Default values for required fields if missing
      password: 'password123', 
    }));
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setImportResult(null);

    // Re-parse the full file
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        const rawData = parseCSV(text);
        const mappedData = mapDataToDto(rawData);
        
        // Basic validation
        const validData = mappedData.filter(d => d.firstName && d.lastName && d.email);
        
        if (validData.length === 0) {
          setError("No valid records found in CSV. Please ensure headers match: First Name, Last Name, Email, Phone, Department");
          setIsUploading(false);
          return;
        }

        const response = await staffAPI.bulkImport(validData);
        setImportResult(response);
        
        if (response.success > 0) {
           showToast('success', `Successfully imported ${response.success} staff records`);
           onSuccess(); // Refresh the list
        } else {
           showToast('error', 'Failed to import any records');
        }
      } catch (err: any) {
        setError(err.message || 'Upload failed');
        showToast('error', 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = "First Name,Last Name,Email,Phone,Department,Designation,Gender";
    const sample = "John,Doe,john.doe@example.com,08012345678,IT,Developer,Male";
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + sample;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "staff_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Bulk Import Staff</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* File Upload Area */}
          {!importResult && (
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-gray-600 mb-2">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500">CSV files only</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </div>

              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                {file && (
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText className="w-4 h-4 mr-2" />
                    {file.name}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          {/* Preview Area */}
          {previewData.length > 0 && !importResult && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Preview (First 5 rows)</h3>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(previewData[0]).map(key => (
                        <th key={key} className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewData.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-md ${importResult.success > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center">
                  {importResult.success > 0 ? (
                    <Check className="w-5 h-5 text-green-600 mr-2" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  )}
                  <h3 className={`font-medium ${importResult.success > 0 ? 'text-green-800' : 'text-red-800'}`}>
                    Import Completed
                  </h3>
                </div>
                <div className="mt-2 text-sm ml-7">
                  <p className="text-green-700">Successfully imported: {importResult.success}</p>
                  <p className="text-red-700">Failed: {importResult.failed}</p>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Errors</h4>
                  <ul className="space-y-1">
                    {importResult.errors.map((err: any, i: number) => (
                      <li key={i} className="text-xs text-red-600 flex justify-between">
                        <span className="font-medium">{err.record}:</span>
                        <span>{err.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
          {importResult ? (
             <Button onClick={() => { onSuccess(); onClose(); }}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || isUploading}>
                {isUploading ? 'Importing...' : 'Import Staff'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
