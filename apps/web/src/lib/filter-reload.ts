// Reload 時是否需要清空首頁臨時篩選。
// 獨立成 pure function，方便 unit test；DOM access 留返畀 component。
export function shouldResetFiltersOnReload(
  search: string,
  navigationType: string | undefined,
): boolean {
  return search !== "" && navigationType === "reload";
}
