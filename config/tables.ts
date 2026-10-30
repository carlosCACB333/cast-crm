/** Defaults shared by every data table (`AppDataTable` / `useClientTable`). */
export const TABLE_DEFAULTS = {
  /** Rows per page for lists paginated in the browser. */
  pageSize: 10,
  /** Wait after the last keystroke before applying a search or text filter. */
  searchDebounceMs: 300,
  /** Narrowest a resizable column can get, in px. */
  minColumnWidth: 96,
};

/** Defaults of the searchable selects (`AppAutocomplete`) backed by the server. */
export const OPTION_DEFAULTS = {
  /** Options loaded per request; scrolling to the end loads the next page. */
  pageSize: 20,
  /** Wait after the last keystroke before searching on the server. */
  searchDebounceMs: 250,
  /** Most selected values whose labels can be resolved in one request. */
  maxIds: 50,
  /** Fixed lists longer than this show a search field. */
  searchThreshold: 8,
};
