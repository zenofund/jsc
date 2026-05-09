import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User } from 'lucide-react';
import { staffAPI } from '../../lib/api-client';
import { Staff } from '../../types/entities';

interface StaffSearchProps {
  onSelect: (staff: Staff) => void;
  selectedStaff?: Staff | null;
}

export function StaffSearch({ onSelect, selectedStaff }: StaffSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Debounced search
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Fetch all staff and filter client-side since API search might be limited
        // In a real app, this should be a search endpoint
        const response = await staffAPI.getAllStaff({ fetchAll: true });
        const allStaff = response.data || [];
        
        const searchLower = query.toLowerCase();
        const filtered = allStaff.filter((staff: any) => {
          const name = `${staff.first_name} ${staff.surname || staff.last_name} ${staff.other_names || ''}`.toLowerCase();
          const staffNo = staff.staff_number?.toLowerCase() || '';
          const dept = (staff.department_name || staff.department)?.toLowerCase() || '';
          
          return name.includes(searchLower) || staffNo.includes(searchLower) || dept.includes(searchLower);
        }).slice(0, 10); // Limit to 10 results

        // Map to standard Staff type
        const mapped = filtered.map((item: any) => ({
          id: item.id,
          staff_number: item.staff_number,
          bio_data: {
            first_name: item.first_name,
            last_name: item.surname || item.last_name,
            middle_name: item.other_names || item.middle_name,
            email: item.email,
          },
          appointment: {
            department: item.department_name || item.department,
          },
          salary_info: {
            grade_level: item.grade_level,
            step: item.step,
          },
          status: item.status,
        }));

        setResults(mapped);
        setIsOpen(true);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
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
          value={selectedStaff && !isOpen ? `${selectedStaff.staff_number} - ${selectedStaff.bio_data.first_name} ${selectedStaff.bio_data.last_name}` : query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selectedStaff) {
               // Clear selection if user starts typing to search again
               // But we don't call onSelect(null) immediately to avoid UI jump
            }
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
                {staff.bio_data.first_name} {staff.bio_data.last_name}
              </div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>{staff.staff_number}</span>
                <span>{staff.appointment.department}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {isOpen && query && results.length === 0 && !loading && (
        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-4 text-center text-muted-foreground text-sm">
          No staff found matching "{query}"
        </div>
      )}
    </div>
  );
}
