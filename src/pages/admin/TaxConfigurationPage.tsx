import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { settingsAPI } from '../../lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { showToast } from '../../utils/toast';
import { PageSkeleton } from '../../components/PageLoader';
import { Plus, Trash2, Save, RefreshCw, Calculator, Info } from 'lucide-react';
import { Breadcrumb } from '../../components/Breadcrumb';

interface TaxBand {
  id: string;
  min: number;
  max: number | null;
  rate: number;
}

interface TaxConfiguration {
  enabled: boolean;
  consolidated_relief_allowance: number; // Deprecated: Set to 0
  gross_income_relief_percentage: number; // Deprecated: Set to 0
  rent_relief_percentage: number; // New: % of Housing Allowance
  minimum_tax_rate: number; // percentage
  pension_relief_percentage: number; // percentage
  nhf_relief_percentage: number; // percentage
  nhis_relief_percentage: number; // percentage
  tax_brackets: TaxBand[];
}

const DEFAULT_CONFIG: TaxConfiguration = {
  enabled: true,
  consolidated_relief_allowance: 0,
  gross_income_relief_percentage: 0,
  rent_relief_percentage: 60,
  minimum_tax_rate: 1,
  pension_relief_percentage: 8,
  nhf_relief_percentage: 2.5,
  nhis_relief_percentage: 5,
  tax_brackets: [
    { id: '1', min: 0, max: 800000, rate: 0 },
    { id: '2', min: 800000, max: 2200000, rate: 15 },
    { id: '3', min: 2200000, max: 9000000, rate: 25 },
    { id: '4', min: 9000000, max: null, rate: 30 },
  ],
};

