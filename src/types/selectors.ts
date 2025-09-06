// Alias de sélecteurs pour dropdowns (P2 ergonomie/types)

export type DropdownSelectors = {
  inputSelector: string;
  chevronSelector?: string;
  contentSelector?: string;
};

export type DropdownSearchSelectors = DropdownSelectors & {
  searchSelector?: string;
};
