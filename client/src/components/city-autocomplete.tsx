import * as React from 'react';
import { Input } from '@/components/ui/input';
import { RO_CITIES } from '@/lib/ro-cities';
import { cn } from '@/lib/utils';

const DIACRITICS_PATTERN = /\p{Diacritic}/gu;

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(DIACRITICS_PATTERN, '');
}

const MAX_SUGGESTIONS = 8;

interface CityAutocompleteProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

/*
 * Autocomplete local pe orașe RO — fără cereri de rețea (Nominatim nu permite
 * interogări de tip typeahead, câte una pe apăsare de tastă). Rămâne text liber:
 * dacă orașul nu e în listă, userul poate scrie orice, geocodarea se face oricum la submit.
 */
export const CityAutocomplete = React.forwardRef<HTMLInputElement, CityAutocompleteProps>(
  function CityAutocomplete({ value, onChange, onBlur, onFocus, className, id, ...props }, ref) {
    const [open, setOpen] = React.useState(false);
    const [highlighted, setHighlighted] = React.useState(0);
    const blurTimeout = React.useRef<number | null>(null);
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const listboxId = `${inputId}-listbox`;

    React.useEffect(() => {
      return () => {
        if (blurTimeout.current !== null) window.clearTimeout(blurTimeout.current);
      };
    }, []);

    const suggestions = React.useMemo(() => {
      const query = normalize(value.trim());
      if (query.length === 0) return [];
      return RO_CITIES.filter((city) => normalize(city.name).startsWith(query)).slice(
        0,
        MAX_SUGGESTIONS,
      );
    }, [value]);

    const showList = open && suggestions.length > 0;
    const activeOptionId =
      showList && suggestions[highlighted] ? `${listboxId}-${highlighted}` : undefined;

    function pick(city: (typeof suggestions)[number]) {
      onChange(`${city.name}, ${city.county}`);
      setOpen(false);
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={(event) => {
            if (blurTimeout.current !== null) {
              window.clearTimeout(blurTimeout.current);
              blurTimeout.current = null;
            }
            setOpen(true);
            setHighlighted(0);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            // lasă onClick-ul din listă să se declanșeze înainte să dispară
            blurTimeout.current = window.setTimeout(() => {
              setOpen(false);
              blurTimeout.current = null;
            }, 150);
            onBlur?.(event);
          }}
          onKeyDown={(event) => {
            if (!showList) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlighted((h) => Math.max(h - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const city = suggestions[highlighted];
              if (city) pick(city);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          className={className}
          {...props}
        />
        {showList && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-md"
          >
            {suggestions.map((city, i) => (
              <li key={`${city.name}-${city.county}`} role="presentation">
                <button
                  type="button"
                  id={`${listboxId}-${i}`}
                  role="option"
                  aria-selected={i === highlighted}
                  className={cn(
                    'flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left',
                    i === highlighted
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(city)}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  <span>{city.name}</span>
                  <span className="text-xs text-muted-foreground">{city.county}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
