/**
 * Serializable description of a catalog ("danh mục") screen.
 * The same definition drives the list table, the collapsible filters,
 * the add/edit form, validation and the propose → approve flow.
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'money'
  | 'date'
  | 'bool'
  | 'select'
  | 'ref'
  | 'multiref'
  | 'image'
  | 'password';

export type Option = {value: string; label: string; description?: string};

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  /** Resource key the value points at (for ref / multiref), e.g. "doi-tuong/loai-ncc". */
  ref?: string;
  placeholder?: string;
  description?: string;
  /** Show as a column in the list (default true for the first few fields). */
  inTable?: boolean;
  /** Offer as a filter in the collapsible filter panel. */
  filterable?: boolean;
  hideInForm?: boolean;
  /** Full-width in the form grid. */
  wide?: boolean;
  defaultValue?: unknown;
};

/**
 * - direct: anyone with edit permission edits in place.
 * - propose: after the first save, staff cannot edit directly; "Đề xuất sửa"
 *   creates a proposal that an approver applies (e.g. Khách hàng).
 * - draft: like propose, and new records from staff start as drafts until
 *   approved ("lưu nháp / lưu cố định", e.g. Nhà cung cấp, Nhân viên).
 */
export type EditMode = 'direct' | 'propose' | 'draft';

export type ResourceDef = {
  key: string;
  title: string;
  /** Singular noun for buttons/dialogs, e.g. "khách hàng". */
  noun: string;
  description?: string;
  codePrefix: string;
  fields: FieldDef[];
  /** Field used as the display label when other records point here. */
  labelField: string;
  editMode: EditMode;
  /** Records belong to a branch and are filtered by the current branch. */
  branchScoped?: boolean;
  /** Code column header, default "Mã". */
  codeLabel?: string;
};

export type RecordRow = Record<string, unknown> & {id: number; code: string};

export type RefOptions = Record<string, Option[]>;
