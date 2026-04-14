type PaginationProps = {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (nextOffset: number) => void;
};

export default function Pagination({ total, limit, offset, onPageChange }: PaginationProps) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="pagination">
      <button
        className="ghost"
        type="button"
        disabled={offset <= 0}
        onClick={() => onPageChange(Math.max(0, offset - limit))}
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        className="ghost"
        type="button"
        disabled={offset + limit >= total}
        onClick={() => onPageChange(offset + limit)}
      >
        Next
      </button>
    </div>
  );
}