export function TaxConfigurationPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<TaxConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const data = await settingsAPI.getTaxConfiguration();
      
      // Merge with default if empty or partial
      if (!data || Object.keys(data).length === 0) {
        setConfig(DEFAULT_CONFIG);
      } else {
        setConfig({
          enabled: data.enabled ?? DEFAULT_CONFIG.enabled,
          consolidated_relief_allowance: data.consolidated_relief_allowance ?? DEFAULT_CONFIG.consolidated_relief_allowance,
          gross_income_relief_percentage: data.gross_income_relief_percentage ?? DEFAULT_CONFIG.gross_income_relief_percentage,
          rent_relief_percentage: data.rent_relief_percentage ?? DEFAULT_CONFIG.rent_relief_percentage,
          minimum_tax_rate: data.minimum_tax_rate ?? DEFAULT_CONFIG.minimum_tax_rate,
          pension_relief_percentage: data.pension_relief_percentage ?? DEFAULT_CONFIG.pension_relief_percentage,
          nhf_relief_percentage: data.nhf_relief_percentage ?? DEFAULT_CONFIG.nhf_relief_percentage,
          nhis_relief_percentage: data.nhis_relief_percentage ?? DEFAULT_CONFIG.nhis_relief_percentage,
          tax_brackets: Array.isArray(data.tax_brackets) ? data.tax_brackets : DEFAULT_CONFIG.tax_brackets,
        });
      }
    } catch (error) {
      console.error('Failed to load tax configuration:', error);
      showToast.error('Failed to load tax configuration');
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config || !user) return;

    try {
      setSaving(true);
      await settingsAPI.updateTaxConfiguration(config, user.id, user.email);
      showToast.success('Tax configuration saved successfully');
    } catch (error) {
      console.error('Failed to save tax configuration:', error);
      showToast.error('Failed to save tax configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleReliefChange = (key: keyof Omit<TaxConfiguration, 'enabled' | 'tax_brackets'>, value: string) => {
    if (!config) return;
    const numValue = parseFloat(value) || 0;
    setConfig({
      ...config,
      [key]: numValue,
    });
  };

  const handleBandChange = (index: number, field: keyof TaxBand, value: string) => {
    if (!config) return;
    const newBrackets = [...config.tax_brackets];
    
    if (field === 'max' && value === '') {
      newBrackets[index] = { ...newBrackets[index], max: null };
    } else {
      const numValue = parseFloat(value) || 0;
      newBrackets[index] = { ...newBrackets[index], [field]: numValue };
    }
    
    setConfig({ ...config, tax_brackets: newBrackets });
  };

  const addBand = () => {
    if (!config) return;
    const lastBand = config.tax_brackets[config.tax_brackets.length - 1];
    const newMin = lastBand ? (lastBand.max || 0) : 0;
    
    setConfig({
      ...config,
      tax_brackets: [
        ...config.tax_brackets,
        {
          id: crypto.randomUUID(),
          min: newMin,
          max: null,
          rate: 0,
        },
      ],
    });
  };

  const removeBand = (index: number) => {
    if (!config) return;
    const newBrackets = config.tax_brackets.filter((_, i) => i !== index);
    setConfig({ ...config, tax_brackets: newBrackets });
  };

  if (loading) {
    return <PageSkeleton mode="detail" />;
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'System Administration', path: '/admin' }, { label: 'Tax Configuration' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Tax Configuration</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage PAYE tax rates, reliefs, and statutory deductions.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={loadConfiguration} disabled={saving} className="flex-1 sm:flex-none">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Settings & Reliefs */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Statutory Reliefs
              </CardTitle>
              <CardDescription>Configure standard tax reliefs and deduction rates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tax Calculation Enabled</Label>
                  <p className="text-xs text-muted-foreground">Master switch for tax processing</p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked: boolean) => setConfig({ ...config, enabled: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Rent Relief (%)</Label>
                  <Input
                    type="number"
                    value={config.rent_relief_percentage}
                    onChange={(e) => handleReliefChange('rent_relief_percentage', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Percentage of housing allowance (Tax Exempt)</p>
                </div>

                <div className="space-y-1">
                  <Label>Minimum Tax Rate (%)</Label>
                  <Input
                    type="number"
                    value={config.minimum_tax_rate}
                    onChange={(e) => handleReliefChange('minimum_tax_rate', e.target.value)}
                  />
                </div>
              </div>

              <Separator />
              
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Statutory Deductions</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Pension (%)</Label>
                    <Input
                      type="number"
                      value={config.pension_relief_percentage}
                      onChange={(e) => handleReliefChange('pension_relief_percentage', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>NHF (%)</Label>
                    <Input
                      type="number"
                      value={config.nhf_relief_percentage}
                      onChange={(e) => handleReliefChange('nhf_relief_percentage', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>NHIS (%)</Label>
                    <Input
                      type="number"
                      value={config.nhis_relief_percentage}
                      onChange={(e) => handleReliefChange('nhis_relief_percentage', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900">
            <CardContent className="p-4 flex gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Tax Calculation Logic</p>
                <p>Taxable Income = Gross Income - (Pension + NHF + Rent Relief).</p>
                <p className="mt-1">Rent Relief is {config.rent_relief_percentage}% of Housing Allowance.</p>
                <p className="mt-1 text-xs opacity-80">Note: CRA and Gross Income Relief have been abolished.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tax Bands */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Tax Bands</CardTitle>
                  <CardDescription>Configure progressive tax rates based on taxable income.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addBand} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Band
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Band Range (₦)</TableHead>
                      <TableHead className="w-[120px]">Tax Rate (%)</TableHead>
                      <TableHead className="w-[80px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.tax_brackets.map((band, index) => (
                      <TableRow key={band.id || `band-${index}`}>
                        <TableCell>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <Input
                              type="number"
                              value={band.min}
                              onChange={(e) => handleBandChange(index, 'min', e.target.value)}
                              className="w-full sm:w-32 h-8"
                              placeholder="Min"
                            />
                            <span className="text-muted-foreground hidden sm:inline">-</span>
                            <span className="text-muted-foreground sm:hidden">to</span>
                            <Input
                              type="number"
                              value={band.max === null ? '' : band.max}
                              onChange={(e) => handleBandChange(index, 'max', e.target.value)}
                              className="w-full sm:w-32 h-8"
                              placeholder="Infinity"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <Input
                              type="number"
                              value={band.rate}
                              onChange={(e) => handleBandChange(index, 'rate', e.target.value)}
                              className="h-8 pr-6"
                            />
                            <span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeBand(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {config.tax_brackets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No tax bands configured. Click "Add Band" to start.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
