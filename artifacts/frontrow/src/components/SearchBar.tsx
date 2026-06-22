import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="group relative w-full">
      {/* Continuous purple glow — pulses every 3 s */}
      <div
        className="absolute -inset-0.5 rounded-xl blur-md"
        style={{
          background:
            "linear-gradient(135deg, #7B2FBE 0%, #6B21A8 50%, #7B2FBE 100%)",
          animation: "search-glow-pulse 3s ease-in-out infinite",
        }}
      />
      <div
        className="relative flex items-center gap-3 rounded-xl border border-[#7B2FBE]/30 bg-input px-5 py-4"
        style={{ boxShadow: "0 0 28px -8px rgba(123,47,190,0.45)" }}
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Search for a song, artist, or album..."}
          className="w-full border-0 bg-transparent text-lg text-foreground outline-none placeholder:text-muted-foreground/60"
          data-testid="input-search"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
