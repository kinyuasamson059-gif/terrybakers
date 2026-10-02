import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Search or select...',
  emptyMessage = 'No matching records found.',
  disabled = false,
  allowClear = true,
  allowCreate = false,
  createLabel = '+ Add new',
  onCreate,
  className = '',
  inputStyle = {}
}) {
  const wrapperRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find(option => String(option.id) === String(value)) || null,
    [options, value]
  );

  useEffect(() => {
    if (selectedOption) {
      const label = selectedOption.label || selectedOption.name || '';
      setInputValue(label);
      return;
    }
    if (value === '' || value === null || value === undefined) {
      setInputValue('');
    }
  }, [selectedOption, value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const query = normalizeValue(inputValue);

    if (!query) {
      return options;
    }

    return options.filter((option) => {
      const searchText = [
        option.label,
        option.name,
        option.phone,
        option.email,
        option.product_code,
        option.ingredient_code,
        option.customer_code,
        option.worker_code,
        option.searchText,
        option.unit,
        option.category,
        option.code,
        option.value
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchText.includes(query);
    });
  }, [inputValue, options]);

  useEffect(() => {
    if (filteredOptions.length === 0) {
      setHighlightedIndex(0);
      return;
    }
    setHighlightedIndex(prev => Math.min(prev, filteredOptions.length - 1));
  }, [filteredOptions.length]);

  const selectOption = (option) => {
    if (!option) return;
    setInputValue(option.label || option.name || '');
    onChange?.(option.id);
    setIsOpen(false);
  };

  const handleChange = (event) => {
    const nextValue = event.target.value;
    const trimmed = nextValue.trim();
    const normalizedQuery = normalizeValue(trimmed);

    if (normalizedQuery) {
      const uniqueMatches = options.filter((option) => {
        const candidate = [
          option.label,
          option.name,
          option.phone,
          option.email,
          option.product_code,
          option.ingredient_code,
          option.customer_code,
          option.worker_code,
          option.searchText,
          option.unit,
          option.category,
          option.code,
          option.value
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return candidate.includes(normalizedQuery);
      });

      if (uniqueMatches.length === 1) {
        const match = uniqueMatches[0];
        setInputValue(match.label || match.name || '');
        onChange?.(match.id);
        setIsOpen(false);
        return;
      }
    }

    setInputValue(nextValue);
    setIsOpen(true);
    if (selectedOption && nextValue !== selectedOption.label && nextValue !== selectedOption.name) {
      onChange?.('');
    }
  };

  const handleKeyDown = (event) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true);
    }

    if (!filteredOptions.length) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        selectOption(option);
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const clearSelection = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setInputValue('');
    onChange?.('');
    setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className={`form-input ${className}`}
          style={{
            ...inputStyle,
            paddingRight: allowClear && selectedOption ? '38px' : '32px'
          }}
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        {allowClear && selectedOption && (
          <button
            type="button"
            onClick={clearSelection}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        )}

        {!allowClear || !selectedOption ? (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
            aria-label="Toggle options"
          >
            <ChevronDown size={16} />
          </button>
        ) : null}
      </div>

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 2000,
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '6px 0'
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {emptyMessage}
              {allowCreate && onCreate ? (
                <button
                  type="button"
                  onClick={() => onCreate(inputValue)}
                  style={{
                    display: 'block',
                    marginTop: '8px',
                    color: 'var(--primary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 700
                  }}
                >
                  {createLabel}
                </button>
              ) : null}
            </div>
          ) : (
            filteredOptions.map((option, index) => {
              const label = option.label || option.name || option.title || '';
              const isHighlighted = index === highlightedIndex;
              return (
                <button
                  key={option.id ?? `${label}-${index}`}
                  type="button"
                  onClick={() => selectOption(option)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: isHighlighted ? 'var(--surface-subtle)' : 'transparent',
                    color: 'var(--text-main)',
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'block'
                  }}
                >
                  {label}
                  {option.meta ? (
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                      {option.meta}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
