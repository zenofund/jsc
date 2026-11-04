import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { Search, Loader2, User, X } from 'lucide-react';
import { staffAPI } from '../../lib/api-client';
import { formatStaffName } from '../../lib/name-utils';
import { Staff } from '../../types/entities';
import { Portal } from '../Portal';

const STAFF_SEARCH_RESULT_LIMIT = 20;
const STAFF_SEARCH_DEBOUNCE_MS = 300;

interface StaffSearchProps {
  onSelect: (staff: Staff | null) => void;
  selectedStaff?: Staff | null;
  status?: string | string[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  formatSelectedStaff?: (staff: Staff) => string;
  renderStaffDetails?: (staff: Staff) => ReactNode;
}

export function StaffSearch({
  onSelect,
  selectedStaff,
  status,
  label = 'Select Staff Member',
  placeholder = 'Search by Name, Staff Number, or Department...',
  disabled = false,
  formatSelectedStaff,
  renderStaffDetails,
}: StaffSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const statusFilter = Array.isArray(status) ? status.join(',') : status;

  const normalizeStaff = (item: any): Staff => {
    if (item?.bio_data && item?.appointment && item?.salary_info) {
      return item as Staff;
    }

    return {
      id: item.id,
      staff_number: item.staff_number,
      bio_data: {
        first_name: item.first_name,
        last_name: item.surname || item.last_name,
        middle_name: item.other_names || item.middle_name,
        email: item.email,
        date_of_birth: item.date_of_birth,
        gender: item.gender,
        state_of_origin: item.state_of_origin,
        lga_of_origin: item.lga_of_origin,
      },
      next_of_kin: {},
      appointment: {
        department: item.department_name || item.department,
        current_posting: item.current_posting,
        designation: item.designation,
        date_of_first_appointment: item.date_of_first_appointment,
        employment_date: item.employment_date,
      },
      salary_info: {
        grade_level: item.grade_level,
        step: item.step,
        bank_name: item.bank_name,
        account_number: item.account_number,
      },
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      created_by: item.created_by,
    };
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        !dialogRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search on the server so the result limit does not hide staff beyond a preloaded directory page.
  useEffect(() => {
    const searchTerm = query.trim();
    setResults([]);
    setSearchError(null);

    if (!searchTerm) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await staffAPI.getAllStaff({
          page: 1,
          limit: STAFF_SEARCH_RESULT_LIMIT,
          search: searchTerm,
          status: statusFilter,
        });
        const data = Array.isArray(response) ? response : (response.data || []);
        if (!cancelled) {
          setResults(data.slice(0, STAFF_SEARCH_RESULT_LIMIT).map(normalizeStaff));
          setIsOpen(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to search staff:', error);
          setSearchError(error instanceof Error ? error.message : 'Unable to search staff.');
          setResults([]);
          setIsOpen(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, STAFF_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, statusFilter]);

  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectStaff = (staffMember: Staff) => {
    onSelect(staffMember);
    setQuery('');
    setIsOpen(false);
  };

  const renderResultDetails = (staffMember: Staff) =>
    renderStaffDetails?.(staffMember) ?? staffMember.appointment?.department ?? '';

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex items-center gap-3 mb-2">
        <User className="size-5 text-primary" />
        <label className="font-medium text-foreground">{label}</label>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
          value={selectedStaff && !isOpen
            ? formatSelectedStaff?.(selectedStaff) ?? `${selectedStaff.staff_number} - ${formatStaffName(selectedStaff)}`
            : query}
          onChange={(e) => {
            if (selectedStaff) {
              onSelect(null);
            }
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
             if (selectedStaff) setQuery(''); // Clear display value to allow searching
             setIsOpen(true);
          }}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="size-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      {isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6">
            <div
              ref={dialogRef}
              className="flex h-dvh w-full flex-col bg-background p-4 sm:h-auto sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border sm:p-6 sm:shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Search staff"
            >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Select staff member</h2>
              <p className="text-sm text-muted-foreground">Search by name or staff number.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Close staff search"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              placeholder={placeholder}
              disabled={disabled}
              onChange={(event) => {
                if (selectedStaff) onSelect(null);
                setQuery(event.target.value);
              }}
              className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-10 text-base text-foreground outline-none focus:ring-2 focus:ring-primary/50"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card">
            {results.map((staffMember) => (
              <button
                key={staffMember.id}
                type="button"
                className="flex min-h-16 w-full flex-col justify-center border-b border-border px-4 py-3 text-left last:border-0 hover:bg-accent/50 focus:bg-accent/50"
                onClick={() => selectStaff(staffMember)}
              >
                <span className="font-medium text-foreground">{formatStaffName(staffMember)}</span>
                <span className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{staffMember.staff_number}</span>
                  <span>{renderResultDetails(staffMember)}</span>
                </span>
              </button>
            ))}
            {searchError && (
              <p className="p-4 text-center text-sm text-destructive">Staff search failed: {searchError}</p>
            )}
            {query && !loading && !searchError && results.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">No staff found matching "{query}"</p>
            )}
            {query && loading && results.length === 0 && (
              <p className="flex items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching staff...
              </p>
            )}
            {!query && !loading && results.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">Enter a name or staff number to search.</p>
            )}
          </div>
          <p className="shrink-0 pt-3 text-center text-xs text-muted-foreground">
            {results.length > 0 ? `${results.length} results · Select a staff member` : 'Search results will appear here'}
          </p>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
