export default function ChannelPagination({
    activePage,
    pageCount,
    onPageSelect,
}: {
    activePage: number;
    pageCount: number;
    onPageSelect: (page: number) => void;
}) {
    if (pageCount <= 1) return null;

    const visiblePageCount = Math.min(5, pageCount);
    const firstVisiblePage = Math.max(0, Math.min(activePage - 2, pageCount - visiblePageCount));
    const visiblePages = Array.from(
        { length: visiblePageCount },
        (_, index) => firstVisiblePage + visiblePageCount - 1 - index,
    );

    return (
        <nav className="channel-pagination" aria-label="Pages des messages">
            {visiblePages.map((targetPage) => {
                const isActive = targetPage === activePage;
                const isNeighbor = Math.abs(targetPage - activePage) === 1;

                return (
                    <button
                        key={targetPage}
                        type="button"
                        className="channel-page-dot"
                        aria-label={`Aller à la page ${pageCount - targetPage} sur ${pageCount}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => onPageSelect(targetPage)}
                    >
                        <span className={`channel-page-dot-mark${isActive ? " channel-page-dot-mark--active" : isNeighbor ? " channel-page-dot-mark--neighbor" : ""}`}>
                            {isActive ? pageCount - targetPage : null}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
