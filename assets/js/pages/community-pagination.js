(function initCommunityPagination() {
  "use strict";

  document.querySelectorAll("[data-community-pagination]").forEach((pager) => {
    const section = pager.closest("section");
    const isDirectory = pager.classList.contains(
      "community-pagination--directory",
    );
    const rows = Array.from(
      section.querySelectorAll(
        isDirectory
          ? "[data-community-directory-row]"
          : ".community-page-row",
      ),
    );
    const summary = pager.querySelector("[data-page-summary]");
    const indicator = pager.querySelector("[data-page-indicator]");
    const previous = pager.querySelector("[data-page-previous]");
    const next = pager.querySelector("[data-page-next]");
    const search = isDirectory
      ? document.getElementById("community-directory-search")
      : null;
    const emptyState = isDirectory
      ? section.querySelector(".community-dashboard__empty")
      : null;
    const pageSize = Math.max(
      1,
      Number.parseInt(pager.dataset.pageSize || "6", 10) || 6,
    );

    if (!rows.length) {
      pager.hidden = true;
      return;
    }

    let currentPage = 1;
    let filteredRows = rows;

    if (isDirectory) {
      rows.sort((a, b) => {
        const pageDifference =
          Number(b.dataset.communityPageCount) -
          Number(a.dataset.communityPageCount);
        return (
          pageDifference ||
          (a.dataset.communityName || "").localeCompare(
            b.dataset.communityName || "",
          )
        );
      });
      rows.forEach((row) => row.parentElement.append(row));
    }

    function render() {
      const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
      currentPage = Math.min(currentPage, pageCount);
      const start = (currentPage - 1) * pageSize;
      const visibleRows = new Set(
        filteredRows.slice(start, start + pageSize),
      );

      rows.forEach((row) => {
        row.hidden = !visibleRows.has(row);
      });

      if (summary) {
        summary.textContent = filteredRows.length
          ? `Showing ${start + 1}–${Math.min(start + pageSize, filteredRows.length)} of ${filteredRows.length} communities`
          : "No communities to show";
      }
      if (indicator) {
        indicator.textContent = `Page ${currentPage} of ${pageCount}`;
      }
      if (previous) previous.disabled = currentPage <= 1;
      if (next) next.disabled = currentPage >= pageCount;
      pager.hidden = filteredRows.length <= pageSize;
      if (emptyState) emptyState.hidden = filteredRows.length > 0;
    }

    previous.addEventListener("click", () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      render();
    });

    next.addEventListener("click", () => {
      const pageCount = Math.ceil(filteredRows.length / pageSize);
      if (currentPage >= pageCount) return;
      currentPage += 1;
      render();
    });

    if (search) {
      search.addEventListener("input", () => {
        const query = search.value.trim().toLocaleLowerCase();
        filteredRows = rows.filter((row) =>
          (row.dataset.communityName || "").includes(query),
        );
        currentPage = 1;
        render();
      });
    }

    render();
  });
})();
