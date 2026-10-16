import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User } from 'lucide-react';
import { staffAPI } from '../../lib/api-client';
import { formatStaffName } from '../../lib/name-utils';
import { Staff } from '../../types/entities';

const STAFF_SEARCH_RESULT_LIMIT = 10;
const STAFF_SEARCH_DEBOUNCE_MS = 300;

interface StaffSearchProps {
  onSelect: (staff: Staff | null) => void;
  selectedStaff?: Staff | null;
  status?: string;
}

export function StaffSearch({ onSelect, selectedStaff, status }: StaffSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
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
          status,
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
  }, [query]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex items-center gap-3 mb-2">
        <User className="size-5 text-primary" />
        <label className="font-medium text-foreground">Select Staff Member</label>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by Name, Staff Number, or Department..."
          className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
          value={selectedStaff && !isOpen ? `${selectedStaff.staff_number} - ${formatStaffName(selectedStaff)}` : query}
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

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((staff) => (
            <button
              key={staff.id}
              className="w-full text-left px-4 py-2 hover:bg-accent/50 focus:bg-accent/50 outline-none transition-colors border-b border-border last:border-0"
              onClick={() => {
                onSelect(staff);
                setQuery('');
                setIsOpen(false);
              }}
            >
              <div className="font-medium text-foreground">
                {formatStaffName(staff)}
              </div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>{staff.staff_number}</span>
                <span>{staff.appointment?.department || ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {isOpen && searchError && (
        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-4 text-center text-destructive text-sm">
          Staff search failed: {searchError}
        </div>
      )}

      {isOpen && query && results.length === 0 && !loading && (
        searchError ? null : (
          <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-4 text-center text-muted-foreground text-sm">
            No staff found matching "{query}"
          </div>
        )
      )}
    </div>
  );
}
