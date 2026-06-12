export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-[var(--color-ghn-orange)] text-white font-bold px-2 py-1 rounded text-sm leading-none">
        GHN
      </div>
      {!compact && (
        <div>
          <div className="text-sm font-semibold text-[var(--color-text)] leading-tight">
            GiaoHangNhanh
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] leading-tight">
            Giao Siêu Nhanh, Giao Siêu Tốt
          </div>
        </div>
      )}
    </div>
  );
}
